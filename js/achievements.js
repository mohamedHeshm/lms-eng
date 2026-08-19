// ============================================================================
// وحدة إنجازات الطالب — تُفتح تلقائيًا عند تحقق الشرط وتُحفظ في
// student_achievements. تصميم بسيط واحترافي (ليس طفوليًا).
// ============================================================================
import { supabase } from './supabase-client.js';
import { notify } from './notifications.js';

export const ACHIEVEMENTS = [
  { id: 'first_lesson', icon: '🏆', title: 'أول درس', desc: 'أكملت أول درس في المنصة', check: (s) => s.completedLessons >= 1 },
  { id: 'ten_lessons', icon: '📚', title: '10 دروس', desc: 'أكملت 10 دروس', check: (s) => s.completedLessons >= 10 },
  { id: 'twenty_five_lessons', icon: '🎯', title: '25 درسًا', desc: 'أكملت 25 درسًا', check: (s) => s.completedLessons >= 25 },
  { id: 'course_complete', icon: '🏅', title: 'كورس كامل', desc: 'أنهيت كورسًا بالكامل', check: (s) => s.hasCompletedCourse },
  { id: 'active_week', icon: '🔥', title: 'أسبوع نشط', desc: 'درست لمدة 7 أيام متتالية', check: (s) => s.activeDaysInWeek >= 7 },
  { id: 'top_scorer', icon: '⭐', title: 'متفوق', desc: 'حصلت على متوسط مرتفع في الاختبارات', check: (s) => s.avgQuizScore >= 85 && s.quizAttempts >= 3 },
];

const byId = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

export async function getEarnedAchievements(studentId) {
  const { data, error } = await supabase
    .from('student_achievements')
    .select('*')
    .eq('student_id', studentId)
    .order('earned_at', { ascending: false });
  if (error) return [];
  return data || [];
}

/** يحسب إحصائيات الطالب اللازمة لفحص الإنجازات من بيانات حقيقية فقط */
export async function computeStudentStats(studentId) {
  const [{ data: progressRows }, { data: courseProgress }, { data: attempts }] = await Promise.all([
    supabase.from('lesson_watch_progress').select('completed, last_watched_at').eq('student_id', studentId),
    supabase.from('v_course_progress').select('total_lessons, completed_lessons').eq('student_id', studentId),
    supabase.from('quiz_attempts').select('score, total').eq('student_id', studentId),
  ]);

  const completedLessons = (progressRows || []).filter((r) => r.completed).length;
  const hasCompletedCourse = (courseProgress || []).some((c) => c.total_lessons > 0 && c.completed_lessons >= c.total_lessons);

  const days = new Set((progressRows || [])
    .map((r) => r.last_watched_at)
    .filter(Boolean)
    .filter((d) => (Date.now() - new Date(d).getTime()) <= 7 * 24 * 60 * 60 * 1000)
    .map((d) => new Date(d).toDateString()));
  const activeDaysInWeek = days.size;

  const quizAttempts = (attempts || []).length;
  const avgQuizScore = quizAttempts
    ? Math.round((attempts.reduce((sum, a) => sum + (a.total ? (a.score / a.total) * 100 : 0), 0) / quizAttempts))
    : 0;

  return { completedLessons, hasCompletedCourse, activeDaysInWeek, quizAttempts, avgQuizScore };
}

/**
 * يفحص كل الإنجازات ويفتح أي إنجاز جديد تحقق شرطه (مع منع التكرار عبر
 * Unique Constraint في قاعدة البيانات). يُستدعى بعد كل حدث مهم (اكتمال درس،
 * تسليم اختبار...). يرجع مصفوفة الإنجازات المفتوحة حديثًا فقط.
 */
export async function checkAndAwardAchievements(studentId) {
  if (!studentId) return [];
  const alreadyEarned = new Set((await getEarnedAchievements(studentId)).map((a) => a.achievement_id));
  const stats = await computeStudentStats(studentId);

  const toAward = ACHIEVEMENTS.filter((a) => !alreadyEarned.has(a.id) && a.check(stats));
  const newlyEarned = [];

  for (const achievement of toAward) {
    const { error } = await supabase.from('student_achievements').insert({ student_id: studentId, achievement_id: achievement.id });
    if (!error) {
      newlyEarned.push(achievement);
      await notify(studentId, {
        title: `إنجاز جديد ${achievement.icon}`,
        message: `${achievement.title} — ${achievement.desc}`,
        type: 'general',
        relatedType: 'achievement',
        relatedId: null,
      });
    }
  }
  return newlyEarned;
}

export function achievementMeta(achievementId) {
  return byId[achievementId] || { id: achievementId, icon: '🏆', title: achievementId, desc: '' };
}
