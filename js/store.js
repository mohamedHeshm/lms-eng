import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = 'https://dfxkuppxywldxsbyzfzo.supabase.co';
const supabaseKey = 'sb_publishable_B3xVoCtEJtpStm76kM5KDw_WZgPsJXN';
const supabase = createClient(supabaseUrl, supabaseKey);
const userMessage = 'حدث خطأ أثناء تنفيذ العملية. حاول مرة أخرى.';

const escapeHtml = (value = '') => { const el = document.createElement('div'); el.textContent = value; return el.innerHTML; };
const money = (amount) => `${new Intl.NumberFormat('ar-EG').format(Number(amount || 0))} ج.م`;

function courseCard(course) {
  const title = escapeHtml(course.title || course.name || 'كورس جديد');
  const teacher = escapeHtml(course.teacher_name || 'فريق المنصة');
  const image = course.cover_image_url || course.image_url;
  const lessons = course.lessons_count || course.lesson_count || 0;
  const price = course.price || 0;
  return `<article class="course-card">
    <div class="course-cover">${image ? `<img src="${escapeHtml(image)}" alt="${title}">` : '◒'}</div>
    <div class="course-card-body"><div><div class="course-meta">${escapeHtml(course.stage || 'المرحلة الثانوية')} · ${lessons} درس</div><h3>${title}</h3><p class="course-meta">مع ${teacher}</p></div>
    <div class="course-footer"><span class="price">${price ? money(price) : 'مجانًا'}</span><a class="button button-secondary" href="checkout.html?course=${encodeURIComponent(course.id)}">التفاصيل</a></div></div>
  </article>`;
}

async function loadCourses(target, filters = {}) {
  target.innerHTML = '<p class="loading">جاري تحميل الكورسات…</p>';
  let query = supabase.from('courses').select('*').eq('is_published', true).order('created_at', { ascending: false });
  if (filters.stage) query = query.eq('stage', filters.stage);
  if (filters.subject) query = query.eq('subject', filters.subject);
  const { data, error } = await query;
  if (error) { console.error('Courses loading failed', error); target.innerHTML = `<div class="empty-state">${userMessage}</div>`; return; }
  const search = (filters.search || '').trim().toLocaleLowerCase('ar');
  const shown = (data || []).filter((course) => !search || `${course.title || course.name || ''} ${course.teacher_name || ''}`.toLocaleLowerCase('ar').includes(search));
  target.innerHTML = shown.length ? shown.map(courseCard).join('') : '<div class="empty-state">لا توجد كورسات مطابقة حاليًا.</div>';
}

async function initCourseLists() {
  const target = document.querySelector('[data-course-list]');
  if (!target) return;
  const form = document.querySelector('[data-course-filters]');
  const update = () => loadCourses(target, Object.fromEntries(new FormData(form).entries()));
  if (form) form.addEventListener('input', update);
  await update();
}

function showStatus(message, type) { const status = document.querySelector('[data-payment-status]'); if (status) { status.textContent = message; status.className = `status-message is-visible ${type}`; } }

async function initCheckout() {
  const form = document.querySelector('[data-checkout-form]');
  if (!form) return;
  const courseId = new URLSearchParams(location.search).get('course');
  const courseName = document.querySelector('[data-checkout-course]');
  const coursePrice = document.querySelector('[data-checkout-price]');
  if (!courseId) { showStatus('اختر كورسًا أولًا من صفحة الكورسات.', 'error'); return; }
  const { data: course, error } = await supabase.from('courses').select('*').eq('id', courseId).single();
  if (error || !course) { console.error('Course loading failed', error); showStatus(userMessage, 'error'); return; }
  courseName.textContent = course.title || course.name || 'الكورس';
  coursePrice.textContent = money(course.price);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) { location.href = 'index.html'; return; }
    const fields = Object.fromEntries(new FormData(form).entries());
    if (fields.method === 'online') {
      showStatus('الدفع أونلاين غير متاح حاليًا. اختر الدفع داخل السنتر أو التحويل، أو تواصل مع الإدارة.', 'error');
      return;
    }
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    showStatus('جارٍ إرسال طلب الدفع للمراجعة…', '');
    const { error: requestError } = await supabase.from('payment_requests').insert({
      student_id: user.id, course_id: courseId, amount: course.price, method: fields.method,
      reference_number: fields.reference_number || null, notes: fields.notes || null, status: 'pending'
    });
    submit.disabled = false;
    if (requestError) { console.error('Payment request failed', requestError); showStatus(userMessage, 'error'); return; }
    showStatus('تم استلام طلب الدفع. ستصلك رسالة فور مراجعته وتفعيل الكورس.', 'success');
    form.reset();
  });
}

document.addEventListener('DOMContentLoaded', () => { initCourseLists(); initCheckout(); });
