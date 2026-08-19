import { supabase, esc, money, genericError, currentMonthStart } from './supabase-client.js';
import { requireAuth } from './auth-guard.js';
import { getAllCourseProgress, getContinueWatching, progressBarHtml } from './progress-tracker.js';
import { fetchNotifications, unreadCount, markRead, markAllRead, renderNotifList, subscribeRealtimeNotifications, timeAgoAr, notify } from './notifications.js';
import { ACHIEVEMENTS, getEarnedAchievements, checkAndAwardAchievements } from './achievements.js';

const MATERIAL_LABELS = { sheet: { label: 'شيت', chip: 'chip-sheet', icon: '📄' }, board: { label: 'سبورة', chip: 'chip-board', icon: '🖼' }, note: { label: 'مذكرة', chip: 'chip-note', icon: '📘' } };

const session = await requireAuth('student');
if (!session) throw new Error('redirecting');
const { user } = session;
let profile = session.profile;

function empty(message, action = '') { return `<div class="empty-state">${message}${action ? `<div style="margin-top:12px">${action}</div>` : ''}</div>`; }
function lockedPanel(message, cta = '') { return `<div class="locked-panel"><div class="lock-icon">🔒</div><h3>محتوى محظور</h3><p>${message}</p>${cta}</div>`; }
function setStatus(message, type = 'error') { const node = document.querySelector('[data-portal-status]'); if (node) { node.textContent = message; node.className = `status-message is-visible ${type}`; } }

function setNavigation() {
  const buttons = document.querySelectorAll('[data-view]');
  const views = document.querySelectorAll('.view');
  buttons.forEach((button) => button.addEventListener('click', () => {
    const selected = button.dataset.view;
    buttons.forEach((item) => item.classList.toggle('active', item.dataset.view === selected));
    views.forEach((view) => view.classList.toggle('active', view.id === selected));
    document.querySelector('[data-page-title]').textContent = button.dataset.title || 'لوحة الطالب';
    onViewOpen(selected);
  }));
  document.querySelector('[data-logout]')?.addEventListener('click', async () => { await supabase.auth.signOut(); location.href = 'index.html'; });
}

function setMobileMenu() {
  const sidebar = document.querySelector('.sidebar');
  const backdrop = document.querySelector('[data-sidebar-backdrop]');
  const toggle = document.querySelector('[data-menu-toggle]');
  const closeMenu = () => { sidebar?.classList.remove('open'); backdrop?.classList.remove('active'); };
  toggle?.addEventListener('click', () => { sidebar?.classList.add('open'); backdrop?.classList.add('active'); });
  backdrop?.addEventListener('click', closeMenu);
  sidebar?.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', closeMenu));
}

function onViewOpen(view) {
  if (view === 'quizzes') loadQuizzes();
  if (view === 'explainer-videos') loadExplainerVideos();
  if (view === 'materials') loadMaterials();
  if (view === 'subscription') loadSubscriptionView();
  if (view === 'payments') loadCoursePayments();
  if (view === 'profile') loadProfileView();
  if (view === 'achievements') loadAchievements();
}

/* ============================== نظرة عامة + كورساتي ============================== */
function courseCard(course, progress) {
  const total = progress?.total_lessons || 0;
  const completed = progress?.completed_lessons || 0;
  const pct = total ? Math.round((completed / total) * 100) : 0;
  const progressBlock = total
    ? `<div style="margin:10px 0"><div class="lp-meta-row"><span>${completed}/${total} درس مكتمل</span><strong>${pct}%</strong></div>${progressBarHtml(pct)}</div>`
    : `<p class="course-meta" style="margin:10px 0">لم تبدأ دروس هذا الكورس بعد.</p>`;
  return `<article class="course-card"><div class="course-cover">${course.cover_image_url ? `<img src="${esc(course.cover_image_url)}" alt="${esc(course.title)}">` : '◒'}</div><div class="course-card-body">
    <div><div class="course-meta">${esc(course.subject || 'محتوى تعليمي')}</div><h3>${esc(course.title)}</h3>${progressBlock}</div>
    <div class="course-footer"><span class="price">${pct >= 100 && total ? 'مكتمل ✓' : 'مفعّل'}</span><a class="button button-secondary" href="playlist-view.html?course=${encodeURIComponent(course.id)}">${completed > 0 ? 'متابعة الدروس' : 'عرض الدروس'}</a></div>
  </div></article>`;
}

