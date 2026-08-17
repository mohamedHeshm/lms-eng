import { supabase, esc, money, genericError, currentMonthStart } from './supabase-client.js';
import { requireAuth } from './auth-guard.js';

const STAGES = ['الأولى الثانوية', 'الثانية الثانوية', 'الثالثة الثانوية'];
const MATERIAL_LABELS = { sheet: { label: 'شيت', chip: 'chip-sheet', icon: '📄' }, board: { label: 'سبورة', chip: 'chip-board', icon: '🖼' }, note: { label: 'مذكرة', chip: 'chip-note', icon: '📘' } };

const session = await requireAuth('teacher');
if (!session) throw new Error('redirecting');
const { user, profile } = session;

function empty(message, action = '') { return `<div class="empty-state">${message}${action ? `<div style="margin-top:12px">${action}</div>` : ''}</div>`; }
function setStatus(message, type = 'error') { const node = document.querySelector('[data-portal-status]'); if (node) { node.textContent = message; node.className = `status-message is-visible ${type}`; } }
function stageOptions(selected = '') { return STAGES.map((s) => `<option value="${esc(s)}" ${s === selected ? 'selected' : ''}>${esc(s)}</option>`).join(''); }

/* ============================== نافيجيشن اللوحة ============================== */
function setNavigation() {
  const buttons = document.querySelectorAll('[data-view]');
  const views = document.querySelectorAll('.view');
  buttons.forEach((button) => button.addEventListener('click', () => {
    const selected = button.dataset.view;
    buttons.forEach((item) => item.classList.toggle('active', item.dataset.view === selected));
    views.forEach((view) => view.classList.toggle('active', view.id === selected));
    document.querySelector('[data-page-title]').textContent = button.dataset.title || 'لوحة التحكم';
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
  if (view === 'content') loadMaterials();
  if (view === 'students') loadStudents();
  if (view === 'subscriptions') loadSubscriptionRequests();
}

/* ============================== نظرة عامة ============================== */
async function loadOverview() {
  document.querySelectorAll('[data-user-name]').forEach((n) => { n.textContent = esc(profile.full_name); });
  const [{ count: courseCount }, { count: studentCount }, { count: pendingSubs }] = await Promise.all([
    supabase.from('courses').select('id', { count: 'exact', head: true }).eq('teacher_id', user.id),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('teacher_id', user.id).eq('role', 'student'),
    supabase.from('subscription_payments').select('id', { count: 'exact', head: true }).eq('teacher_id', user.id).eq('status', 'pending'),
  ]);
  const setNum = (sel, value) => { const el = document.querySelector(sel); if (el) el.textContent = String(value ?? 0); };
  setNum('[data-course-count]', courseCount);
  setNum('[data-student-count]', studentCount);
  setNum('[data-pending-subs]', pendingSubs);
}

/* ============================== الكورسات + الدروس ============================== */
function courseCardHtml(course) {
  return `<article class="course-card">
    <div class="course-cover">${course.cover_image_url ? `<img src="${esc(course.cover_image_url)}" alt="${esc(course.title)}">` : '◒'}</div>
    <div class="course-card-body">
      <div><div class="course-meta">${esc(course.subject || 'محتوى تعليمي')} · ${esc(course.stage || '')}</div><h3>${esc(course.title)}</h3>
      <p class="course-meta">${course.is_published ? '🟢 منشور' : '🟡 مسودة'}</p></div>
      <div class="course-footer"><span class="price">${money(course.price)}</span>
        <button class="button button-secondary" data-manage-course="${course.id}">إدارة الدروس</button>
      </div>
    </div>
  </article>`;
}

async function loadTeacherCourses() {
  const targets = document.querySelectorAll('[data-teacher-courses]');
  if (!targets.length) return;
  targets.forEach((t) => { t.innerHTML = '<p class="loading">جاري تحميل الكورسات…</p>'; });
  const { data: courses, error } = await supabase.from('courses').select('*').eq('teacher_id', user.id).order('created_at', { ascending: false });
  if (error) { targets.forEach((t) => { t.innerHTML = empty(genericError); }); return; }
  const content = courses.length ? courses.map(courseCardHtml).join('') : empty('لم تضف أي كورسات بعد.');
  targets.forEach((t) => { t.innerHTML = content; });
  document.querySelectorAll('[data-manage-course]').forEach((btn) => btn.addEventListener('click', () => openLessonManager(btn.dataset.manageCourse)));
}

function setupCreateCourseForm() {
  const form = document.querySelector('[data-create-course]');
  if (!form) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    const values = Object.fromEntries(new FormData(form).entries());

    let coverImageUrl = null;
    const coverFile = form.querySelector('[name="cover_image"]')?.files?.[0];
    if (coverFile) {
      setStatus('جارٍ رفع صورة الكورس…', 'success');
      const ext = coverFile.name.split('.').pop();
      const path = `${user.id}_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('course-covers').upload(path, coverFile);
      if (uploadError) { submit.disabled = false; setStatus('تعذر رفع صورة الكورس: ' + uploadError.message); return; }
      coverImageUrl = supabase.storage.from('course-covers').getPublicUrl(path).data.publicUrl;
    }

    const { error } = await supabase.from('courses').insert({
      teacher_id: user.id, title: values.title, subject: values.subject, stage: values.stage,
      price: Number(values.price || 0), description: values.description, cover_image_url: coverImageUrl, is_published: false,
    });
    submit.disabled = false;
    if (error) { setStatus('تعذر حفظ الكورس. حاول مرة أخرى.'); return; }
    form.reset();
    setStatus('تم حفظ الكورس كمسودة. أضف الدروس ثم انشره من إدارة الكورسات.', 'success');
    loadTeacherCourses();
  });
}

async function openLessonManager(courseId) {
  const modalHost = document.querySelector('[data-lesson-modal]');
  if (!modalHost) return;
  modalHost.classList.add('active');
  modalHost.innerHTML = `<div class="panel" style="max-width:720px;margin:30px auto;">
    <div class="panel-head"><h3>إدارة دروس الكورس</h3><button class="button button-text" data-close-modal>إغلاق ✕</button></div>
    <div class="content-grid" style="grid-template-columns:1fr;">
      <form data-add-lesson class="form-grid">
        <label class="field">عنوان الدرس<input name="title" required></label>
        <label class="field">رابط الفيديو (يوتيوب)<input name="video_url" required placeholder="https://youtube.com/watch?v=..."></label>
        <label class="field">سبورة الدرس PDF (اختياري)<input type="file" name="board_pdf" accept="application/pdf"></label>
        <label class="field">شرح كتابي PDF (اختياري)<input type="file" name="explanation_pdf" accept="application/pdf"></label>
        <button class="button button-primary" type="submit" style="grid-column:1/-1">إضافة الدرس</button>
      </form>
      <div data-lessons-list></div>
      <div style="display:flex;gap:10px;justify-content:flex-end;border-top:1px solid var(--border);padding-top:14px;">
        <button class="button button-secondary" data-toggle-publish>—</button>
      </div>
    </div>
  </div>`;
  modalHost.querySelector('[data-close-modal]').addEventListener('click', () => { modalHost.classList.remove('active'); modalHost.innerHTML = ''; });

  const { data: course } = await supabase.from('courses').select('*').eq('id', courseId).single();
  const publishBtn = modalHost.querySelector('[data-toggle-publish]');
  const renderPublishBtn = () => { publishBtn.textContent = course.is_published ? '⏸ إخفاء الكورس (تحويله مسودة)' : '🚀 نشر الكورس'; };
  renderPublishBtn();
  publishBtn.addEventListener('click', async () => {
    const { error } = await supabase.from('courses').update({ is_published: !course.is_published }).eq('id', courseId);
    if (error) { alert(genericError); return; }
    course.is_published = !course.is_published;
    renderPublishBtn();
    loadTeacherCourses();
  });

  async function renderLessons() {
    const list = modalHost.querySelector('[data-lessons-list]');
    list.innerHTML = '<p class="loading">جاري التحميل…</p>';
    const { data: lessons, error } = await supabase.from('course_lessons').select('*').eq('course_id', courseId).order('sort_order', { ascending: true });
    if (error) { list.innerHTML = empty(genericError); return; }
    list.innerHTML = lessons.length ? lessons.map((l) => `<div class="lesson-card">
      <div class="meta-col">
        <h4>▶ ${esc(l.title)}</h4>
        <div class="row-actions" style="margin-top:8px">
          ${l.board_pdf_url ? `<a class="button button-secondary" style="width:auto;padding:6px 12px" href="${esc(l.board_pdf_url)}" target="_blank">🖼 سبورة الدرس</a>` : `<span class="course-meta">لا توجد سبورة</span>`}
          ${l.explanation_pdf_url ? `<a class="button button-secondary" style="width:auto;padding:6px 12px" href="${esc(l.explanation_pdf_url)}" target="_blank">📘 شرح كتابي</a>` : `<span class="course-meta">لا يوجد شرح كتابي</span>`}
        </div>
      </div>
      <div class="row-actions">
        <button class="button button-secondary" data-manage-sheet="${l.id}" data-lesson-title="${esc(l.title)}">📝 شيت الدرس</button>
        <button class="button button-danger" data-del-lesson="${l.id}">حذف</button>
      </div>
    </div>`).join('') : empty('لا توجد دروس بعد. أضف أول درس من الأعلى.');
    list.querySelectorAll('[data-manage-sheet]').forEach((btn) => btn.addEventListener('click', () => openLessonSheetManager(btn.dataset.manageSheet, btn.dataset.lessonTitle)));
    list.querySelectorAll('[data-del-lesson]').forEach((btn) => btn.addEventListener('click', async () => {
      if (!confirm('حذف هذا الدرس؟')) return;
      await supabase.from('course_lessons').delete().eq('id', btn.dataset.delLesson);
      renderLessons();
    }));
  }
  renderLessons();

  modalHost.querySelector('[data-add-lesson]').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.target;
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    const values = Object.fromEntries(new FormData(form).entries());

    const boardFile = form.querySelector('[name="board_pdf"]')?.files?.[0];
    const explanationFile = form.querySelector('[name="explanation_pdf"]')?.files?.[0];

    async function uploadLessonPdf(file, kind) {
      if (!file) return null;
      const path = `${kind}/${user.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.pdf`;
      const { error: uploadError } = await supabase.storage.from('lesson-files').upload(path, file);
      if (uploadError) throw uploadError;
      return supabase.storage.from('lesson-files').getPublicUrl(path).data.publicUrl;
    }

    let boardPdfUrl = null;
    let explanationPdfUrl = null;
    try {
      boardPdfUrl = await uploadLessonPdf(boardFile, 'board');
      explanationPdfUrl = await uploadLessonPdf(explanationFile, 'explanation');
    } catch (uploadError) {
      submit.disabled = false;
      alert('تعذر رفع أحد ملفات الـ PDF: ' + uploadError.message);
      return;
    }

    const { count: existingCount } = await supabase.from('course_lessons').select('id', { count: 'exact', head: true }).eq('course_id', courseId);
    const { error } = await supabase.from('course_lessons').insert({
      course_id: courseId, title: values.title, video_url: values.video_url,
      board_pdf_url: boardPdfUrl, explanation_pdf_url: explanationPdfUrl, sort_order: existingCount || 0,
    });
    submit.disabled = false;
    if (error) { alert(genericError); return; }
    form.reset();
    renderLessons();
  });
}

/* ============================== شيت الدرس (اختبار قصير بعد كل فيديو) ============================== */
async function openLessonSheetManager(lessonId, lessonTitle) {
  const modalHost = document.querySelector('[data-lesson-modal]');
  modalHost.classList.add('active');
  modalHost.innerHTML = `<div class="panel" style="max-width:800px;margin:30px auto;max-height:88vh;overflow:auto;">
    <div class="panel-head"><h3>شيت درس: ${esc(lessonTitle)}</h3><button class="button button-text" data-close-modal>إغلاق ✕</button></div>
    <div style="display:flex;gap:10px;margin-bottom:16px;">
      <button class="button button-primary" data-tab="questions" style="width:auto;padding:9px 18px">الأسئلة</button>
      <button class="button button-secondary" data-tab="results" style="width:auto;padding:9px 18px">نتائج الطلاب</button>
    </div>
    <div data-tab-panel="questions">
      <form data-add-sheet-question class="panel" style="margin-bottom:16px;">
        <label class="field">نص السؤال<textarea name="question_text" rows="2" required></textarea></label>
        <div data-options-wrap>
          ${[0, 1, 2, 3].map((i) => `<div class="option-row"><input type="radio" name="correct_index" value="${i}" ${i === 0 ? 'checked' : ''}><input type="text" name="option_${i}" placeholder="اختيار ${i + 1}" required></div>`).join('')}
        </div>
        <button class="button button-primary" type="submit" style="margin-top:10px">إضافة السؤال</button>
      </form>
      <div data-sheet-questions-list></div>
    </div>
    <div data-tab-panel="results" style="display:none"><div data-sheet-results-list></div></div>
  </div>`;
  modalHost.querySelector('[data-close-modal]').addEventListener('click', () => { modalHost.classList.remove('active'); modalHost.innerHTML = ''; });
  modalHost.querySelectorAll('[data-tab]').forEach((btn) => btn.addEventListener('click', () => {
    modalHost.querySelectorAll('[data-tab]').forEach((b) => b.className = `button ${b === btn ? 'button-primary' : 'button-secondary'}`);
    btn.style.width = 'auto'; btn.style.padding = '9px 18px';
    modalHost.querySelectorAll('[data-tab-panel]').forEach((p) => { p.style.display = p.dataset.tabPanel === btn.dataset.tab ? 'block' : 'none'; });
    if (btn.dataset.tab === 'results') renderSheetResults();
  }));

  async function renderSheetQuestions() {
    const list = modalHost.querySelector('[data-sheet-questions-list]');
    list.innerHTML = '<p class="loading">جاري التحميل…</p>';
    const { data: questions, error } = await supabase.from('lesson_sheet_questions').select('*').eq('lesson_id', lessonId).order('sort_order', { ascending: true });
    if (error) { list.innerHTML = empty(genericError); return; }
    list.innerHTML = questions.length ? questions.map((q, i) => `
      <div class="quiz-question-block">
        <strong>س${i + 1}: ${esc(q.question_text)}</strong>
        <ul style="margin:10px 0 0;padding-inline-start:20px;">${q.options.map((opt, idx) => `<li style="${idx === q.correct_index ? 'color:var(--success);font-weight:700' : ''}">${esc(opt)} ${idx === q.correct_index ? '✓' : ''}</li>`).join('')}</ul>
        <button class="button button-danger" style="width:auto;margin-top:10px;padding:7px 14px" data-del-sheet-question="${q.id}">حذف السؤال</button>
      </div>`).join('') : empty('لا توجد أسئلة بعد. أول ما تضيف سؤال، هيظهر لكل طالب يخلّص هذا الفيديو.');
    list.querySelectorAll('[data-del-sheet-question]').forEach((btn) => btn.addEventListener('click', async () => {
      await supabase.from('lesson_sheet_questions').delete().eq('id', btn.dataset.delSheetQuestion);
      renderSheetQuestions();
    }));
  }
  renderSheetQuestions();

  modalHost.querySelector('[data-add-sheet-question]').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.target;
    const values = Object.fromEntries(new FormData(form).entries());
    const options = [0, 1, 2, 3].map((i) => values[`option_${i}`]);
    const { data: existing } = await supabase.from('lesson_sheet_questions').select('id').eq('lesson_id', lessonId);
    const { error } = await supabase.from('lesson_sheet_questions').insert({
      lesson_id: lessonId, question_text: values.question_text, options, correct_index: Number(values.correct_index), sort_order: (existing?.length || 0),
    });
    if (error) { alert(genericError); return; }
    form.reset();
    renderSheetQuestions();
  });

  async function renderSheetResults() {
    const list = modalHost.querySelector('[data-sheet-results-list]');
    list.innerHTML = '<p class="loading">جاري التحميل…</p>';
    const { data: attempts, error } = await supabase.from('lesson_sheet_attempts').select('*, profiles!student_id(full_name)').eq('lesson_id', lessonId).order('submitted_at', { ascending: false });
    if (error) { list.innerHTML = empty(genericError); return; }
    list.innerHTML = attempts.length ? `<table class="subscription-table"><thead><tr><th>الطالب</th><th>الدرجة</th><th>التاريخ</th></tr></thead><tbody>
      ${attempts.map((a) => `<tr><td>${esc(a.profiles?.full_name || '—')}</td><td>${a.score} / ${a.total}</td><td>${new Date(a.submitted_at).toLocaleString('ar-EG')}</td></tr>`).join('')}
      </tbody></table>` : empty('لا توجد محاولات بعد.');
  }
}

/* ============================== الاختبارات أونلاين ============================== */
function quizCardHtml(quiz) {
  return `<article class="quiz-card">
    <div class="meta-col"><span class="chip chip-stage">${esc(quiz.stage)}</span><h4>${esc(quiz.title)}</h4>
      <span class="course-meta">${quiz.is_published ? '🟢 منشور للطلاب' : '🟡 مسودة'} · ${quiz.duration_minutes ? quiz.duration_minutes + ' دقيقة' : 'بدون وقت محدد'}</span></div>
    <div class="row-actions">
      <button class="button button-secondary" data-manage-quiz="${quiz.id}">الأسئلة والنتائج</button>
      <button class="button ${quiz.is_published ? 'button-secondary' : 'button-primary'}" data-toggle-quiz="${quiz.id}">${quiz.is_published ? 'إخفاء' : 'نشر'}</button>
      <button class="button button-danger" data-del-quiz="${quiz.id}">حذف</button>
    </div>
  </article>`;
}

async function loadQuizzes() {
  const target = document.querySelector('[data-quizzes-list]');
  if (!target) return;
  target.innerHTML = '<p class="loading">جاري التحميل…</p>';
  const { data: quizzes, error } = await supabase.from('quizzes').select('*').eq('teacher_id', user.id).order('created_at', { ascending: false });
  if (error) { target.innerHTML = empty(genericError); return; }
  target.innerHTML = quizzes.length ? quizzes.map(quizCardHtml).join('') : empty('لا توجد اختبارات بعد. أنشئ أول اختبار من الأعلى.');

  target.querySelectorAll('[data-manage-quiz]').forEach((btn) => btn.addEventListener('click', () => openQuizManager(btn.dataset.manageQuiz)));
  target.querySelectorAll('[data-toggle-quiz]').forEach((btn) => btn.addEventListener('click', async () => {
    const quiz = quizzes.find((q) => q.id === btn.dataset.toggleQuiz);
    const { error } = await supabase.from('quizzes').update({ is_published: !quiz.is_published }).eq('id', quiz.id);
    if (error) { alert(genericError); return; }
    loadQuizzes();
  }));
  target.querySelectorAll('[data-del-quiz]').forEach((btn) => btn.addEventListener('click', async () => {
    if (!confirm('حذف هذا الاختبار وكل أسئلته ونتائجه؟')) return;
    await supabase.from('quizzes').delete().eq('id', btn.dataset.delQuiz);
    loadQuizzes();
  }));
}

function setupCreateQuizForm() {
  const form = document.querySelector('[data-create-quiz]');
  if (!form) return;
  form.querySelector('[name="stage"]').innerHTML = `<option value="">اختر المرحلة</option>${stageOptions()}`;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form).entries());
    const { error } = await supabase.from('quizzes').insert({
      teacher_id: user.id, title: values.title, stage: values.stage, description: values.description || null,
      duration_minutes: values.duration_minutes ? Number(values.duration_minutes) : null, is_published: false,
    });
    if (error) { setStatus('تعذر إنشاء الاختبار.'); return; }
    form.reset();
    setStatus('تم إنشاء الاختبار كمسودة. أضف الأسئلة ثم انشره.', 'success');
    loadQuizzes();
  });
}

async function openQuizManager(quizId) {
  const modalHost = document.querySelector('[data-lesson-modal]');
  modalHost.classList.add('active');
  modalHost.innerHTML = `<div class="panel" style="max-width:800px;margin:30px auto;max-height:88vh;overflow:auto;">
    <div class="panel-head"><h3>أسئلة الاختبار ونتائج الطلاب</h3><button class="button button-text" data-close-modal>إغلاق ✕</button></div>
    <div style="display:flex;gap:10px;margin-bottom:16px;">
      <button class="button button-primary" data-tab="questions" style="width:auto;padding:9px 18px">الأسئلة</button>
      <button class="button button-secondary" data-tab="results" style="width:auto;padding:9px 18px">نتائج الطلاب</button>
    </div>
    <div data-tab-panel="questions">
      <form data-add-question class="panel" style="margin-bottom:16px;">
        <label class="field">نص السؤال<textarea name="question_text" rows="2" required></textarea></label>
        <div data-options-wrap>
          ${[0, 1, 2, 3].map((i) => `<div class="option-row"><input type="radio" name="correct_index" value="${i}" ${i === 0 ? 'checked' : ''}><input type="text" name="option_${i}" placeholder="اختيار ${i + 1}" required></div>`).join('')}
        </div>
        <button class="button button-primary" type="submit" style="margin-top:10px">إضافة السؤال</button>
      </form>
      <div data-questions-list></div>
    </div>
    <div data-tab-panel="results" style="display:none"><div data-results-list></div></div>
  </div>`;
  modalHost.querySelector('[data-close-modal]').addEventListener('click', () => { modalHost.classList.remove('active'); modalHost.innerHTML = ''; });
  modalHost.querySelectorAll('[data-tab]').forEach((btn) => btn.addEventListener('click', () => {
    modalHost.querySelectorAll('[data-tab]').forEach((b) => b.className = `button ${b === btn ? 'button-primary' : 'button-secondary'}`);
    btn.style.width = 'auto'; btn.style.padding = '9px 18px';
    modalHost.querySelectorAll('[data-tab-panel]').forEach((p) => { p.style.display = p.dataset.tabPanel === btn.dataset.tab ? 'block' : 'none'; });
    if (btn.dataset.tab === 'results') renderResults();
  }));

  async function renderQuestions() {
    const list = modalHost.querySelector('[data-questions-list]');
    list.innerHTML = '<p class="loading">جاري التحميل…</p>';
    const { data: questions, error } = await supabase.from('quiz_questions').select('*').eq('quiz_id', quizId).order('sort_order', { ascending: true });
    if (error) { list.innerHTML = empty(genericError); return; }
    list.innerHTML = questions.length ? questions.map((q, i) => `
      <div class="quiz-question-block">
        <strong>س${i + 1}: ${esc(q.question_text)}</strong>
        <ul style="margin:10px 0 0;padding-inline-start:20px;">${q.options.map((opt, idx) => `<li style="${idx === q.correct_index ? 'color:var(--success);font-weight:700' : ''}">${esc(opt)} ${idx === q.correct_index ? '✓' : ''}</li>`).join('')}</ul>
        <button class="button button-danger" style="width:auto;margin-top:10px;padding:7px 14px" data-del-question="${q.id}">حذف السؤال</button>
      </div>`).join('') : empty('لا توجد أسئلة بعد.');
    list.querySelectorAll('[data-del-question]').forEach((btn) => btn.addEventListener('click', async () => {
      await supabase.from('quiz_questions').delete().eq('id', btn.dataset.delQuestion);
      renderQuestions();
    }));
  }
  renderQuestions();

  modalHost.querySelector('[data-add-question]').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.target;
    const values = Object.fromEntries(new FormData(form).entries());
    const options = [0, 1, 2, 3].map((i) => values[`option_${i}`]);
    const { data: existing } = await supabase.from('quiz_questions').select('id').eq('quiz_id', quizId);
    const { error } = await supabase.from('quiz_questions').insert({
      quiz_id: quizId, question_text: values.question_text, options, correct_index: Number(values.correct_index), sort_order: (existing?.length || 0),
    });
    if (error) { alert(genericError); return; }
    form.reset();
    renderQuestions();
  });

  async function renderResults() {
    const list = modalHost.querySelector('[data-results-list]');
    list.innerHTML = '<p class="loading">جاري التحميل…</p>';
    const { data: attempts, error } = await supabase.from('quiz_attempts').select('*, profiles!student_id(full_name)').eq('quiz_id', quizId).order('submitted_at', { ascending: false });
    if (error) { list.innerHTML = empty(genericError); return; }
    list.innerHTML = attempts.length ? `<table class="subscription-table"><thead><tr><th>الطالب</th><th>الدرجة</th><th>التاريخ</th></tr></thead><tbody>
      ${attempts.map((a) => `<tr><td>${esc(a.profiles?.full_name || '—')}</td><td>${a.score} / ${a.total}</td><td>${new Date(a.submitted_at).toLocaleString('ar-EG')}</td></tr>`).join('')}
      </tbody></table>` : empty('لا توجد محاولات بعد.');
  }
}

/* ============================== فيديو الشرح ============================== */
function videoCardHtml(video) {
  return `<article class="quiz-card">
    <div class="meta-col"><span class="chip chip-stage">${esc(video.stage)}</span><h4>▶ ${esc(video.title)}</h4>
      ${video.description ? `<span class="course-meta">${esc(video.description)}</span>` : ''}</div>
    <div class="row-actions"><button class="button button-danger" data-del-video="${video.id}">حذف</button></div>
  </article>`;
}

async function loadExplainerVideos() {
  const target = document.querySelector('[data-videos-list]');
  if (!target) return;
  target.innerHTML = '<p class="loading">جاري التحميل…</p>';
  const { data: videos, error } = await supabase.from('explainer_videos').select('*').eq('teacher_id', user.id).order('created_at', { ascending: false });
  if (error) { target.innerHTML = empty(genericError); return; }
  target.innerHTML = videos.length ? videos.map(videoCardHtml).join('') : empty('لا توجد فيديوهات شرح بعد. أضف أول فيديو من الأعلى.');

  target.querySelectorAll('[data-del-video]').forEach((btn) => btn.addEventListener('click', async () => {
    if (!confirm('حذف هذا الفيديو؟')) return;
    await supabase.from('explainer_videos').delete().eq('id', btn.dataset.delVideo);
    loadExplainerVideos();
  }));
}

function setupCreateVideoForm() {
  const form = document.querySelector('[data-create-video]');
  if (!form) return;
  form.querySelector('[name="stage"]').innerHTML = `<option value="">اختر المرحلة</option>${stageOptions()}`;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form).entries());
    const { error } = await supabase.from('explainer_videos').insert({
      teacher_id: user.id, title: values.title, stage: values.stage, video_url: values.video_url, description: values.description || null,
    });
    if (error) { setStatus('تعذر إضافة الفيديو.'); return; }
    form.reset();
    setStatus('تم إضافة فيديو الشرح بنجاح.', 'success');
    loadExplainerVideos();
  });
}

/* ============================== المواد: شيتات / سبورة / مذكرات ============================== */
function materialCardHtml(m) {
  const info = MATERIAL_LABELS[m.type];
  return `<article class="material-card">
    <div class="meta-col"><span class="chip ${info.chip}">${info.icon} ${info.label}</span><span class="chip chip-stage">${esc(m.stage)}</span><h4>${esc(m.title)}</h4></div>
    <div class="row-actions"><a class="button button-secondary" href="${esc(m.file_url)}" target="_blank">فتح</a><button class="button button-danger" data-del-material="${m.id}">حذف</button></div>
  </article>`;
}

async function loadMaterials() {
  const target = document.querySelector('[data-materials-list]');
  if (!target) return;
  const filterForm = document.querySelector('[data-material-filter]');
  const filters = filterForm ? Object.fromEntries(new FormData(filterForm).entries()) : {};
  target.innerHTML = '<p class="loading">جاري التحميل…</p>';
  let query = supabase.from('materials').select('*').eq('teacher_id', user.id).order('created_at', { ascending: false });
  if (filters.type) query = query.eq('type', filters.type);
  if (filters.stage) query = query.eq('stage', filters.stage);
  const { data: materials, error } = await query;
  if (error) { target.innerHTML = empty(genericError); return; }
  target.innerHTML = materials.length ? materials.map(materialCardHtml).join('') : empty('لا توجد مواد مضافة بعد.');
  target.querySelectorAll('[data-del-material]').forEach((btn) => btn.addEventListener('click', async () => {
    if (!confirm('حذف هذه المادة؟')) return;
    await supabase.from('materials').delete().eq('id', btn.dataset.delMaterial);
    loadMaterials();
  }));
}

function setupMaterialFilter() {
  const form = document.querySelector('[data-material-filter]');
  if (!form) return;
  form.querySelector('[name="stage"]').innerHTML = `<option value="">كل المراحل</option>${stageOptions()}`;
  form.addEventListener('change', loadMaterials);
}

function setupUploadMaterialForm() {
  const form = document.querySelector('[data-upload-material]');
  if (!form) return;
  form.querySelector('[name="stage"]').innerHTML = `<option value="">اختر المرحلة</option>${stageOptions()}`;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form).entries());
    const file = form.querySelector('[name="file"]').files[0];
    if (!file) { setStatus('اختر ملفًا أولًا.'); return; }
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    setStatus('جارٍ الرفع…', 'success');

    const ext = file.name.split('.').pop();
    const path = `${values.type}/${user.id}_${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from('materials').upload(path, file);
    if (uploadError) { submit.disabled = false; setStatus('تعذر رفع الملف: ' + uploadError.message); return; }
    const { data: urlData } = supabase.storage.from('materials').getPublicUrl(path);

    const { error } = await supabase.from('materials').insert({
      teacher_id: user.id, type: values.type, stage: values.stage, title: values.title, file_url: urlData.publicUrl,
    });
    submit.disabled = false;
    if (error) { setStatus('تعذر حفظ المادة.'); return; }
    form.reset();
    setStatus('تم رفع المادة بنجاح.', 'success');
    loadMaterials();
  });
}

/* ============================== الطلاب + الاشتراك الشهري (محدث) ============================== */

// دوال مساعدة لتنسيق التواريخ وعرض حالة الاشتراك
function formatDate(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function getSubscriptionStatusText(subscription) {
  if (!subscription) {
    return { status: 'غير مشترك', badge: 'rejected', text: 'غير مشترك' };
  }

  const now = new Date();
  const startDate = subscription.start_date ? new Date(subscription.start_date) : null;
  const endDate = subscription.end_date ? new Date(subscription.end_date) : null;

  if (subscription.status === 'cancelled') {
    return { status: 'ملغي', badge: 'rejected', text: 'ملغي', cancelled: true };
  }

  if (subscription.status === 'pending') {
    return { status: 'بانتظار المراجعة', badge: 'pending', text: 'بانتظار المراجعة' };
  }

  if (subscription.status === 'rejected') {
    return { status: 'مرفوض', badge: 'rejected', text: 'مرفوض' };
  }

  if (subscription.status === 'approved') {
    if (!startDate || !endDate) {
      return { status: 'نشط (غير محدد)', badge: 'approved', text: 'نشط' };
    }

    if (now >= startDate && now <= endDate) {
      const diffTime = endDate.getTime() - now.getTime();
      const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return {
        status: 'نشط',
        badge: 'approved',
        text: 'نشط',
        daysRemaining,
        startDate,
        endDate
      };
    } else if (now > endDate) {
      return { status: 'منتهي', badge: 'rejected', text: 'منتهي', expired: true };
    }
  }

  return { status: 'غير مشترك', badge: 'rejected', text: 'غير مشترك' };
}

// عرض نافذة تعديل مدة الاشتراك
function openSubscriptionModal(student, subscription) {
  const modalHost = document.querySelector('[data-lesson-modal]');
  if (!modalHost) return;
  modalHost.classList.add('active');

  const startDate = subscription?.start_date || new Date().toISOString().split('T')[0];
  const endDate = subscription?.end_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  modalHost.innerHTML = `
    <div class="panel" style="max-width:600px;margin:30px auto;">
      <div class="panel-head">
        <h3>تعديل مدة الاشتراك</h3>
        <button class="button button-text" data-close-modal>إغلاق ✕</button>
      </div>
      <div class="content-grid" style="grid-template-columns:1fr;">
        <div style="margin-bottom:16px;">
          <h4>${esc(student.full_name)}</h4>
          <p class="course-meta">تعديل مدة الاشتراك الشهري للطالب</p>
        </div>
        <form data-subscription-edit-form>
          <label class="field">
            تاريخ بداية الاشتراك
            <input name="start_date" type="date" value="${startDate}" required>
          </label>
          <label class="field">
            تاريخ انتهاء الاشتراك
            <input name="end_date" type="date" value="${endDate}" required>
          </label>
          <label class="field">
            اختيار مدة محددة
            <select name="duration_preset" data-duration-preset>
              <option value="">اختر مدة</option>
              <option value="7">7 أيام</option>
              <option value="15">15 يوم</option>
              <option value="30">شهر</option>
              <option value="60">شهرين</option>
              <option value="90">3 شهور</option>
              <option value="custom">مدة مخصصة</option>
            </select>
          </label>
          <div style="display:flex;gap:10px;margin-top:16px;">
            <button class="button button-primary" type="submit">حفظ التعديلات</button>
            <button class="button button-secondary" type="button" data-close-modal>إلغاء</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const form = modalHost.querySelector('[data-subscription-edit-form]');
  if (!form) return;
  const startDateInput = form.querySelector('[name="start_date"]');
  const endDateInput = form.querySelector('[name="end_date"]');
  const durationPreset = form.querySelector('[data-duration-preset]');

  durationPreset?.addEventListener('change', () => {
    const value = parseInt(durationPreset.value);
    if (value && value > 0 && !isNaN(value) && startDateInput && endDateInput) {
      const start = new Date(startDateInput.value);
      const end = new Date(start);
      end.setDate(end.getDate() + value);
      endDateInput.value = end.toISOString().split('T')[0];
    }
  });

  modalHost.querySelectorAll('[data-close-modal]').forEach(el => {
    el.addEventListener('click', () => {
      modalHost.classList.remove('active');
      modalHost.innerHTML = '';
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const startDate = formData.get('start_date');
    const endDate = formData.get('end_date');

    if (!startDate || !endDate) {
      setStatus('يرجى تحديد تاريخ البدء والانتهاء', 'error');
      return;
    }

    if (new Date(endDate) <= new Date(startDate)) {
      setStatus('تاريخ الانتهاء يجب أن يكون بعد تاريخ البدء', 'error');
      return;
    }

    const { error } = await supabase
      .from('subscription_payments')
      .update({
        start_date: startDate,
        end_date: endDate,
        status: 'approved',
        updated_at: new Date().toISOString()
      })
      .eq('student_id', student.id)
      .eq('teacher_id', user.id);

    if (error) {
      setStatus('تعذر تحديث الاشتراك: ' + error.message, 'error');
      return;
    }

    setStatus('تم تحديث مدة الاشتراك بنجاح', 'success');
    modalHost.classList.remove('active');
    modalHost.innerHTML = '';
    loadStudents();
  });
}

// عرض نافذة تأكيد الإلغاء
function showCancelConfirmation(student, subscription) {
  const modalHost = document.querySelector('[data-lesson-modal]');
  if (!modalHost) return;
  modalHost.classList.add('active');

  modalHost.innerHTML = `
    <div class="panel" style="max-width:500px;margin:30px auto;">
      <div class="panel-head">
        <h3>تأكيد إلغاء الاشتراك</h3>
        <button class="button button-text" data-close-modal>إغلاق ✕</button>
      </div>
      <div class="content-grid" style="grid-template-columns:1fr;">
        <div style="margin-bottom:16px;">
          <h4>${esc(student.full_name)}</h4>
          <p class="course-meta">هل أنت متأكد من إلغاء الاشتراك الشهري لهذا الطالب؟</p>
          <div style="margin-top:12px;padding:12px;background:var(--surface-alt);border-radius:var(--radius);">
            <div>تاريخ بداية الاشتراك: ${formatDate(subscription?.start_date)}</div>
            <div>تاريخ انتهاء الاشتراك: ${formatDate(subscription?.end_date)}</div>
          </div>
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end;border-top:1px solid var(--border);padding-top:16px;">
          <button class="button button-secondary" data-close-modal>إلغاء</button>
          <button class="button button-danger" data-confirm-cancel>تأكيد الإلغاء</button>
        </div>
      </div>
    </div>
  `;

  modalHost.querySelectorAll('[data-close-modal]').forEach(el => {
    el.addEventListener('click', () => {
      modalHost.classList.remove('active');
      modalHost.innerHTML = '';
    });
  });

  modalHost.querySelector('[data-confirm-cancel]')?.addEventListener('click', async () => {
    const { error } = await supabase
      .from('subscription_payments')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: user.id,
        updated_at: new Date().toISOString()
      })
      .eq('student_id', student.id)
      .eq('teacher_id', user.id);

    if (error) {
      setStatus('تعذر إلغاء الاشتراك: ' + error.message, 'error');
      return;
    }

    setStatus('تم إلغاء اشتراك الطالب بنجاح', 'success');
    modalHost.classList.remove('active');
    modalHost.innerHTML = '';
    loadStudents();
  });
}

// عرض نافذة إعادة التفعيل
function showReactivateConfirmation(student) {
  const modalHost = document.querySelector('[data-lesson-modal]');
  if (!modalHost) return;
  modalHost.classList.add('active');

  const today = new Date().toISOString().split('T')[0];
  const defaultEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  modalHost.innerHTML = `
    <div class="panel" style="max-width:550px;margin:30px auto;">
      <div class="panel-head">
        <h3>إعادة تفعيل الاشتراك</h3>
        <button class="button button-text" data-close-modal>إغلاق ✕</button>
      </div>
      <div class="content-grid" style="grid-template-columns:1fr;">
        <div style="margin-bottom:16px;">
          <h4>${esc(student.full_name)}</h4>
          <p class="course-meta">حدد تاريخ بداية ونهاية الاشتراك الجديد</p>
        </div>
        <form data-reactivate-form>
          <label class="field">
            تاريخ بداية الاشتراك
            <input name="start_date" type="date" value="${today}" required>
          </label>
          <label class="field">
            تاريخ انتهاء الاشتراك
            <input name="end_date" type="date" value="${defaultEnd}" required>
          </label>
          <div style="display:flex;gap:10px;margin-top:16px;justify-content:flex-end;">
            <button class="button button-secondary" data-close-modal>إلغاء</button>
            <button class="button button-primary" type="submit">إعادة التفعيل</button>
          </div>
        </form>
      </div>
    </div>
  `;

  modalHost.querySelectorAll('[data-close-modal]').forEach(el => {
    el.addEventListener('click', () => {
      modalHost.classList.remove('active');
      modalHost.innerHTML = '';
    });
  });

  modalHost.querySelector('[data-reactivate-form]')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const startDate = formData.get('start_date');
    const endDate = formData.get('end_date');

    if (!startDate || !endDate) {
      setStatus('يرجى تحديد تاريخ البدء والانتهاء', 'error');
      return;
    }

    if (new Date(endDate) <= new Date(startDate)) {
      setStatus('تاريخ الانتهاء يجب أن يكون بعد تاريخ البدء', 'error');
      return;
    }

    const { error } = await supabase
      .from('subscription_payments')
      .update({
        status: 'approved',
        start_date: startDate,
        end_date: endDate,
        cancelled_at: null,
        cancelled_by: null,
        updated_at: new Date().toISOString()
      })
      .eq('student_id', student.id)
      .eq('teacher_id', user.id);

    if (error) {
      setStatus('تعذر إعادة التفعيل: ' + error.message, 'error');
      return;
    }

    setStatus('تم إعادة تفعيل اشتراك الطالب بنجاح', 'success');
    modalHost.classList.remove('active');
    modalHost.innerHTML = '';
    loadStudents();
  });
}

// دالة loadStudents المحدثة
async function loadStudents() {
  const target = document.querySelector('[data-students-list]');
  if (!target) return;
  target.innerHTML = '<p class="loading">جاري التحميل…</p>';

  const { data: students, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('teacher_id', user.id)
    .eq('role', 'student')
    .order('full_name');

  if (error) {
    target.innerHTML = empty(genericError);
    return;
  }

  if (!students.length) {
    target.innerHTML = empty('لا يوجد طلاب مرتبطون بحسابك بعد. يقوم الطالب بربط نفسه بك من صفحة "حسابي".');
    return;
  }

  // جلب الاشتراكات
  const { data: subscriptions } = await supabase
    .from('subscription_payments')
    .select('*')
    .eq('teacher_id', user.id);

  const subByStudent = Object.fromEntries((subscriptions || []).map((s) => [s.student_id, s]));

  target.innerHTML = `
    <div style="overflow-x:auto;">
      <table class="subscription-table">
        <thead>
          <tr>
            <th>الطالب</th>
            <th>حالة الاشتراك</th>
            <th>بدأ من</th>
            <th>ينتهي في</th>
            <th>المتبقي</th>
            <th>الإجراءات</th>
          </tr>
        </thead>
        <tbody>
          ${students.map((st) => {
            const sub = subByStudent[st.id];
            const status = getSubscriptionStatusText(sub);

            let daysRemaining = '—';
            if (status.status === 'نشط' && status.daysRemaining) {
              daysRemaining = status.daysRemaining > 0 ? `${status.daysRemaining} يوم` : 'ينتهي اليوم';
            } else if (status.status === 'نشط (غير محدد)') {
              daysRemaining = 'غير محدد';
            } else if (status.status === 'منتهي') {
              daysRemaining = 'انتهى';
            } else if (status.status === 'ملغي') {
              daysRemaining = 'ملغي';
            }

            const startDate = sub?.start_date ? formatDate(sub.start_date) : '—';
            const endDate = sub?.end_date ? formatDate(sub.end_date) : '—';

            let actions = '';
            if (sub?.status === 'cancelled') {
              actions = `
                <button class="button button-primary" style="width:auto;padding:6px 12px;font-size:0.8rem;" data-reactivate="${st.id}">إعادة التفعيل</button>
              `;
            } else if (sub?.status === 'approved') {
              actions = `
                <button class="button button-secondary" style="width:auto;padding:6px 12px;font-size:0.8rem;" data-edit-sub="${st.id}">تعديل المدة</button>
                <button class="button button-danger" style="width:auto;padding:6px 12px;font-size:0.8rem;" data-cancel-sub="${st.id}">إلغاء الاشتراك</button>
              `;
            } else {
              actions = `
                <button class="button button-secondary" style="width:auto;padding:6px 12px;font-size:0.8rem;" data-mark-paid="${st.id}">تفعيل اشتراك</button>
              `;
            }

            return `<tr>
              <td><strong>${esc(st.full_name)}</strong></td>
              <td><span class="status-badge ${status.badge}">${status.status}</span></td>
              <td>${startDate}</td>
              <td>${endDate}</td>
              <td>${daysRemaining}</td>
              <td>
                <div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;">
                  ${actions}
                </div>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  // ربط الأحداث
  target.querySelectorAll('[data-edit-sub]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const student = students.find(s => s.id === btn.dataset.editSub);
      const subscription = subByStudent[student.id];
      openSubscriptionModal(student, subscription);
    });
  });

  target.querySelectorAll('[data-cancel-sub]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const student = students.find(s => s.id === btn.dataset.cancelSub);
      const subscription = subByStudent[student.id];
      showCancelConfirmation(student, subscription);
    });
  });

  target.querySelectorAll('[data-reactivate]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const student = students.find(s => s.id === btn.dataset.reactivate);
      showReactivateConfirmation(student);
    });
  });

  // زر تفعيل الاشتراك
  target.querySelectorAll('[data-mark-paid]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const amount = prompt('قيمة الاشتراك الشهري (ج.م):', '0');
      if (amount === null) return;

      const studentId = btn.dataset.markPaid;
      const today = new Date().toISOString().split('T')[0];
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);
      const endDateStr = endDate.toISOString().split('T')[0];

      const { error } = await supabase
        .from('subscription_payments')
        .upsert({
          student_id: studentId,
          teacher_id: user.id,
          month: currentMonthStart(),
          amount: Number(amount) || 0,
          method: 'cash',
          status: 'approved',
          start_date: today,
          end_date: endDateStr,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'student_id,teacher_id,month'
        });

      if (error) {
        alert(genericError);
        return;
      }
      loadStudents();
    });
  });
}

async function loadSubscriptionRequests() {
  const target = document.querySelector('[data-subscription-requests]');
  if (!target) return;
  target.innerHTML = '<p class="loading">جاري التحميل…</p>';
  const { data: requests, error } = await supabase.from('subscription_payments').select('*, profiles!student_id(full_name)').eq('teacher_id', user.id).order('created_at', { ascending: false }).limit(50);
  if (error) { target.innerHTML = empty(genericError); return; }
  target.innerHTML = requests.length ? `<table class="subscription-table"><thead><tr><th>الطالب</th><th>الشهر</th><th>المبلغ</th><th>الطريقة</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody>
    ${requests.map((r) => `<tr><td>${esc(r.profiles?.full_name || '—')}</td><td>${new Date(r.month).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long' })}</td><td>${money(r.amount)}</td><td>${esc(r.method)}</td>
      <td><span class="status-badge ${r.status}">${r.status === 'approved' ? 'مقبول' : r.status === 'rejected' ? 'مرفوض' : 'قيد المراجعة'}</span></td>
      <td>${r.status === 'pending' ? `<div class="row-actions"><button class="button button-primary" style="width:auto;padding:6px 12px" data-approve-sub="${r.id}">قبول</button><button class="button button-danger" style="width:auto;padding:6px 12px" data-reject-sub="${r.id}">رفض</button></div>` : '—'}</td>
    </tr>`).join('')}</tbody></table>` : empty('لا توجد طلبات اشتراك شهري حتى الآن.');

  target.querySelectorAll('[data-approve-sub]').forEach((btn) => btn.addEventListener('click', async () => {
    // عند قبول طلب الاشتراك، نضيف start_date و end_date تلقائياً
    const today = new Date().toISOString().split('T')[0];
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);
    const endDateStr = endDate.toISOString().split('T')[0];

    await supabase.from('subscription_payments').update({
      status: 'approved',
      start_date: today,
      end_date: endDateStr,
      updated_at: new Date().toISOString()
    }).eq('id', btn.dataset.approveSub);
    loadSubscriptionRequests();
    loadOverview();
  }));

  target.querySelectorAll('[data-reject-sub]').forEach((btn) => btn.addEventListener('click', async () => {
    await supabase.from('subscription_payments').update({ status: 'rejected' }).eq('id', btn.dataset.rejectSub);
    loadSubscriptionRequests();
    loadOverview();
  }));
}

/* ============================== تشغيل ============================== */
setNavigation();
setMobileMenu();
loadOverview();
loadTeacherCourses();
setupCreateCourseForm();
setupCreateQuizForm();
setupCreateVideoForm();
setupMaterialFilter();
setupUploadMaterialForm();