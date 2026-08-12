import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export const message = 'حدث خطأ أثناء تنفيذ العملية. حاول مرة أخرى.';
export const escapeHtml = (value = '') => { const node = document.createElement('div'); node.textContent = value; return node.innerHTML; };
export const money = (value) => `${new Intl.NumberFormat('ar-EG').format(Number(value || 0))} ج.م`;
export async function sessionProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  return data || null;
}
export async function requireRole(...roles) {
  const profile = await sessionProfile();
  if (!profile || !roles.includes(profile.role) || !profile.is_active) { location.href = 'index.html'; return null; }
  return profile;
}
export async function logout() { await supabase.auth.signOut(); location.href = 'index.html'; }