async function loadMyCourses() {
  const targets = document.querySelectorAll('[data-student-courses]');
  if (!targets.length) return;
  targets.forEach((t) => { t.innerHTML = '<p class="loading">جاري تحميل كورساتك…</p>'; });
  const [{ data, error }, progressRows] = await Promise.all([
    supabase.from('enrollments').select('course:courses(*)').eq('student_id', user.id),
    getAllCourseProgress(user.id),
  ]);
  const courses = error ? [] : (data || []).map((r) => r.course).filter(Boolean);
  const progressByCourse = Object.fromEntries(progressRows.map((p) => [p.course_id, p]));
  const content = courses.length
    ? courses.map((c) => courseCard(c, progressByCourse[c.id])).join('')
    : empty('لا توجد كورسات مفعّلة في حسابك حاليًا.', '<a class="button button-primary" href="courses.html">تصفح الكورسات</a>');
  targets.forEach((t) => { t.innerHTML = content; });
  document.querySelector('[data-course-count]')?.replaceChildren(document.createTextNode(String(courses.length)));
}

/* ============================== أكمل من حيث توقفت ============================== */
async function loadContinueWatching() {
  const target = document.querySelector('[data-continue-watching]');
  if (!target) return;
  target.innerHTML = '<p class="loading">جاري التحميل…</p>';
  const cw = await getContinueWatching(user.id);
  if (!cw) {
    target.innerHTML = empty('لا يوجد درس متوقف عنده حاليًا. ابدأ درسًا جديدًا!', '<a class="button button-primary" href="courses.html">ابدأ درسًا جديدًا</a>');
    return;
  }
  target.innerHTML = `<div class="continue-card">
    <div class="cc-cover">${cw.cover_image_url ? `<img src="${esc(cw.cover_image_url)}" alt="${esc(cw.course_title)}">` : '◒'}</div>
    <div class="cc-body">
      <div class="cc-course">${esc(cw.course_title)}</div>
      <div class="cc-lesson">الدرس: ${esc(cw.lesson_title)}</div>
      <div class="lp-meta-row"><span>${cw.progress_percentage || 0}% مكتمل</span></div>
      ${progressBarHtml(cw.progress_percentage)}
    </div>
    <div class="cc-actions"><a class="button button-primary" href="playlist-view.html?course=${encodeURIComponent(cw.course_id)}&lesson=${encodeURIComponent(cw.lesson_id)}">متابعة المشاهدة</a></div>
  </div>`;
}

/* ============================== إنجازاتي ============================== */
async function loadAchievements() {
  const target = document.querySelector('[data-achievements-list]');
  if (!target) return;
  target.innerHTML = '<p class="loading">جاري التحميل…</p>';
  const earned = await getEarnedAchievements(user.id);
  const earnedMap = Object.fromEntries(earned.map((e) => [e.achievement_id, e]));
  target.innerHTML = ACHIEVEMENTS.map((a) => {
    const record = earnedMap[a.id];
    return `<div class="achv-card ${record ? 'earned' : 'locked'}">
      <div class="achv-icon">${a.icon}</div>
      <h4>${esc(a.title)}</h4>
      <p>${esc(a.desc)}</p>
      ${record ? `<span class="achv-date">تم الفتح ${new Date(record.earned_at).toLocaleDateString('ar-EG')}</span>` : `<span class="achv-date" style="color:#9aa6a0">لم يُفتح بعد</span>`}
    </div>`;
  }).join('');
}

