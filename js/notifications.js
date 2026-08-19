// ============================================================================
// وحدة الإشعارات المشتركة — تُستخدم في لوحة الطالب ولوحة المدرس.
// تعتمد بالكامل على جدول notifications في Supabase (بعد تشغيل الـ migration).
// ============================================================================
import { supabase, esc } from './supabase-client.js';

export const NOTIF_ICONS = {
  lesson: '▶',
  course: '📚',
  quiz: '📝',
  quiz_result: '✅',
  material: '📄',
  announcement: '📢',
  homework: '📝',
  subscription: '⏰',
  new_student: '🎓',
  new_subscription: '💳',
  needs_attention: '⚠️',
  new_submission: '📥',
  general: '🔔',
};

export function timeAgoAr(dateStr) {
  if (!dateStr) return '—';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'الآن';
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `منذ ${days} يوم`;
  return new Date(dateStr).toLocaleDateString('ar-EG');
}

export async function fetchNotifications(userId, { limit = 20 } = {}) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return [];
  return data || [];
}

export async function unreadCount(userId) {
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  return count || 0;
}

export async function markRead(id) {
  return supabase.from('notifications').update({ is_read: true }).eq('id', id);
}

export async function markAllRead(userId) {
  return supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false);
}

/** إنشاء إشعار — عملية "Best Effort": لا توقف تدفق العملية الأساسية لو فشلت */
export async function notify(userId, { title, message = '', type = 'general', relatedId = null, relatedType = null }) {
  if (!userId) return;
  try {
    await supabase.from('notifications').insert({
      user_id: userId, title, message, type, related_id: relatedId, related_type: relatedType,
    });
  } catch { /* تجاهل بصمت — الإشعار ثانوي وليس أساسيًا للعملية */ }
}

/** إشعار جماعي لعدة مستخدمين دفعة واحدة (مثال: إشعار كل الطلاب بدرس جديد) */
export async function notifyMany(userIds, { title, message = '', type = 'general', relatedId = null, relatedType = null }) {
  const ids = (userIds || []).filter(Boolean);
  if (!ids.length) return;
  try {
    await supabase.from('notifications').insert(
      ids.map((user_id) => ({ user_id, title, message, type, related_id: relatedId, related_type: relatedType }))
    );
  } catch { /* تجاهل بصمت */ }
}

export function subscribeRealtimeNotifications(userId, onInsert) {
  if (!userId) return null;
  const channel = supabase
    .channel(`notifications-${userId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, (payload) => onInsert(payload.new))
    .subscribe();
  return channel;
}

/** يبني HTML لقائمة الإشعارات المنسدلة (بدون ربط أحداث) */
export function renderNotifList(items) {
  if (!items.length) return '<div class="notif-empty">لا توجد إشعارات جديدة حاليًا.</div>';
  return items.map((n) => `
    <button class="notif-item ${n.is_read ? '' : 'unread'}" data-notif-id="${n.id}" data-notif-related="${esc(n.related_type || '')}" data-notif-related-id="${esc(n.related_id || '')}">
      <span class="notif-item-icon">${NOTIF_ICONS[n.type] || NOTIF_ICONS.general}</span>
      <span class="notif-item-body">
        <strong>${esc(n.title)}</strong>
        ${n.message ? `<span class="notif-item-msg">${esc(n.message)}</span>` : ''}
        <span class="notif-item-time">${timeAgoAr(n.created_at)}</span>
      </span>
      ${!n.is_read ? '<span class="notif-dot" aria-hidden="true"></span>' : ''}
    </button>`).join('');
}
