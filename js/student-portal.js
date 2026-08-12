import { supabase, esc, money, genericError, currentMonthStart } from './supabase-client.js';
import { requireAuth } from './auth-guard.js';

const MATERIAL_LABELS = { sheet: { label: 'شيت', chip: 'chip-sheet', icon: '📄' }, board: { label: 'سبورة', chip: 'chip-board', icon: '🖼' }, note: { label: 'مذكرة', chip: 'chip-note', icon: '📘' } };

const session = await requireAuth('student');
if (!session) throw new Error('redirecting');
const { user } = session;
let profile = session.profile; // قد تتغيّر بعد اختيار مدرس

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

function onViewOpen(view) {
  if (view === 'quizzes') loadQuizzes();
  if (view === 'explainer-videos') loadExplainerVideos();
  if (view === 'materials') loadMaterials();
  if (view === 'subscription') loadSubscriptionView();
  if (view === 'payments') loadCoursePayments();
  if (view === 'profile') loadProfileView();
}

/* ============================== نظرة عامة + كورساتي ============================== */
function courseCard(course) {
  return `<article class="course-card"><div class="course-cover">${course.cover_image_url ? `<img src="${esc(course.cover_image_url)}" alt="${esc(course.title)}">` : '◒'}</div><div class="course-card-body">
    <div><div class="course-meta">${esc(course.subject || 'محتوى تعليمي')}</div><h3>${esc(course.title)}</h3><p class="course-meta">يمكنك متابعة دروس الكورس.</p></div>
    <div class="course-footer"><span class="price">مفعّل</span><a class="button button-secondary" href="playlist-view.html?course=${encodeURIComponent(course.id)}">عرض الدروس</a></div>
  </div></article>`;
}

async function loadMyCourses() {
  const targets = document.querySelectorAll('[data-student-courses]');
  if (!targets.length) return;
  targets.forEach((t) => { t.innerHTML = '<p class="loading">جاري تحميل كورساتك…</p>'; });
  const { data, error } = await supabase.from('enrollments').select('course:courses(*)').eq('student_id', user.id);
  const courses = error ? [] : (data || []).map((r) => r.course).filter(Boolean);
  const content = courses.length ? courses.map(courseCard).join('') : empty('لا توجد كورسات مفعّلة في حسابك حاليًا.', '<a class="button button-primary" href="courses.html">تصفح الكورسات</a>');
  targets.forEach((t) => { t.innerHTML = content; });
  document.querySelector('[data-course-count]')?.replaceChildren(document.createTextNode(String(courses.length)));
}

/* ============================== حالة الاشتراك الشهري ============================== */
async function getSubscriptionStatus() {
  if (!profile.teacher_id) return { hasTeacher: false, active: false };
  const month = currentMonthStart();
  const { data } = await supabase.from('subscription_payments').select('status').eq('student_id', user.id).eq('teacher_id', profile.teacher_id).eq('month', month).maybeSingle();
  return { hasTeacher: true, active: data?.status === 'approved', pendingStatus: data?.status };
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

/* ============================== الاشتراك الشهري (مكان مختلف تمامًا عن دفع الكورسات) ============================== */
async function loadSubscriptionView() {
  const target = document.querySelector('[data-subscription-view]');
  if (!target) return;
  target.innerHTML = '<p class="loading">جاري التحميل…</p>';

  if (!profile.teacher_id) { target.innerHTML = empty('لازم تحدد مدرسك أولًا من صفحة "حسابي" حتى تقدر تدفع الاشتراك الشهري.', '<button class="button button-primary" data-view="profile" data-title="حسابي">اذهب لصفحة حسابي</button>'); rebindInlineNav(target); return; }

  const { data: teacher } = await supabase.from('profiles').select('full_name').eq('id', profile.teacher_id).single();
  const month = currentMonthStart();
  const { data: sub } = await supabase.from('subscription_payments').select('*').eq('student_id', user.id).eq('teacher_id', profile.teacher_id).eq('month', month).maybeSingle();

  const statusHtml = !sub ? '<span class="status-badge rejected">لم يتم الدفع بعد لهذا الشهر</span>' : sub.status === 'approved' ? '<span class="status-badge approved">مفعّل لهذا الشهر ✓</span>' : sub.status === 'pending' ? '<span class="status-badge pending">بانتظار مراجعة المدرس</span>' : '<span class="status-badge rejected">تم رفض الطلب — أرسل من جديد</span>';

  target.innerHTML = `<div class="panel">
    <h3>الاشتراك الشهري عند الأستاذ ${esc(teacher?.full_name || '')}</h3>
    <p class="course-meta" style="margin:10px 0 16px">هذا الاشتراك منفصل تمامًا عن دفع الكورسات، وهو الذي يفتح لك الاختبارات والشيتات والسبورة والمذكرات الخاصة بمرحلتك عند هذا المدرس. الحالة: ${statusHtml}</p>
    ${sub?.status === 'approved' ? '' : `<form data-subscription-form>
      <label class="field">قيمة الاشتراك (ج.م)<input name="amount" type="number" min="0" step="1" required></label>
      <label class="field">طريقة الدفع<select name="method" required><option value="cash">نقدي داخل السنتر</option><option value="wallet">محفظة إلكترونية</option><option value="bank_transfer">تحويل بنكي</option></select></label>
      <label class="field">رقم العملية (اختياري)<input name="reference_number" maxlength="100"></label>
      <button class="button button-primary" type="submit">إرسال طلب الاشتراك الشهري</button>
    </form>`}
  </div>`;

  target.querySelector('[data-subscription-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.target).entries());
    const submit = event.target.querySelector('button');
    submit.disabled = true;
    const { error } = await supabase.from('subscription_payments').upsert({
      student_id: user.id, teacher_id: profile.teacher_id, month, amount: Number(values.amount) || 0, method: values.method,
      reference_number: values.reference_number || null, status: 'pending',
    }, { onConflict: 'student_id,teacher_id,month' });
    submit.disabled = false;
    if (error) { alert(genericError); return; }
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
    profile.teacher_id = teacherId;
    setStatus('تم حفظ مدرسك بنجاح.', 'success');
  });
}

/* ============================== تشغيل ============================== */
document.querySelectorAll('[data-user-name]').forEach((n) => { n.textContent = esc(profile.full_name); });
setNavigation();
loadMyCourses();
setupTeacherSelectForm();