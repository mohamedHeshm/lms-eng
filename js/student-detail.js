import { supabase, esc, money, genericError } from './supabase-client.js';
import { requireAuth } from './auth-guard.js';
import { progressBarHtml } from './progress-tracker.js';
import { timeAgoAr } from './notifications.js';

const session = await requireAuth('teacher');
if (!session) throw new Error('redirecting');
const { user } = session;

const params = new URLSearchParams(location.search);
const studentId = params.get('student');

const shell = document.querySelector('.sd-shell');
if (!studentId) {
  shell.innerHTML = '<div class="empty-state">لم يتم تحديد الطالب.</div>';
  throw new Error('no-student');
}

const { data: student, error: studentError } = await supabase.from('profiles').select('*').eq('id', studentId).eq('role', 'student').single();
if (studentError || !student || student.teacher_id !== user.id) {
  shell.innerHTML = '<div class="empty-state">هذا الطالب غير مرتبط بحسابك أو غير موجود.</div>';
  throw new Error('not-allowed');
}

document.querySelector('[data-student-name]').textContent = student.full_name || '—';
document.querySelector('[data-student-email]').textContent = student.email || '—';
document.querySelector('[data-reg-date]').textContent = student.created_at ? new Date(student.created_at).toLocaleDateString('ar-EG') : '—';
document.querySelector('[data-stage]').textContent = student.stage || 'غير محدد';

/* ------------------------------ الاشتراك الشهري ------------------------------ */
const { data: subscription } = await supabase
  .from('subscription_payments')
  .select('*')
  .eq('student_id', studentId)
  .eq('teacher_id', user.id)
  .order('created_at', { ascending: false })
  .maybeSingle();

const subBadge = document.querySelector('[data-subscription-badge]');
const subDatesEl = document.querySelector('[data-sub-dates]');
if (subscription) {
  const active = subscription.status === 'approved' && subscription.end_date && new Date() <= new Date(subscription.end_date);
  subBadge.textContent = active ? 'اشتراك نشط' : subscription.status === 'pending' ? 'بانتظار المراجعة' : subscription.status === 'cancelled' ? 'ملغي' : subscription.status === 'approved' ? 'منتهي' : 'مرفوض';
  subDatesEl.textContent = subscription.start_date && subscription.end_date
    ? `من ${new Date(subscription.start_date).toLocaleDateString('ar-EG')} إلى ${new Date(subscription.end_date).toLocaleDateString('ar-EG')}`
    : 'لا يوجد اشتراك مفعّل بعد';
} else {
  subBadge.textContent = 'بدون اشتراك';
  subDatesEl.textContent = 'لم يشترك الطالب شهريًا بعد';
}

/* ------------------------------ التقدم في الكورسات (Query واحد) ------------------------------ */
const { data: courseProgress, error: cpError } = await supabase
  .from('v_course_progress')
  .select('*')
  .eq('student_id', studentId)
  .order('last_watched_at', { ascending: false, nullsFirst: false });

/* ------------------------------ محاولات الاختبارات ------------------------------ */
const { data: attempts } = await supabase.from('quiz_attempts').select('score, total, created_at').eq('student_id', studentId);

/* ------------------------------ تفاصيل مشاهدة كل درس ------------------------------ */
const { data: lessonRows } = await supabase
  .from('lesson_watch_progress')
  .select('*, course_lessons(title, sort_order), courses!inner(title, teacher_id)')
  .eq('student_id', studentId)
  .eq('courses.teacher_id', user.id)
  .order('last_watched_at', { ascending: false });

