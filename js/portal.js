import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabase = createClient('https://dfxkuppxywldxsbyzfzo.supabase.co', 'sb_publishable_B3xVoCtEJtpStm76kM5KDw_WZgPsJXN');
const genericError = 'حدث خطأ أثناء تحميل البيانات. حاول مرة أخرى.';
const esc = (value = '') => { const node = document.createElement('div'); node.textContent = value; return node.innerHTML; };
const getUser = () => { try { return JSON.parse(localStorage.getItem('currentUser') || 'null'); } catch { return null; } };
const money = (value) => `${new Intl.NumberFormat('ar-EG').format(Number(value || 0))} ج.م`;

function setStatus(message, type = 'error') { const node = document.querySelector('[data-portal-status]'); if (node) { node.textContent = message; node.className = `status-message is-visible ${type}`; } }
function empty(message, action = '') { return `<div class="empty-state">${message}${action ? `<div style="margin-top:12px">${action}</div>` : ''}</div>`; }
function userName(user) { return esc(user?.name || user?.full_name || 'بك'); }

function setNavigation() {
  const buttons = document.querySelectorAll('[data-view]');
  const views = document.querySelectorAll('.view');
  buttons.forEach((button) => button.addEventListener('click', () => {
    const selected = button.dataset.view;
    buttons.forEach((item) => item.classList.toggle('active', item.dataset.view === selected));
    views.forEach((view) => view.classList.toggle('active', view.id === selected));
    document.querySelector('[data-page-title]').textContent = button.dataset.title || 'لوحة التحكم';
  }));
  document.querySelector('[data-logout]')?.addEventListener('click', async () => { await supabase.auth.signOut(); localStorage.removeItem('currentUser'); location.href = 'index.html'; });
}

function courseCard(course, student = false) {
  const title = esc(course.title || course.name || 'كورس جديد');
  const meta = `${esc(course.subject || 'محتوى تعليمي')} · ${course.lesson_count || 0} درس`;
  const isPlaylist = Boolean(course.name && !course.title);
  const link = student ? (isPlaylist ? `playlist-view.html?id=${encodeURIComponent(course.id)}` : 'courses.html') : (isPlaylist ? 'teacher-playlists.html' : `checkout.html?course=${encodeURIComponent(course.id)}`);
  return `<article class="course-card"><div class="course-cover">◒</div><div class="course-card-body"><div><div class="course-meta">${meta}</div><h3>${title}</h3><p class="course-meta">${student ? 'يمكنك متابعة آخر درس وصلت إليه.' : `السعر: ${money(course.price)}`}</p></div>${student ? '<div class="progress"><i style="width:0%"></i></div>' : ''}<div class="course-footer"><span class="price">${student ? 'لم تبدأ بعد' : money(course.price)}</span><a class="button button-secondary" href="${link}">${student ? 'عرض الكورس' : 'إدارة الكورس'}</a></div></div></article>`;
}

async function loadStudent(user) {
  const courseTargets = document.querySelectorAll('[data-student-courses]');
  if (!courseTargets.length) return;
  courseTargets.forEach((target) => { target.innerHTML = '<p class="loading">جاري تحميل كورساتك…</p>'; });
  const { data: auth } = await supabase.auth.getUser();
  let courses = [];
  if (auth.user) {
    const { data, error } = await supabase.from('enrollments').select('course:courses(*)').eq('student_id', auth.user.id);
    if (!error) courses = (data || []).map((item) => item.course).filter(Boolean);
  }
  // حسابات المشروع الحالية تستخدم playlists؛ نعرضها حتى تعمل المنصة قبل الترحيل الكامل.
  if (!courses.length) {
    const { data: playlists, error } = await supabase.from('playlists').select('*').order('id', { ascending: false });
    if (error) { courseTargets.forEach((target) => { target.innerHTML = empty(genericError); }); return; }
    courses = playlists || [];
  }
  const content = courses.length ? courses.map((course) => courseCard(course, true)).join('') : empty('لا توجد كورسات مفعّلة في حسابك حاليًا.', '<a class="button button-primary" href="courses.html">تصفح الكورسات</a>');
  courseTargets.forEach((target) => { target.innerHTML = content; });
  document.querySelector('[data-course-count]')?.replaceChildren(document.createTextNode(String(courses.length)));
}

