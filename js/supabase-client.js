// ============================================================================
// عميل Supabase الموحّد — يُستورد من أي صفحة بدل تكرار الإعداد في كل ملف
// ============================================================================
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

export const SUPABASE_URL = 'https://zmodutxckghvsscvnqya.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_7dRt2_fnP_T1WwtsbponUA__jqGWlYp';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const genericError = 'حدث خطأ أثناء تنفيذ العملية. حاول مرة أخرى.';

export const esc = (value = '') => {
const node = document.createElement('div');
node.textContent = value ?? '';
return node.innerHTML;
};

export const money = (value) => `${new Intl.NumberFormat('ar-EG').format(Number(value || 0))} ج.م`;

export function currentMonthStart(date = new Date()) {
// مهم: نبني السلسلة النصية مباشرة من السنة/الشهر المحليين بدل استخدام
// toISOString() (اللي بيحوّل لتوقيت UTC وبيغيّر التاريخ لو المستخدم في
// منطقة زمنية متقدمة عن UTC، زي مصر +3، فيرجع يوم غلط "آخر يوم في الشهر
// السابق" بدل أول يوم في الشهر الحالي).
const year = date.getFullYear();
const month = String(date.getMonth() + 1).padStart(2, '0');
return `${year}-${month}-01`;
}

/** يرجع { user, profile } للمستخدم الحالي المسجل دخوله عبر Supabase Auth، أو null */
export async function getCurrentSession() {
const { data: { user } } = await supabase.auth.getUser();
if (!user) return null;
const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
if (error || !profile) return null;
return { user, profile };
}

export async function logout() {
await supabase.auth.signOut();
location.href = 'index.html';
}