/* ============================== حالة الاشتراك الشهري (محدث) ============================== */
async function getSubscriptionStatus() {
  if (!profile.teacher_id) return { hasTeacher: false, active: false, subscription: null };

  const { data: subscription } = await supabase
    .from('subscription_payments')
    .select('*')
    .eq('student_id', user.id)
    .eq('teacher_id', profile.teacher_id)
    .order('created_at', { ascending: false })
    .maybeSingle();

  if (!subscription) {
    return { hasTeacher: true, active: false, subscription: null };
  }

  const active = subscription.status === 'approved'
    && subscription.start_date
    && subscription.end_date
    && new Date() >= new Date(subscription.start_date)
    && new Date() <= new Date(subscription.end_date);

  return {
    hasTeacher: true,
    active,
    subscription,
    status: subscription.status,
    startDate: subscription.start_date,
    endDate: subscription.end_date,
    isExpired: subscription.status === 'approved' && new Date() > new Date(subscription.end_date)
  };
}

/* ============================== الاختبارات ============================== */
async function loadQuizzes() {
  const target = document.querySelector('[data-quizzes-list]');
  if (!target) return;
  target.innerHTML = '<p class="loading">جاري التحميل…</p>';
  const sub = await getSubscriptionStatus();
  if (!sub.hasTeacher) { target.innerHTML = lockedPanel('لازم تحدد مدرسك أولًا من صفحة "حسابي" حتى تظهر لك الاختبارات.'); return; }
  if (!sub.active) { target.innerHTML = lockedPanel('الاختبارات متاحة فقط للمشتركين اشتراك شهري ساري عند مدرسك.', `<a class="button button-primary" data-view="subscription" data-title="الاشتراك الشهري">اذهب لصفحة الاشتراك</a>`); rebindInlineNav(target); return; }

  const { data: quizzes, error } = await supabase.from('quizzes').select('*').eq('teacher_id', profile.teacher_id).eq('stage', profile.stage).eq('is_published', true).order('created_at', { ascending: false });
  if (error) { target.innerHTML = empty(genericError); return; }
  if (!quizzes.length) { target.innerHTML = empty('لا توجد اختبارات متاحة حاليًا.'); return; }

  const { data: attempts } = await supabase.from('quiz_attempts').select('quiz_id, score, total').eq('student_id', user.id);
  const attemptByQuiz = Object.fromEntries((attempts || []).map((a) => [a.quiz_id, a]));

  target.innerHTML = quizzes.map((q) => {
    const attempt = attemptByQuiz[q.id];
    return `<article class="quiz-card"><div class="meta-col"><h4>📝 ${esc(q.title)}</h4><span class="course-meta">${q.duration_minutes ? q.duration_minutes + ' دقيقة' : 'بدون وقت محدد'}${attempt ? ` · درجتك: ${attempt.score}/${attempt.total}` : ''}</span></div>
      <div class="row-actions"><button class="button ${attempt ? 'button-secondary' : 'button-primary'}" data-take-quiz="${q.id}">${attempt ? 'عرض النتيجة' : 'ابدأ الاختبار'}</button></div>
    </article>`;
  }).join('');

  target.querySelectorAll('[data-take-quiz]').forEach((btn) => btn.addEventListener('click', () => openQuizTaker(btn.dataset.takeQuiz)));
}

