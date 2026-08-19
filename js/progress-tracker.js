// ============================================================================
// وحدة تتبع تقدّم الطالب في الدروس — تُستخدم من صفحة تشغيل الدرس (الطالب)
// ومن لوحتي الطالب والمدرس لعرض نسب التقدم دون أي Mock Data.
// كل شيء هنا يقرأ/يكتب في جدول lesson_watch_progress الموجود بالفعل في
// المشروع (بعد تشغيل sql/lms-migrations.sql) + الـ Views المرتبطة به.
// ============================================================================
import { supabase } from './supabase-client.js';

export const COMPLETE_THRESHOLD = 90; // % التي نعتبر بعدها الدرس مكتملًا

const clampPct = (value) => Math.max(0, Math.min(100, Math.round(value || 0)));

/** يرجع سجل تقدم الطالب في درس معيّن، أو null لو لسه ما بدأش */
export async function getLessonProgress(studentId, lessonId) {
  if (!studentId || !lessonId) return null;
  const { data, error } = await supabase
    .from('lesson_watch_progress')
    .select('*')
    .eq('student_id', studentId)
    .eq('lesson_id', lessonId)
    .maybeSingle();
  if (error) return null;
  return data;
}

/**
 * يسجّل/يحدّث تقدم الطالب في الدرس. يُستدعى بشكل دوري (كل ~5 ثوانٍ) أثناء
 * التشغيل، وعند الخروج من الصفحة، وعند إغلاق الفيديو.
 * النسبة لا تتراجع للخلف أبدًا حتى لو رجع الطالب لبداية الفيديو (بيرجع
 * لآخر مكان توقف عنده في المرة الجاية فقط، مش بتقلل نسبة إنجازه).
 */
export async function recordLessonProgress({ studentId, lessonId, courseId, positionSeconds, durationSeconds }) {
  if (!studentId || !lessonId || !courseId) return { error: 'missing-ids' };

  const existing = await getLessonProgress(studentId, lessonId);
  const rawPct = durationSeconds > 0 ? (positionSeconds / durationSeconds) * 100 : 0;
  const newPct = clampPct(rawPct);
  const bestPct = Math.max(newPct, existing?.progress_percentage || 0);
  const wasCompleted = !!existing?.completed;
  const isNowCompleted = wasCompleted || bestPct >= COMPLETE_THRESHOLD;
  const justCompleted = isNowCompleted && !wasCompleted;

  const payload = {
    student_id: studentId,
    lesson_id: lessonId,
    course_id: courseId,
    last_position: Math.max(0, Math.floor(positionSeconds || 0)),
    progress_percentage: bestPct,
    completed: isNowCompleted,
    last_watched_at: new Date().toISOString(),
    started_at: existing?.started_at || new Date().toISOString(),
    completed_at: justCompleted ? new Date().toISOString() : (existing?.completed_at || null),
  };

  const { data, error } = await supabase
    .from('lesson_watch_progress')
    .upsert(payload, { onConflict: 'student_id,lesson_id' })
    .select()
    .single();

  return { data, error, justCompleted };
}

/** تقدم الطالب في كل الكورسات المفعّلة عنده — Query واحد بدل N+1 */
export async function getAllCourseProgress(studentId) {
  const { data, error } = await supabase
    .from('v_course_progress')
    .select('*')
    .eq('student_id', studentId)
    .order('last_watched_at', { ascending: false, nullsFirst: false });
  if (error) return [];
  return data || [];
}

/** تقدم الطالب في كورس واحد بالتحديد */
export async function getCourseProgress(studentId, courseId) {
  const { data, error } = await supabase
    .from('v_course_progress')
    .select('*')
    .eq('student_id', studentId)
    .eq('course_id', courseId)
    .maybeSingle();
  if (error) return null;
  return data;
}

/** آخر درس غير مكتمل للطالب — لبطاقة "أكمل من حيث توقفت" */
export async function getContinueWatching(studentId) {
  const { data, error } = await supabase
    .from('v_continue_watching')
    .select('*')
    .eq('student_id', studentId)
    .maybeSingle();
  if (error) return null;
  return data;
}

/** كل دروس كورس معيّن مع حالة تقدم الطالب في كل درس (لصفحة تشغيل الدرس) */
export async function getLessonsWithProgress(studentId, courseId) {
  const [{ data: lessons, error: lessonsError }, { data: progressRows }] = await Promise.all([
    supabase.from('course_lessons').select('*').eq('course_id', courseId).order('sort_order', { ascending: true }),
    supabase.from('lesson_watch_progress').select('*').eq('student_id', studentId).eq('course_id', courseId),
  ]);
  if (lessonsError) return [];
  const progressByLesson = Object.fromEntries((progressRows || []).map((p) => [p.lesson_id, p]));
  return (lessons || []).map((l) => ({ ...l, progress: progressByLesson[l.id] || null }));
}

export function progressBarHtml(percentage, { height = 8 } = {}) {
  const pct = clampPct(percentage);
  return `<div class="lp-bar" style="--lp-h:${height}px"><span style="width:${pct}%"></span></div>`;
}
