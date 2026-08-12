import { supabase, esc, money, genericError } from './supabase-client.js';
import { requireAuth } from './auth-guard.js';

const session = await requireAuth('admin');
if (!session) throw new Error('redirecting');

function empty(message) { return `<div class="empty-state">${message}</div>`; }
function setStatus(message, type = 'error') { const node = document.querySelector('[data-portal-status]'); if (node) { node.textContent = message; node.className = `status-message is-visible ${type}`; } }

function setNavigation() {
  const buttons = document.querySelectorAll('[data-view]');
  const views = document.querySelectorAll('.view');
  buttons.forEach((button) => button.addEventListener('click', () => {
    const selected = button.dataset.view;
    buttons.forEach((item) => item.classList.toggle('active', item.dataset.view === selected));
    views.forEach((view) => view.classList.toggle('active', view.id === selected));
    document.querySelector('[data-page-title]').textContent = button.dataset.title || 'لوحة الأدمن';
    onViewOpen(selected);
  }));
  document.querySelector('[data-logout]')?.addEventListener('click', async () => { await supabase.auth.signOut(); location.href = 'index.html'; });
}

function onViewOpen(view) {
  if (view === 'users') loadUsers();
  if (view === 'course-payments') loadCoursePayments();
  if (view === 'subscriptions') loadSubscriptionsOverview();
}

async function loadStats() {
  const [{ count: total }, { count: teachers }, { count: students }] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'teacher'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student'),
  ]);
  document.querySelector('[data-total-users]').textContent = total ?? 0;
  document.querySelector('[data-total-teachers]').textContent = teachers ?? 0;
  document.querySelector('[data-total-students]').textContent = students ?? 0;
}

/* ============================== إدارة المستخدمين ============================== */
async function loadUsers() {
  const target = document.querySelector('[data-users-list]');
  if (!target) return;
  const searchValue = document.querySelector('[data-user-search]')?.value.trim() || '';
  target.innerHTML = '<p class="loading">جاري التحميل…</p>';
  let query = supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(100);
  if (searchValue) query = query.or(`full_name.ilike.%${searchValue}%,email.ilike.%${searchValue}%`);
  const { data: users, error } = await query;
  if (error) { target.innerHTML = empty(genericError); return; }
  if (!users.length) { target.innerHTML = empty('لا يوجد مستخدمون مطابقون.'); return; }

  target.innerHTML = users.map((u) => `<div class="user-card">
    <h4>${esc(u.full_name)} ${u.is_active === false ? '<span class="status-badge rejected">موقوف</span>' : ''}</h4>
    <p>📧 ${esc(u.email || '—')}</p>
    <p>الدور الحالي: <strong>${{ admin: 'أدمن', teacher: 'مدرس', student: 'طالب' }[u.role] || u.role}</strong>${u.stage ? ' · ' + esc(u.stage) : ''}</p>
    <div class="row-actions">
      ${u.role !== 'teacher' ? `<button class="button button-secondary" data-set-role="${u.id}|teacher">ترقية لمدرس</button>` : ''}
      ${u.role !== 'student' ? `<button class="button button-secondary" data-set-role="${u.id}|student">تحويل لطالب</button>` : ''}
      ${u.role !== 'admin' ? `<button class="button button-secondary" data-set-role="${u.id}|admin">ترقية لأدمن</button>` : ''}
      <button class="button ${u.is_active === false ? 'button-primary' : 'button-danger'}" data-toggle-active="${u.id}|${u.is_active === false}">${u.is_active === false ? 'إلغاء الحظر' : 'حظر الحساب'}</button>
    </div>
  </div>`).join('');

  target.querySelectorAll('[data-set-role]').forEach((btn) => btn.addEventListener('click', async () => {
    const [id, role] = btn.dataset.setRole.split('|');
    if (!confirm(`تأكيد تغيير دور هذا المستخدم إلى "${role}"؟`)) return;
    const { error } = await supabase.from('profiles').update({ role }).eq('id', id);
    if (error) { alert(genericError); return; }
    loadUsers();
  }));
  target.querySelectorAll('[data-toggle-active]').forEach((btn) => btn.addEventListener('click', async () => {
    const [id, wasInactiveStr] = btn.dataset.toggleActive.split('|');
    const wasInactive = wasInactiveStr === 'true';
    const { error } = await supabase.from('profiles').update({ is_active: wasInactive }).eq('id', id);
    if (error) { alert(genericError); return; }
    loadUsers();
  }));
}