async function openQuizTaker(quizId) {
  const modalHost = document.querySelector('[data-lesson-modal]');
  modalHost.classList.add('active');
  modalHost.innerHTML = `<div class="panel" style="max-width:720px;margin:30px auto;max-height:88vh;overflow:auto;"><div class="panel-head"><h3>الاختبار</h3><button class="button button-text" data-close-modal>إغلاق ✕</button></div><div data-quiz-body>جاري التحميل…</div></div>`;
  modalHost.querySelector('[data-close-modal]').addEventListener('click', () => { modalHost.classList.remove('active'); modalHost.innerHTML = ''; });

  const body = modalHost.querySelector('[data-quiz-body]');
  const { data: existingAttempt } = await supabase.from('quiz_attempts').select('*').eq('quiz_id', quizId).eq('student_id', user.id).maybeSingle();
  const { data: questions, error } = await supabase.from('quiz_questions').select('*').eq('quiz_id', quizId).order('sort_order', { ascending: true });
  if (error || !questions) { body.innerHTML = empty(genericError); return; }

  if (existingAttempt) {
    const answers = existingAttempt.answers || {};
    body.innerHTML = `<div class="quiz-result-banner ${existingAttempt.score >= existingAttempt.total / 2 ? '' : 'fail'}">درجتك: ${existingAttempt.score} من ${existingAttempt.total}</div>
      ${questions.map((q, i) => `<div class="quiz-take-question"><strong>س${i + 1}: ${esc(q.question_text)}</strong>
        ${q.options.map((opt, idx) => `<div class="option-label" style="${idx === q.correct_index ? 'border-color:var(--success);background:#eaf6ee' : (answers[q.id] === idx ? 'border-color:var(--error);background:#fcefed' : '')}">${esc(opt)} ${idx === q.correct_index ? '✓ الإجابة الصحيحة' : (answers[q.id] === idx ? '✗ إجابتك' : '')}</div>`).join('')}
      </div>`).join('')}`;
    return;
  }

  body.innerHTML = `<form data-quiz-form>
    ${questions.map((q, i) => `<div class="quiz-take-question"><strong>س${i + 1}: ${esc(q.question_text)}</strong>
      ${q.options.map((opt, idx) => `<label class="option-label"><input type="radio" name="q_${q.id}" value="${idx}" required>${esc(opt)}</label>`).join('')}
    </div>`).join('')}
    <button class="button button-primary" type="submit">تسليم الإجابات</button>
  </form>`;

  body.querySelector('[data-quiz-form]').addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    const answers = {};
    let score = 0;
    questions.forEach((q) => {
      const chosen = Number(formData.get(`q_${q.id}`));
      answers[q.id] = chosen;
      if (chosen === q.correct_index) score += 1;
    });
    const { error } = await supabase.from('quiz_attempts').insert({ quiz_id: quizId, student_id: user.id, answers, score, total: questions.length });
    if (error) { alert(genericError); return; }
    openQuizTaker(quizId);
    loadQuizzes();
    const newAchievements = await checkAndAwardAchievements(user.id);
    if (newAchievements.length) setTimeout(() => alert(`🎉 مبروك! فتحت إنجاز جديد: ${newAchievements.map((a) => a.title).join('، ')}`), 300);
  });
}

/* ============================== فيديو الشرح ============================== */
function toEmbed(url) {
  if (url.includes('watch?v=')) return url.replace('watch?v=', 'embed/');
  if (url.includes('youtu.be/')) return 'https://www.youtube.com/embed/' + url.split('youtu.be/')[1].split('?')[0];
  return url;
}

async function loadExplainerVideos() {
  const target = document.querySelector('[data-videos-list]');
  if (!target) return;
  target.innerHTML = '<p class="loading">جاري التحميل…</p>';
  const sub = await getSubscriptionStatus();
  if (!sub.hasTeacher) { target.innerHTML = lockedPanel('لازم تحدد مدرسك أولًا من صفحة "حسابي" حتى تظهر لك فيديوهات الشرح.'); return; }
  if (!sub.active) { target.innerHTML = lockedPanel('فيديوهات الشرح متاحة فقط للمشتركين اشتراك شهري ساري عند مدرسك.', `<a class="button button-primary" data-view="subscription" data-title="الاشتراك الشهري">اذهب لصفحة الاشتراك</a>`); rebindInlineNav(target); return; }

  const { data: videos, error } = await supabase.from('explainer_videos').select('*').eq('teacher_id', profile.teacher_id).eq('stage', profile.stage).order('created_at', { ascending: false });
  if (error) { target.innerHTML = empty(genericError); return; }
  if (!videos.length) { target.innerHTML = empty('لا توجد فيديوهات شرح متاحة حاليًا.'); return; }

  target.innerHTML = videos.map((v) => `<div class="lesson-item" style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin-bottom:14px">
    <h3 style="margin-bottom:12px">▶ ${esc(v.title)}</h3>
    ${v.description ? `<p class="course-meta" style="margin-bottom:10px">${esc(v.description)}</p>` : ''}
    <iframe style="width:100%;aspect-ratio:16/9;border:0;border-radius:12px" src="${esc(toEmbed(v.video_url))}" allowfullscreen></iframe>
  </div>`).join('');
}

