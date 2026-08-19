import { supabase, esc, genericError } from './supabase-client.js';
import { requireAuth } from './auth-guard.js';
import { recordLessonProgress, getLessonsWithProgress, progressBarHtml, COMPLETE_THRESHOLD } from './progress-tracker.js';
import { checkAndAwardAchievements } from './achievements.js';
import { notify } from './notifications.js';

const session = await requireAuth('student');
if (!session) throw new Error('redirecting');
const { user } = session;

const params = new URLSearchParams(location.search);
const courseId = params.get('course');
const requestedLessonId = params.get('lesson');

const courseTitleEl = document.querySelector('[data-course-title]');
const courseSubtitleEl = document.querySelector('[data-course-subtitle]');
const progressFillEl = document.querySelector('[data-course-progress-fill]');
const progressTextEl = document.querySelector('[data-course-progress-text]');
const playerWrap = document.querySelector('[data-player-wrap]');
const lessonTitleEl = document.querySelector('[data-lesson-title]');
const lessonPctEl = document.querySelector('[data-lesson-pct]');
const lessonStatusEl = document.querySelector('[data-lesson-status]');
const lessonBarFillEl = document.querySelector('[data-lesson-bar-fill]');
const lessonFilesEl = document.querySelector('[data-lesson-files]');
const lessonsListEl = document.querySelector('[data-lessons-list]');

if (!courseId) {
  lessonsListEl.innerHTML = `<div class="empty-state">اختر كورسًا من لوحة الطالب أولًا.</div>`;
  throw new Error('no-course');
}

// ---- تأكد أن الطالب مشترك فعلًا في هذا الكورس (حماية إضافية بجانب RLS) ----
const { data: enrollment } = await supabase.from('enrollments').select('id').eq('student_id', user.id).eq('course_id', courseId).maybeSingle();
if (!enrollment) {
  playerWrap.innerHTML = `<div style="color:#fff;display:flex;align-items:center;justify-content:center;height:100%;text-align:center;padding:20px">أنت غير مشترك في هذا الكورس.</div>`;
  lessonsListEl.innerHTML = `<div class="empty-state">اشترك في الكورس أولًا من صفحة الكورسات.</div>`;
  throw new Error('not-enrolled');
}

const { data: course } = await supabase.from('courses').select('*, profiles!teacher_id(full_name)').eq('id', courseId).single();
courseTitleEl.textContent = course?.title || 'الكورس';
courseSubtitleEl.textContent = course ? `مع ${course.profiles?.full_name || 'فريق المنصة'}${course.subject ? ' · ' + course.subject : ''}` : '';

let lessons = await getLessonsWithProgress(user.id, courseId);
let activeLesson = null;
let ytPlayer = null;
let ytReady = false;
let saveTimer = null;

function toYoutubeId(url) {
  try {
    if (url.includes('youtu.be/')) return url.split('youtu.be/')[1].split(/[?&]/)[0];
    if (url.includes('watch?v=')) return new URL(url).searchParams.get('v');
    if (url.includes('/embed/')) return url.split('/embed/')[1].split(/[?&]/)[0];
  } catch { /* رابط غير قياسي */ }
  return null;
}

function renderCourseProgress() {
  const total = lessons.length;
  const completed = lessons.filter((l) => l.progress?.completed).length;
  const pct = total ? Math.round((completed / total) * 100) : 0;
  progressFillEl.style.width = pct + '%';
  progressTextEl.textContent = `${pct}% (${completed}/${total} درس)`;
}

function renderLessonsList() {
  lessonsListEl.innerHTML = lessons.length ? lessons.map((l, i) => {
    const pct = l.progress?.progress_percentage || 0;
    const done = !!l.progress?.completed;
    const isActive = activeLesson?.id === l.id;
    return `<button class="pv-lesson-item ${done ? 'done' : ''} ${isActive ? 'active' : ''}" data-open-lesson="${l.id}">
      <span class="pv-lesson-num">${done ? '✓' : (i + 1)}</span>
      <span class="pv-lesson-info">
        <strong>${esc(l.title)}</strong>
        <small>${done ? 'مكتمل' : pct > 0 ? `${pct}% مشاهَد` : 'لم يبدأ بعد'}</small>
      </span>
    </button>`;
  }).join('') : '<div class="empty-state">لا توجد دروس في هذا الكورس بعد.</div>';

  lessonsListEl.querySelectorAll('[data-open-lesson]').forEach((btn) => {
    btn.addEventListener('click', () => openLesson(btn.dataset.openLesson));
  });
}

function renderLessonFiles(lesson) {
  const parts = [];
  if (lesson.board_pdf_url) parts.push(`<a class="button button-secondary" style="width:auto;padding:6px 14px" href="${esc(lesson.board_pdf_url)}" target="_blank">🖼 سبورة الدرس</a>`);
  if (lesson.explanation_pdf_url) parts.push(`<a class="button button-secondary" style="width:auto;padding:6px 14px" href="${esc(lesson.explanation_pdf_url)}" target="_blank">📘 شرح كتابي</a>`);
  lessonFilesEl.innerHTML = parts.join('');
}

function updateLessonProgressUI(lesson) {
  const pct = lesson.progress?.progress_percentage || 0;
  const done = !!lesson.progress?.completed;
  lessonPctEl.textContent = pct + '%';
  lessonBarFillEl.style.width = pct + '%';
  lessonStatusEl.innerHTML = done ? '<span class="status-badge approved">مكتمل ✓</span>' : (pct > 0 ? '<span class="status-badge pending">جاري المشاهدة</span>' : '');
}

