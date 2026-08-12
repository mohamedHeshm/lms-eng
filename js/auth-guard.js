// ============================================================================
// حماية الصفحات: تتأكد أن المستخدم مسجّل دخول عبر Supabase Auth وأن دوره
// مطابق للصفحة المطلوبة. تُستدعى من أعلى كل صفحة محمية قبل أي شيء آخر.
// ============================================================================
import { getCurrentSession } from './supabase-client.js';

/**
 * @param {string|string[]|null} allowedRoles دور أو مجموعة أدوار مسموح لها بفتح الصفحة، أو null لأي مستخدم مسجّل دخول
 * @returns {Promise<{user:any, profile:any}|null>} الجلسة إذا كانت صالحة، وإلا يعمل تحويل ويرجع null
 */
export async function requireAuth(allowedRoles = null) {
  const session = await getCurrentSession();
  if (!session) {
    location.href = 'index.html';
    return null;
  }
  if (!session.profile.is_active) {
    await import('./supabase-client.js').then(({ supabase }) => supabase.auth.signOut());
    alert('هذا الحساب موقوف. تواصل مع الإدارة.');
    location.href = 'index.html';
    return null;
  }
  const roles = allowedRoles ? (Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]) : null;
  if (roles && !roles.includes(session.profile.role)) {
    const home = { admin: 'admin.html', teacher: 'teacher.html', student: 'student-modern.html' }[session.profile.role] || 'index.html';
    location.href = home;
    return null;
  }
  return session;
}