/* ============================== إحصائيات عامة ============================== */
function renderStats() {
  const rows = courseProgress || [];
  const totalLessons = rows.reduce((s, r) => s + (r.total_lessons || 0), 0);
  const completedLessons = rows.reduce((s, r) => s + (r.completed_lessons || 0), 0);
  const avgProgress = rows.length ? Math.round(rows.reduce((s, r) => s + (r.avg_percentage || 0), 0) / rows.length) : 0;
  const quizCount = (attempts || []).length;
  const avgQuiz = quizCount ? Math.round(attempts.reduce((s, a) => s + (a.total ? (a.score / a.total) * 100 : 0), 0) / quizCount) : 0;

  const lastActivityDates = [
    ...(rows.map((r) => r.last_watched_at).filter(Boolean)),
    ...((attempts || []).map((a) => a.created_at)),
  ].sort((a, b) => new Date(b) - new Date(a));
  const lastActivity = lastActivityDates[0];

  const totalWatchSeconds = (lessonRows || []).reduce((s, r) => s + (r.last_position || 0), 0);
  const watchHours = Math.floor(totalWatchSeconds / 3600);
  const watchMinutes = Math.floor((totalWatchSeconds % 3600) / 60);

  const set = (sel, val) => { const el = document.querySelector(sel); if (el) el.textContent = val; };
  set('[data-stat-courses]', rows.length);
  set('[data-stat-completed]', completedLessons);
  set('[data-stat-total-lessons]', totalLessons);
  set('[data-stat-avg-progress]', avgProgress + '%');
  set('[data-stat-quizzes]', quizCount);
  set('[data-stat-avg-quiz]', quizCount ? avgQuiz + '%' : '—');
  set('[data-stat-last-activity]', lastActivity ? timeAgoAr(lastActivity) : 'لا يوجد نشاط بعد');
  set('[data-stat-watch-time]', totalWatchSeconds ? `${watchHours} س ${watchMinutes} د` : '—');
}

/* ============================== كورسات الطالب ============================== */
function renderCourses() {
  const target = document.querySelector('[data-courses-list]');
  const rows = courseProgress || [];
  if (cpError) { target.innerHTML = `<div class="empty-state">${genericError}</div>`; return; }
  if (!rows.length) { target.innerHTML = '<div class="empty-state">الطالب غير مشترك في أي كورس حاليًا.</div>'; return; }

  target.innerHTML = rows.map((r) => {
    const pct = r.total_lessons ? Math.round((r.completed_lessons / r.total_lessons) * 100) : 0;
    return `<article class="sd-course-card">
      <div class="sd-course-cover">${r.cover_image_url ? `<img src="${esc(r.cover_image_url)}" alt="${esc(r.course_title)}">` : '◒'}</div>
      <div class="sd-course-body">
        <strong>${esc(r.course_title)}</strong>
        <div class="lp-meta-row"><span>${r.completed_lessons}/${r.total_lessons} درس مكتمل</span><strong>${pct}%</strong></div>
        ${progressBarHtml(pct)}
        <div class="course-meta" style="margin-top:6px">آخر نشاط: ${r.last_watched_at ? timeAgoAr(r.last_watched_at) : 'لم يبدأ بعد'}</div>
      </div>
    </article>`;
  }).join('');
}

/* ============================== تفاصيل مشاهدة الدروس ============================== */
function renderLessonsDetail() {
  const target = document.querySelector('[data-lessons-detail]');
  const rows = [...(lessonRows || [])].sort((a, b) => (a.course_lessons?.sort_order ?? 0) - (b.course_lessons?.sort_order ?? 0));
  if (!rows.length) { target.innerHTML = '<div class="empty-state">لا يوجد سجل مشاهدة دروس بعد لهذا الطالب.</div>'; return; }

  // تجميع حسب الكورس
  const byCourse = {};
  rows.forEach((r) => {
    const key = r.courses?.title || 'كورس';
    (byCourse[key] ||= []).push(r);
  });

  target.innerHTML = Object.entries(byCourse).map(([courseTitle, list]) => `
    <h4 style="margin:6px 0 8px">${esc(courseTitle)}</h4>
    ${list.map((r) => {
      const pct = r.progress_percentage || 0;
      const status = r.completed ? 'done' : (pct > 0 ? 'in-progress' : 'not-started');
      const icon = r.completed ? '✓' : (pct > 0 ? '▶' : '○');
      const label = r.completed ? 'مكتمل' : (pct > 0 ? `${pct}%` : 'لم يبدأ');
      return `<div class="sd-lesson-row ${status}">
        <span class="sd-lesson-icon">${icon}</span>
        <span style="flex:1">${esc(r.course_lessons?.title || 'درس')}</span>
        ${progressBarHtml(pct, { height: 6 })}
        <span style="width:70px;text-align:left;font-weight:700">${label}</span>
      </div>`;
    }).join('')}
  `).join('<hr style="border:0;border-top:1px solid var(--lms-border,#dce4df);margin:14px 0">');
}

renderStats();
renderCourses();
renderLessonsDetail();
