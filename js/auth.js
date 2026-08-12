import { supabase, message, sessionProfile } from './client.js';

const status = (selector, text, type = 'error') => { const node = document.querySelector(selector); if (node) { node.textContent = text; node.className = `status-message is-visible ${type}`; } };
document.addEventListener('DOMContentLoaded', () => {
  document.querySelector('[data-login]')?.addEventListener('submit', async (event) => {
    event.preventDefault(); const button = event.currentTarget.querySelector('button'); button.disabled = true;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const { error } = await supabase.auth.signInWithPassword({ email: values.email, password: values.password });
    if (error) { button.disabled = false; status('[data-status]', 'بيانات الدخول غير صحيحة أو الحساب غير مفعل.'); return; }
    const profile = await sessionProfile();
    if (!profile?.is_active) { await supabase.auth.signOut(); button.disabled = false; status('[data-status]', 'الحساب غير مفعّل. تواصل مع الإدارة.'); return; }
    location.href = profile.role === 'admin' ? 'admin.html' : profile.role === 'teacher' ? 'teacher.html' : 'student-modern.html';
  });
  document.querySelector('[data-register]')?.addEventListener('submit', async (event) => {
    event.preventDefault(); const button = event.currentTarget.querySelector('button'); button.disabled = true;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const { data, error } = await supabase.auth.signUp({ email: values.email, password: values.password, options: { data: { full_name: values.full_name } } });
    button.disabled = false;
    if (error) { status('[data-status]', 'تعذر إنشاء الحساب. تأكد من البريد وكلمة المرور ثم حاول مجددًا.'); return; }
    if (!data.session) { status('[data-status]', 'تم إنشاء الحساب. راجع بريدك الإلكتروني لتأكيده ثم سجّل الدخول.', 'success'); return; }
    location.href = 'student-modern.html';
  });
});
