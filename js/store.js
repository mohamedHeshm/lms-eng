import { supabase, esc, money, genericError, getCurrentSession } from './supabase-client.js';

function courseCard(course) {
  const title = esc(course.title || 'كورس جديد');
  const teacher = esc(course.teacher_name || 'فريق المنصة');
  const image = course.cover_image_url;
  const price = course.price || 0;
  return `<article class="course-card">
    <div class="course-cover">${image ? `<img src="${esc(image)}" alt="${title}">` : '◒'}</div>
    <div class="course-card-body">
      <div><div class="course-meta">${esc(course.stage || 'المرحلة الثانوية')} · ${esc(course.subject || '')}</div><h3>${title}</h3><p class="course-meta">مع ${teacher}</p></div>
      <div class="course-footer"><span class="price">${price ? money(price) : 'مجانًا'}</span><a class="button button-secondary" href="checkout.html?course=${encodeURIComponent(course.id)}">التفاصيل</a></div>
    </div>
  </article>`;
}

async function loadCourses(target, filters = {}) {
  target.innerHTML = '<p class="loading">جاري تحميل الكورسات…</p>';
  let query = supabase.from('courses').select('*, profiles!teacher_id(full_name)').eq('is_published', true).order('created_at', { ascending: false });
  if (filters.stage) query = query.eq('stage', filters.stage);
  if (filters.subject) query = query.eq('subject', filters.subject);
  const { data: courses, error } = await query;
  if (error) { target.innerHTML = `<div class="empty-state">${genericError}</div>`; return; }

  const search = (filters.search || '').trim().toLocaleLowerCase('ar');
  const withTeacherName = (courses || []).map((c) => ({ ...c, teacher_name: c.profiles?.full_name }));
  const shown = withTeacherName.filter((c) => !search || `${c.title} ${c.teacher_name || ''}`.toLocaleLowerCase('ar').includes(search));

  target.innerHTML = shown.length ? shown.map(courseCard).join('') : '<div class="empty-state">لا توجد كورسات مطابقة حاليًا.</div>';
}

async function initCourseLists() {
  const targets = document.querySelectorAll('[data-course-list]');
  if (!targets.length) return;
  const form = document.querySelector('[data-course-filters]');
  const update = () => targets.forEach((target) => loadCourses(target, form ? Object.fromEntries(new FormData(form).entries()) : {}));
  if (form) form.addEventListener('input', update);
  update();
}

function showStatus(message, type) {
  const status = document.querySelector('[data-payment-status]');
  if (status) { status.textContent = message; status.className = `status-message is-visible ${type}`; }
}

async function initCheckout() {
  const form = document.querySelector('[data-checkout-form]');
  if (!form) return;
  const params = new URLSearchParams(location.search);
  const courseId = params.get('course');
  const courseName = document.querySelector('[data-checkout-course]');
  const coursePrice = document.querySelector('[data-checkout-price]');
  if (!courseId) { showStatus('اختر كورسًا أولًا من صفحة الكورسات.', 'error'); return; }

  const { data: course, error } = await supabase.from('courses').select('*').eq('id', courseId).single();
  if (error || !course) { showStatus(genericError, 'error'); return; }
  courseName.textContent = course.title;
  coursePrice.textContent = money(course.price);

  // إظهار حالة الاشتراك الحالية إن وُجدت
  const session = await getCurrentSession();
  if (session) {
    const { data: existing } = await supabase.from('enrollments').select('id').eq('student_id', session.user.id).eq('course_id', courseId).maybeSingle();
    if (existing) { showStatus('أنت مشترك بالفعل في هذا الكورس. يمكنك متابعته من لوحتك.', 'success'); form.querySelector('button[type="submit"]').disabled = true; }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const session = await getCurrentSession();
    if (!session) { location.href = 'index.html'; return; }

    const fields = Object.fromEntries(new FormData(form).entries());
    if (fields.method === 'online') {
      showStatus('الدفع أونلاين غير متاح حاليًا. اختر الدفع داخل السنتر أو التحويل، أو تواصل مع الإدارة.', 'error');
      return;
    }

    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    showStatus('جارٍ إرسال طلب الدفع للمراجعة…', '');

    const { error: requestError } = await supabase.from('payment_requests').insert({
      student_id: session.user.id, course_id: courseId, amount: course.price, method: fields.method,
      reference_number: fields.reference_number || null, notes: fields.notes || null, status: 'pending'
    });

    if (requestError) { submit.disabled = false; showStatus(genericError, 'error'); return; }
    showStatus('تم استلام طلب الدفع. ستصلك رسالة فور مراجعته وتفعيل الكورس.', 'success');
    form.reset();
  });
}

document.addEventListener('DOMContentLoaded', () => { initCourseLists(); initCheckout(); });