/* ============================== المواد: شيتات / سبورة / مذكرات ============================== */
async function loadMaterials() {
  const target = document.querySelector('[data-materials-list]');
  if (!target) return;
  target.innerHTML = '<p class="loading">جاري التحميل…</p>';
  const sub = await getSubscriptionStatus();
  if (!sub.hasTeacher) { target.innerHTML = lockedPanel('لازم تحدد مدرسك أولًا من صفحة "حسابي" حتى تظهر لك المواد.'); return; }
  if (!sub.active) { target.innerHTML = lockedPanel('الشيتات والسبورة والمذكرات متاحة فقط للمشتركين اشتراك شهري ساري عند مدرسك.', `<a class="button button-primary" data-view="subscription" data-title="الاشتراك الشهري">اذهب لصفحة الاشتراك</a>`); rebindInlineNav(target); return; }

  const { data: materials, error } = await supabase.from('materials').select('*').eq('teacher_id', profile.teacher_id).eq('stage', profile.stage).order('created_at', { ascending: false });
  if (error) { target.innerHTML = empty(genericError); return; }
  if (!materials.length) { target.innerHTML = empty('لا توجد مواد مضافة بعد.'); return; }

  target.innerHTML = materials.map((m) => { const info = MATERIAL_LABELS[m.type]; return `<article class="material-card"><div class="meta-col"><span class="chip ${info.chip}">${info.icon} ${info.label}</span><h4>${esc(m.title)}</h4></div><div class="row-actions"><a class="button button-secondary" href="${esc(m.file_url)}" target="_blank">فتح</a></div></article>`; }).join('');
}

function rebindInlineNav(scope) {
  scope.querySelectorAll('[data-view]').forEach((el) => el.addEventListener('click', () => document.querySelector(`.portal-nav [data-view="${el.dataset.view}"], .mobile-nav [data-view="${el.dataset.view}"]`)?.click()));
}

/* ============================== دفع الكورسات (عرض الحالة فقط) ============================== */
async function loadCoursePayments() {
  const target = document.querySelector('[data-course-payments]');
  if (!target) return;
  target.innerHTML = '<p class="loading">جاري التحميل…</p>';
  const { data: requests, error } = await supabase.from('payment_requests').select('*, courses(title)').eq('student_id', user.id).order('created_at', { ascending: false });
  if (error) { target.innerHTML = empty(genericError); return; }
  target.innerHTML = requests.length ? requests.map((r) => `<div class="list-row"><div class="list-icon">💳</div><div><strong>${esc(r.courses?.title || 'كورس')}</strong><span>${money(r.amount)} · ${new Date(r.created_at).toLocaleDateString('ar-EG')}</span></div>
    <span class="row-end"><span class="status-badge ${r.status}">${r.status === 'approved' ? 'مقبول ✓' : r.status === 'rejected' ? 'مرفوض' : 'قيد المراجعة'}</span></span></div>`).join('') : empty('لا توجد طلبات دفع كورسات حتى الآن.', '<a class="button button-primary" href="courses.html">تصفح الكورسات</a>');
}