async function persistProgress(positionSeconds, durationSeconds) {
  if (!activeLesson || !durationSeconds) return;
  const { data, justCompleted } = await recordLessonProgress({
    studentId: user.id, lessonId: activeLesson.id, courseId, positionSeconds, durationSeconds,
  });
  if (!data) return;
  activeLesson.progress = data;
  const idx = lessons.findIndex((l) => l.id === activeLesson.id);
  if (idx > -1) lessons[idx] = { ...lessons[idx], progress: data };
  updateLessonProgressUI(activeLesson);
  renderCourseProgress();
  renderLessonsList();

  if (justCompleted) {
    lessonStatusEl.innerHTML = '<span class="status-badge approved">🎉 تم إكمال الدرس</span>';
    const newAchievements = await checkAndAwardAchievements(user.id);
    if (newAchievements.length) {
      setTimeout(() => alert(`🎉 مبروك! فتحت إنجاز جديد: ${newAchievements.map((a) => a.title).join('، ')}`), 300);
    }
    if (course?.teacher_id) {
      await notify(course.teacher_id, {
        title: 'طالب أكمل درسًا',
        message: `أكمل الطالب الدرس "${activeLesson.title}" في كورس "${course.title}"`,
        type: 'new_submission', relatedType: 'lesson', relatedId: activeLesson.id,
      });
    }
  }
}

function destroyPlayer() {
  if (saveTimer) { clearInterval(saveTimer); saveTimer = null; }
  if (ytPlayer && ytPlayer.destroy) { try { ytPlayer.destroy(); } catch { /* تجاهل */ } }
  ytPlayer = null;
}

function mountYoutubePlayer(videoId, startSeconds) {
  playerWrap.innerHTML = '<div id="pv-yt-target"></div>';
  const build = () => {
    ytPlayer = new YT.Player('pv-yt-target', {
      videoId,
      playerVars: { start: Math.floor(startSeconds || 0), rel: 0 },
      events: {
        onReady: () => {
          saveTimer = setInterval(() => {
            if (!ytPlayer?.getCurrentTime) return;
            const pos = ytPlayer.getCurrentTime();
            const dur = ytPlayer.getDuration();
            if (dur > 0) persistProgress(pos, dur);
          }, 5000);
        },
        onStateChange: (event) => {
          // 0 = انتهى الفيديو
          if (event.data === 0 && ytPlayer?.getDuration) {
            const dur = ytPlayer.getDuration();
            persistProgress(dur, dur);
          }
        },
      },
    });
  };
  if (window.YT && window.YT.Player) build();
  else {
    window.onYouTubeIframeAPIReady = build;
    if (!document.querySelector('#yt-iframe-api')) {
      const tag = document.createElement('script');
      tag.id = 'yt-iframe-api';
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }
  }
}

function mountVideoTag(url, startSeconds) {
  playerWrap.innerHTML = `<video id="pv-video-target" controls playsinline src="${esc(url)}"></video>`;
  const videoEl = document.getElementById('pv-video-target');
  videoEl.addEventListener('loadedmetadata', () => { if (startSeconds) videoEl.currentTime = startSeconds; });
  saveTimer = setInterval(() => {
    if (videoEl.duration > 0) persistProgress(videoEl.currentTime, videoEl.duration);
  }, 5000);
  videoEl.addEventListener('ended', () => persistProgress(videoEl.duration, videoEl.duration));
}

function openLesson(lessonId) {
  const lesson = lessons.find((l) => l.id === lessonId);
  if (!lesson) return;
  destroyPlayer();
  activeLesson = lesson;
  lessonTitleEl.textContent = lesson.title;
  renderLessonFiles(lesson);
  updateLessonProgressUI(lesson);
  renderLessonsList();

  const startSeconds = lesson.progress?.completed ? 0 : (lesson.progress?.last_position || 0);
  const ytId = toYoutubeId(lesson.video_url || '');
  if (ytId) mountYoutubePlayer(ytId, startSeconds);
  else mountVideoTag(lesson.video_url || '', startSeconds);

  const url = new URL(location.href);
  url.searchParams.set('lesson', lessonId);
  history.replaceState(null, '', url);

  // أول مرة يفتح فيها الدرس: نضمن وجود سجل started_at حتى لو لم يشاهد ثانية بعد
  if (!lesson.progress) {
    recordLessonProgress({ studentId: user.id, lessonId: lesson.id, courseId, positionSeconds: 0, durationSeconds: 1 });
  }
}

function pickInitialLesson() {
  if (requestedLessonId && lessons.some((l) => l.id === requestedLessonId)) return requestedLessonId;
  const inProgress = lessons.find((l) => l.progress && !l.progress.completed);
  if (inProgress) return inProgress.id;
  const firstIncomplete = lessons.find((l) => !l.progress?.completed);
  return (firstIncomplete || lessons[0])?.id;
}

renderCourseProgress();
renderLessonsList();
if (lessons.length) {
  const initialId = pickInitialLesson();
  if (initialId) openLesson(initialId);
}

// نحفظ آخر موضع فور مغادرة الصفحة أيضًا (لو المستخدم قفل التاب بسرعة)
window.addEventListener('pagehide', () => {
  if (!activeLesson) return;
  const dur = ytPlayer?.getDuration ? ytPlayer.getDuration() : document.getElementById('pv-video-target')?.duration;
  const pos = ytPlayer?.getCurrentTime ? ytPlayer.getCurrentTime() : document.getElementById('pv-video-target')?.currentTime;
  if (dur > 0 && pos != null) {
    // محاولة أخيرة لحفظ آخر موضع (Best effort — قد لا تكتمل لو أُغلق التاب فورًا)
    recordLessonProgress({ studentId: user.id, lessonId: activeLesson.id, courseId, positionSeconds: pos, durationSeconds: dur });
  }
});