async function loadStudentContent(user) {
  const videosTarget = document.querySelector('[data-student-videos]');
  const filesTarget = document.querySelector('[data-student-files]');
  if (!videosTarget || !filesTarget) return;
  if (!user.teacher_id) {
    videosTarget.innerHTML = empty('لم يتم تعيين مدرس لهذا الحساب بعد.');
    filesTarget.innerHTML = empty('لا توجد ملفات متاحة حاليًا.');
    return;
  }
  let videosQuery = supabase.from('videos').select('*').eq('teacher_id', user.teacher_id);
  let pdfsQuery = supabase.from('pdfs').select('*').eq('teacher_id', user.teacher_id);
  let notesQuery = supabase.from('pdfs2').select('*').eq('teacher_id', user.teacher_id);
  if (user.stage) { videosQuery = videosQuery.eq('stage', user.stage); pdfsQuery = pdfsQuery.eq('stage', user.stage); notesQuery = notesQuery.eq('stage', user.stage); }
  const [{ data: videos, error: videosError }, { data: pdfs, error: pdfsError }, { data: notes, error: notesError }] = await Promise.all([videosQuery, pdfsQuery, notesQuery]);
  if (videosError) videosTarget.innerHTML = empty(genericError);
  else videosTarget.innerHTML = (videos || []).length ? videos.map((video, index) => `<div class="list-row"><div class="list-icon">▶</div><div><strong>فيديو ${index + 1}</strong><span>اضغط للمشاهدة</span></div><a class="button button-secondary" target="_blank" href="${esc(video.url)}">مشاهدة</a></div>`).join('') : empty('لا توجد فيديوهات متاحة حاليًا.');
  if (pdfsError || notesError) filesTarget.innerHTML = empty(genericError);
  else {
    const files = [...(pdfs || []), ...(notes || [])];
    filesTarget.innerHTML = files.length ? files.map((file) => `<div class="list-row"><div class="list-icon">▤</div><div><strong>${esc(file.file_name || 'ملف دراسي')}</strong><span>ملف متاح للتحميل</span></div><a class="button button-secondary" target="_blank" href="${esc(file.file_url)}">فتح</a></div>`).join('') : empty('لا توجد ملفات متاحة حاليًا.');
  }
}

async function loadTeacher(user) {
  const targets = document.querySelectorAll('[data-teacher-courses]');
  if (!targets.length) return;
  targets.forEach((target) => { target.innerHTML = '<p class="loading">جاري تحميل الكورسات…</p>'; });
  const { data: auth } = await supabase.auth.getUser();
  let courses = [];
  if (auth.user) {
    const { data } = await supabase.from('courses').select('*').eq('teacher_id', auth.user.id).order('created_at', { ascending: false });
    courses = data || [];
  }
  if (!courses.length) {
    const { data: playlists, error } = await supabase.from('playlists').select('*').eq('teacher_id', user.id).order('id', { ascending: false });
    if (error) { targets.forEach((target) => { target.innerHTML = empty(genericError); }); return; }
    courses = playlists || [];
  }
  const content = courses.length ? courses.map((course) => courseCard(course)).join('') : empty('لم تضف أي كورسات بعد.');
  targets.forEach((target) => { target.innerHTML = content; });
  document.querySelector('[data-course-count]')?.replaceChildren(document.createTextNode(String(courses.length)));
}

function setupTeacherForms(user) {
  const form = document.querySelector('[data-create-course]');
  if (!form) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    const values = Object.fromEntries(new FormData(form).entries());
    const { error } = authUser
      ? await supabase.from('courses').insert({ teacher_id: authUser.id, title: values.title, subject: values.subject, stage: values.stage, price: Number(values.price || 0), description: values.description, is_published: true })
      : await supabase.from('playlists').insert({ teacher_id: user.id, teacher_name: user.name || 'مدرس', name: values.title, price: Number(values.price || 0) });
    if (error) { setStatus('تعذر حفظ الكورس. حاول مرة أخرى.'); return; }
    form.reset(); setStatus('تم حفظ الكورس كمسودة. يمكنك نشره من إدارة الكورسات.', 'success'); loadTeacher(user);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const role = document.body.dataset.role;
  const user = getUser();
  if (!user || (role && user.role !== role)) { location.href = 'index.html'; return; }
  document.querySelectorAll('[data-user-name]').forEach((node) => { node.textContent = userName(user); });
  setNavigation();
  if (role === 'student') { loadStudent(user); loadStudentContent(user); }
  if (role === 'teacher') { loadTeacher(user); setupTeacherForms(user); }
});