/* ============================== الاشتراك الشهري (محدث بالكامل) ============================== */
async function loadSubscriptionView() {
  const target = document.querySelector('[data-subscription-view]');
  if (!target) return;
  target.innerHTML = '<p class="loading">جاري التحميل…</p>';

  if (!profile.teacher_id) {
    target.innerHTML = empty('لازم تحدد مدرسك أولًا من صفحة "حسابي" حتى تقدر تدفع الاشتراك الشهري.',
      '<button class="button button-primary" data-view="profile" data-title="حسابي">اذهب لصفحة حسابي</button>');
    rebindInlineNav(target);
    return;
  }

  const { data: teacher } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', profile.teacher_id)
    .single();

  const sub = await getSubscriptionStatus();

  // حساب الأيام المتبقية
  let daysRemaining = null;
  let statusDisplay = '';

  if (sub.subscription) {
    if (sub.active) {
      const end = new Date(sub.subscription.end_date);
      const now = new Date();
      const diffTime = end.getTime() - now.getTime();
      daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      statusDisplay = `
        <div class="subscription-status active">
          <span class="status-badge approved">نشط</span>
          <div class="subscription-dates">
            <div>تاريخ البدء: ${new Date(sub.subscription.start_date).toLocaleDateString('ar-EG')}</div>
            <div>تاريخ الانتهاء: ${new Date(sub.subscription.end_date).toLocaleDateString('ar-EG')}</div>
            <div><strong>المتبقي: ${daysRemaining} يوم</strong></div>
          </div>
        </div>
      `;
    } else if (sub.subscription.status === 'cancelled') {
      statusDisplay = `
        <div class="subscription-status cancelled">
          <span class="status-badge rejected">تم الإلغاء</span>
          <p>تم إلغاء الاشتراك الشهري بواسطة المدرس.</p>
          ${sub.subscription.cancelled_at ? `<small>تاريخ الإلغاء: ${new Date(sub.subscription.cancelled_at).toLocaleDateString('ar-EG')}</small>` : ''}
        </div>
      `;
    } else if (sub.subscription.status === 'pending') {
      statusDisplay = `
        <div class="subscription-status pending">
          <span class="status-badge pending">بانتظار مراجعة المدرس</span>
        </div>
      `;
    } else if (sub.subscription.status === 'rejected') {
      statusDisplay = `
        <div class="subscription-status rejected">
          <span class="status-badge rejected">تم الرفض</span>
          <p>تم رفض طلب الاشتراك الشهري. يمكنك تقديم طلب جديد.</p>
        </div>
      `;
    } else if (sub.subscription.status === 'approved' && sub.isExpired) {
      statusDisplay = `
        <div class="subscription-status expired">
          <span class="status-badge rejected">منتهي</span>
          <div class="subscription-dates">
            <div>تاريخ البدء: ${new Date(sub.subscription.start_date).toLocaleDateString('ar-EG')}</div>
            <div>تاريخ الانتهاء: ${new Date(sub.subscription.end_date).toLocaleDateString('ar-EG')}</div>
            <div><strong>انتهى الاشتراك</strong></div>
          </div>
        </div>
      `;
    }
  } else {
    statusDisplay = `
      <div class="subscription-status no-subscription">
        <span class="status-badge rejected">غير مشترك</span>
        <p>لم يتم الدفع بعد لهذا الشهر</p>
      </div>
    `;
  }

  target.innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <h3>الاشتراك الشهري عند الأستاذ ${esc(teacher?.full_name || '')}</h3>
      </div>
      <div style="margin:10px 0 20px;">
        <p class="course-meta">هذا الاشتراك منفصل تمامًا عن دفع الكورسات، وهو الذي يفتح لك الاختبارات والشيتات والسبورة والمذكرات الخاصة بمرحلتك عند هذا المدرس.</p>
        ${statusDisplay}
      </div>
      ${(!sub.subscription || sub.subscription.status !== 'approved' || sub.isExpired) && sub.subscription?.status !== 'cancelled' ? `
        <form data-subscription-form>
          <label class="field">قيمة الاشتراك (ج.م)<input name="amount" type="number" min="0" step="1" required></label>
          <label class="field">طريقة الدفع<select name="method" required><option value="cash">نقدي داخل السنتر</option><option value="wallet">محفظة إلكترونية</option><option value="bank_transfer">تحويل بنكي</option></select></label>
          <label class="field">رقم العملية (اختياري)<input name="reference_number" maxlength="100"></label>
          <button class="button button-primary" type="submit">إرسال طلب الاشتراك الشهري</button>
        </form>
      ` : ''}
    </div>
  `;

  target.querySelector('[data-subscription-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.target).entries());
    const submit = event.target.querySelector('button');
    submit.disabled = true;
    const month = currentMonthStart();
    const { error } = await supabase.from('subscription_payments').upsert({
      student_id: user.id, teacher_id: profile.teacher_id, month, amount: Number(values.amount) || 0, method: values.method,
      reference_number: values.reference_number || null, status: 'pending',
    }, { onConflict: 'student_id,teacher_id,month' });
    submit.disabled = false;
    if (error) { alert(genericError); return; }
    notify(profile.teacher_id, { title: 'اشتراك شهري جديد', message: `أرسل الطالب ${profile.full_name} طلب اشتراك شهري`, type: 'new_subscription', relatedType: 'subscription', relatedId: user.id });
    loadSubscriptionView();
  });
}

/* ============================== حسابي (اختيار المدرس) ============================== */
async function loadProfileView() {
  const target = document.querySelector('[data-teacher-select-wrap]');
  if (!target) return;
  const { data: teachers } = await supabase.from('profiles').select('id, full_name').eq('role', 'teacher').order('full_name');
  const select = target.querySelector('select');
  select.innerHTML = `<option value="">بدون مدرس محدد</option>${(teachers || []).map((t) => `<option value="${t.id}" ${t.id === profile.teacher_id ? 'selected' : ''}>${esc(t.full_name)}</option>`).join('')}`;
}

function setupTeacherSelectForm() {
  const form = document.querySelector('[data-teacher-select-form]');
  if (!form) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const teacherId = new FormData(form).get('teacher_id') || null;
    const { error } = await supabase.from('profiles').update({ teacher_id: teacherId }).eq('id', user.id);
    if (error) { setStatus('تعذر حفظ المدرس.'); return; }
    const isNewTeacher = teacherId && teacherId !== profile.teacher_id;
    profile.teacher_id = teacherId;
    setStatus('تم حفظ مدرسك بنجاح.', 'success');
    if (isNewTeacher) {
      notify(teacherId, { title: 'طالب جديد', message: `ربط الطالب ${profile.full_name} حسابه بك`, type: 'new_student', relatedType: 'student', relatedId: user.id });
    }
  });
}

/* ==================== إضافات واجهة: إحصائيات سريعة + آخر نشاط + قائمة الإشعارات ==================== */
async function loadNotifications() {
  const dropdown = document.querySelector('[data-notif-dropdown]');
  if (!dropdown) return;
  const items = await fetchNotifications(user.id);
  const bodyHtml = renderNotifList(items);
  dropdown.innerHTML = `<div class="notif-head">الإشعارات</div><div data-notif-body>${bodyHtml}</div>
    <div class="notif-dropdown-foot"><button class="button button-text" style="width:auto;padding:4px 8px;font-size:.78rem" data-notif-mark-all>تحديد الكل كمقروء</button></div>`;
  dropdown.querySelectorAll('[data-notif-id]').forEach((btn) => btn.addEventListener('click', async () => { await markRead(btn.dataset.notifId); refreshNotifBadge(); }));
  dropdown.querySelector('[data-notif-mark-all]')?.addEventListener('click', async (event) => { event.stopPropagation(); await markAllRead(user.id); loadNotifications(); refreshNotifBadge(); });
}

async function refreshNotifBadge() {
  const toggle = document.querySelector('[data-notif-toggle]');
  if (!toggle) return;
  const count = await unreadCount(user.id);
  let badge = toggle.querySelector('.notif-badge');
  if (count > 0) {
    if (!badge) { badge = document.createElement('span'); badge.className = 'notif-badge'; toggle.appendChild(badge); }
    badge.textContent = count > 9 ? '9+' : String(count);
  } else if (badge) { badge.remove(); }
}

function setNotifDropdown() {
  const toggle = document.querySelector('[data-notif-toggle]');
  const dropdown = document.querySelector('[data-notif-dropdown]');
  if (!toggle || !dropdown) return;
  toggle.addEventListener('click', (event) => { event.stopPropagation(); dropdown.classList.toggle('open'); if (dropdown.classList.contains('open')) loadNotifications(); });
  document.addEventListener('click', (event) => { if (!dropdown.contains(event.target) && event.target !== toggle) dropdown.classList.remove('open'); });
  refreshNotifBadge();
  subscribeRealtimeNotifications(user.id, () => refreshNotifBadge());
}

async function loadDashboardStats() {
  const quizzesEl = document.querySelector('[data-stat-quizzes]');
  const materialsEl = document.querySelector('[data-stat-materials]');
  const subEl = document.querySelector('[data-stat-subscription]');
  const subSubEl = document.querySelector('[data-stat-subscription-sub]');
  const subSubEl2 = document.querySelector('[data-stat-subscription-sub-2]');
  const subBadgeEl = document.querySelector('[data-stat-subscription-badge]');
  if (!quizzesEl && !materialsEl && !subEl) return;

  const sub = await getSubscriptionStatus();
  const subText = sub.active ? 'نشط' : (sub.hasTeacher ? 'غير نشط' : '—');
  const subSubText = !sub.hasTeacher ? 'حدد مدرسك أولًا من صفحة حسابي' : sub.active ? 'ساري ✓' : sub.status === 'pending' ? 'بانتظار مراجعة المدرس' : sub.status === 'cancelled' ? 'ملغي' : 'لم يتم الدفع بعد';
  if (subEl) subEl.textContent = subText;
  if (subSubEl) subSubEl.textContent = subSubText;
  if (subSubEl2) subSubEl2.textContent = subSubText;
  if (subBadgeEl) {
    let badgeClass = 'rejected';
    if (sub.active) badgeClass = 'approved';
    else if (sub.status === 'pending') badgeClass = 'pending';
    else if (sub.status === 'cancelled') badgeClass = 'rejected';
    subBadgeEl.textContent = subText;
    subBadgeEl.className = `status-badge ${badgeClass}`;
  }

  if (!sub.hasTeacher || !sub.active) {
    if (quizzesEl) quizzesEl.textContent = '🔒';
    if (materialsEl) materialsEl.textContent = '🔒';
    return;
  }

  const [{ count: quizzesCount }, { count: materialsCount }] = await Promise.all([
    supabase.from('quizzes').select('id', { count: 'exact', head: true }).eq('teacher_id', profile.teacher_id).eq('stage', profile.stage).eq('is_published', true),
    supabase.from('materials').select('id', { count: 'exact', head: true }).eq('teacher_id', profile.teacher_id).eq('stage', profile.stage),
  ]);
  if (quizzesEl) quizzesEl.textContent = quizzesCount ?? 0;
  if (materialsEl) materialsEl.textContent = materialsCount ?? 0;
}

async function loadActivityFeed() {
  const target = document.querySelector('[data-activity-list]');
  if (!target) return;
  target.innerHTML = '<p class="loading">جاري التحميل…</p>';

  const [{ data: enrollments }, { data: attempts }] = await Promise.all([
    supabase.from('enrollments').select('created_at, course:courses(title)').eq('student_id', user.id).order('created_at', { ascending: false }).limit(5),
    supabase.from('quiz_attempts').select('created_at, score, total, quiz:quizzes(title)').eq('student_id', user.id).order('created_at', { ascending: false }).limit(5),
  ]);

  const items = [
    ...((enrollments || []).map((e) => ({ date: e.created_at, icon: '📚', text: `انضممت إلى كورس "${esc(e.course?.title || '—')}"` }))),
    ...((attempts || []).map((a) => ({ date: a.created_at, icon: '📝', text: `قدمت اختبار "${esc(a.quiz?.title || '—')}" وحصلت على ${a.score}/${a.total}` }))),
  ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6);

  target.innerHTML = items.length
    ? items.map((i) => `<div class="activity-row"><span class="activity-icon">${i.icon}</span><div><p>${i.text}</p><span class="activity-date">${new Date(i.date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' })}</span></div></div>`).join('')
    : empty('لا يوجد نشاط بعد. ابدأ رحلتك التعليمية!');
}

/* ============================== تشغيل ============================== */
document.querySelectorAll('[data-user-name]').forEach((n) => { n.textContent = esc(profile.full_name); });
setNavigation();
setMobileMenu();
loadMyCourses();
setupTeacherSelectForm();
setNotifDropdown();
loadDashboardStats();
loadActivityFeed();
loadContinueWatching();