/* ============================== طلبات دفع الكورسات ============================== */
async function loadCoursePayments() {
  const target = document.querySelector('[data-course-payments-list]');
  if (!target) return;
  target.innerHTML = '<p class="loading">جاري التحميل…</p>';
  const { data: requests, error } = await supabase.from('payment_requests').select('*, profiles!student_id(full_name, email), courses(title)').order('created_at', { ascending: false }).limit(100);
  if (error) { target.innerHTML = empty(genericError); return; }
  target.innerHTML = requests.length ? `<table class="subscription-table"><thead><tr><th>الطالب</th><th>الكورس</th><th>المبلغ</th><th>الطريقة</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody>
    ${requests.map((r) => `<tr><td>${esc(r.profiles?.full_name || '—')}</td><td>${esc(r.courses?.title || '—')}</td><td>${money(r.amount)}</td><td>${esc(r.method)}</td>
      <td><span class="status-badge ${r.status}">${r.status === 'approved' ? 'مقبول' : r.status === 'rejected' ? 'مرفوض' : 'قيد المراجعة'}</span></td>
      <td>${r.status === 'pending' ? `<div class="row-actions"><button class="button button-primary" style="width:auto;padding:6px 12px" data-approve-pay="${r.id}">قبول</button><button class="button button-danger" style="width:auto;padding:6px 12px" data-reject-pay="${r.id}">رفض</button></div>` : '—'}</td>
    </tr>`).join('')}</tbody></table>` : empty('لا توجد طلبات دفع كورسات حتى الآن.');

  target.querySelectorAll('[data-approve-pay]').forEach((btn) => btn.addEventListener('click', async () => { await supabase.from('payment_requests').update({ status: 'approved' }).eq('id', btn.dataset.approvePay); loadCoursePayments(); }));
  target.querySelectorAll('[data-reject-pay]').forEach((btn) => btn.addEventListener('click', async () => { await supabase.from('payment_requests').update({ status: 'rejected' }).eq('id', btn.dataset.rejectPay); loadCoursePayments(); }));
}

/* ============================== نظرة عامة على الاشتراكات الشهرية ============================== */
async function loadSubscriptionsOverview() {
  const target = document.querySelector('[data-subscriptions-overview]');
  if (!target) return;
  target.innerHTML = '<p class="loading">جاري التحميل…</p>';
  const { data: subs, error } = await supabase.from('subscription_payments').select('*, student:profiles!student_id(full_name), teacher:profiles!teacher_id(full_name)').order('created_at', { ascending: false }).limit(100);
  if (error) { target.innerHTML = empty(genericError); return; }
  target.innerHTML = subs.length ? `<table class="subscription-table"><thead><tr><th>الطالب</th><th>المدرس</th><th>الشهر</th><th>المبلغ</th><th>الحالة</th></tr></thead><tbody>
    ${subs.map((s) => `<tr><td>${esc(s.student?.full_name || '—')}</td><td>${esc(s.teacher?.full_name || '—')}</td><td>${new Date(s.month).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long' })}</td><td>${money(s.amount)}</td>
      <td><span class="status-badge ${s.status}">${s.status === 'approved' ? 'مقبول' : s.status === 'rejected' ? 'مرفوض' : 'قيد المراجعة'}</span></td></tr>`).join('')}</tbody></table>
    <p class="course-meta" style="margin-top:12px">مراجعة وقبول طلبات الاشتراك الشهري تتم من كل مدرس بنفسه لطلابه. هذه الشاشة للاطّلاع فقط.</p>`
    : empty('لا توجد طلبات اشتراك شهري حتى الآن.');
}

/* ============================== تشغيل ============================== */
setNavigation();
loadStats();
document.querySelector('[data-user-search]')?.addEventListener('input', () => loadUsers());
