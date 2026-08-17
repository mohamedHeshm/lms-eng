import { supabase, esc, money, genericError, getCurrentSession } from './supabase-client.js';

// ⚠️ رقم المحفظة الإلكترونية الحقيقي غير موجود في أي جدول متاح حاليًا في المشروع.
// لا تضع رقمًا وهميًا هنا لأن أي خطأ سيؤدي لتحويل الطالب مبلغه لجهة غير صحيحة.
// اربط هذا المتغير برقم المحفظة الحقيقي (من جدول إعدادات في Supabase أو قيمة ثابتة تؤكدها الإدارة) قبل النشر.
const WALLET_NUMBER = '01225857167';

// رقم هاتف مصري صحيح: يبدأ بـ 010 أو 011 أو 012 أو 015 ثم 8 أرقام (11 رقمًا إجمالًا)
function isValidEgyptianPhone(value) {
  const digitsOnly = (value || '').replace(/\s+/g, '');
  return /^01[0125]\d{8}$/.test(digitsOnly);
}

function courseCard(course) {
  const title = esc(course.title || 'كورس جديد');
  const teacher = esc(course.teacher_name || 'فريق المنصة');
  const image = course.cover_image_url;
  const price = course.price || 0;
  const isFree = !price;
  return `<article class="course-card">
    <div class="course-cover">
      ${image ? `<img src="${esc(image)}" alt="${title}" loading="lazy">` : '◒'}
      <span class="cp-card-badge${isFree ? ' free' : ''}">${isFree ? 'مجاني' : 'مدفوع'}</span>
    </div>
    <div class="cp-card-body">
      <div class="cp-card-meta">
        ${course.stage ? `<span class="cp-stage">${esc(course.stage)}</span>` : ''}
        ${course.subject ? `<span class="cp-subject">${esc(course.subject)}</span>` : ''}
      </div>
      <h3 class="cp-card-title">${title}</h3>
      <p class="cp-card-teacher">مع <strong>${teacher}</strong></p>
      <div class="cp-card-divider"></div>
      <div class="cp-card-footer">
        <span class="cp-card-price">${price ? money(price) : 'مجانًا'}</span>
        <a class="cp-card-btn primary" href="checkout.html?course=${encodeURIComponent(course.id)}">التفاصيل <span class="cp-arrow">←</span></a>
      </div>
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
const shown = withTeacherName.filter((c) => {
  if (!search) return true;

  const searchableText = [
    c.title,
    c.teacher_name,
    c.subject,
    c.stage
  ]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('ar');

  return searchableText.includes(search);
});
  target.innerHTML = shown.length ? shown.map(courseCard).join('') : '<div class="empty-state">لا توجد كورسات مطابقة حاليًا.</div>';
}

async function initCourseLists() {
  const targets = document.querySelectorAll('[data-course-list]');
  if (!targets.length) return;

  const form = document.querySelector('[data-course-filters]');
  const searchInput =
    document.querySelector('[data-course-search]') ||
    form?.querySelector('input[type="search"]') ||
    form?.querySelector('input[name="search"]');

  let timer;

  const update = () => {
    clearTimeout(timer);

    timer = setTimeout(() => {
      const filters = form
        ? Object.fromEntries(new FormData(form).entries())
        : {};

      // نضمن إن قيمة البحث وصلت حتى لو الـ input مفيهوش name
      if (searchInput) {
        filters.search = searchInput.value.trim();
      }

      targets.forEach((target) => {
        loadCourses(target, filters);
      });
    }, 150);
  };

  // البحث أثناء الكتابة
  searchInput?.addEventListener('input', update);

  // باقي الفلاتر
  form?.addEventListener('change', update);

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
  const courseSubtotal = document.querySelector('[data-checkout-subtotal]');
  const courseTeacher = document.querySelector('[data-checkout-teacher]');
  const courseImage = document.querySelector('[data-checkout-image]');
  const courseImageFallback = document.querySelector('[data-checkout-image-fallback]');
  const summaryCard = document.querySelector('[data-checkout-summary]');
  const formWrap = document.querySelector('[data-checkout-form-wrap]');
  const resultCard = document.querySelector('[data-checkout-result]');
  const submitBtn = document.querySelector('[data-submit-btn]');
  const submitLabel = document.querySelector('[data-submit-label]');
  if (!courseId) { showStatus('اختر كورسًا أولًا من صفحة الكورسات.', 'error'); return; }

  summaryCard?.classList.add('is-loading');
  const { data: course, error } = await supabase.from('courses').select('*, profiles!teacher_id(full_name)').eq('id', courseId).single();
  summaryCard?.classList.remove('is-loading');
  if (error || !course) { showStatus(genericError, 'error'); return; }
  courseName.textContent = course.title;
  coursePrice.textContent = money(course.price);
  if (courseSubtotal) courseSubtotal.textContent = money(course.price);
  if (courseTeacher) courseTeacher.textContent = `مع ${course.profiles?.full_name || 'فريق المنصة'}`;
  if (courseImage) {
    if (course.cover_image_url) { courseImage.src = course.cover_image_url; courseImage.alt = course.title; courseImage.hidden = false; courseImageFallback?.setAttribute('hidden', ''); }
    else { courseImage.hidden = true; courseImageFallback?.removeAttribute('hidden'); }
  }

  /* -------- طريقة الدفع: رقم العملية + المحفظة + رقم الهاتف المحول منه -------- */
  const referenceInput = form.querySelector('[name="reference_number"]');
  const referenceLabel = form.querySelector('[data-reference-label]');
  const walletPanel = form.querySelector('[data-wallet-panel]');
  const walletNumberEl = form.querySelector('[data-wallet-number]');
  const senderPhoneWrap = form.querySelector('[data-sender-phone-wrap]');
  const senderPhoneInput = form.querySelector('[name="sender_phone"]');
  const senderPhoneError = form.querySelector('[data-sender-phone-error]');
  const copyBtn = form.querySelector('[data-copy-wallet]');
  const copyLabel = form.querySelector('[data-copy-wallet-label]');

  if (walletNumberEl) walletNumberEl.textContent = WALLET_NUMBER || 'سيتم توضيحه من الإدارة قريبًا';
  if (copyBtn && !WALLET_NUMBER) copyBtn.disabled = true;
  copyBtn?.addEventListener('click', async () => {
    if (!WALLET_NUMBER) return;
    try {
      await navigator.clipboard.writeText(WALLET_NUMBER);
      copyBtn.classList.add('is-copied');
      if (copyLabel) copyLabel.textContent = 'تم النسخ ✓';
      setTimeout(() => { copyBtn.classList.remove('is-copied'); if (copyLabel) copyLabel.textContent = 'نسخ الرقم'; }, 1800);
    } catch { /* المتصفح رفض الوصول للحافظة — تجاهل بصمت */ }
  });

  function clearSenderPhoneError() { senderPhoneWrap?.classList.remove('has-error'); if (senderPhoneError) senderPhoneError.hidden = true; }
  senderPhoneInput?.addEventListener('input', clearSenderPhoneError);

  function updateReferenceRequirement() {
    const method = form.querySelector('input[name="method"]:checked')?.value;
    const isWallet = method === 'wallet';
    referenceInput.required = isWallet;
    if (referenceLabel) referenceLabel.firstChild.textContent = isWallet ? 'رقم العملية اللي حوّلت بيه (إجباري)' : 'رقم العملية أو مرجع الدفع (اختياري)';
    if (walletPanel) walletPanel.hidden = !isWallet;
    if (!isWallet) { senderPhoneInput.required = false; senderPhoneInput.value = ''; clearSenderPhoneError(); }
    else { senderPhoneInput.required = true; }
  }
  form.querySelectorAll('input[name="method"]').forEach((radio) => radio.addEventListener('change', updateReferenceRequirement));
  updateReferenceRequirement();

  // إظهار حالة الاشتراك الحالية إن وُجدت
  const session = await getCurrentSession();
  if (session) {
    const { data: existing } = await supabase.from('enrollments').select('id').eq('student_id', session.user.id).eq('course_id', courseId).maybeSingle();
    if (existing) { showStatus('أنت مشترك بالفعل في هذا الكورس. يمكنك متابعته من لوحتك.', 'success'); submitBtn.disabled = true; }
  }

  function setSubmitLoading(isLoading) {
    submitBtn.disabled = isLoading;
    submitBtn.toggleAttribute('data-arrow-hidden', isLoading);
    if (submitLabel) submitLabel.textContent = isLoading ? 'جاري إرسال الطلب…' : 'إرسال طلب الدفع';
    let spinner = submitBtn.querySelector('.co-spinner');
    if (isLoading && !spinner) { spinner = document.createElement('span'); spinner.className = 'co-spinner'; submitBtn.appendChild(spinner); }
    else if (!isLoading && spinner) { spinner.remove(); }
  }

  function showResult(kind, { title, message, meta, retry }) {
    if (!resultCard) return;
    formWrap?.setAttribute('hidden', '');
    resultCard.hidden = false;
    resultCard.className = `checkout-card co-card co-result is-${kind}`;
    resultCard.innerHTML = `
      <div class="co-result-icon">${kind === 'success' ? '✓' : '⚠'}</div>
      <h3>${esc(title)}</h3>
      <p>${esc(message)}</p>
      ${meta ? `<div class="co-result-meta">${esc(meta)}</div>` : ''}
      <div class="co-result-actions">
        ${kind === 'success'
          ? `<a class="button button-primary" href="student-modern.html">العودة إلى لوحة الطالب</a><a class="button button-secondary" href="student-modern.html">عرض طلبات الدفع</a>`
          : `<button type="button" class="button button-primary" data-retry-btn>إعادة المحاولة</button>`}
      </div>`;
    if (retry) resultCard.querySelector('[data-retry-btn]')?.addEventListener('click', () => { resultCard.hidden = true; formWrap?.removeAttribute('hidden'); });
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
    if (fields.method === 'wallet' && !fields.reference_number?.trim()) {
      showStatus('من فضلك اكتب رقم العملية اللي حوّلت بيها عن طريق المحفظة الإلكترونية.', 'error');
      referenceInput.focus();
      return;
    }
    if (fields.method === 'wallet') {
      if (!isValidEgyptianPhone(fields.sender_phone)) {
        senderPhoneWrap?.classList.add('has-error');
        if (senderPhoneError) senderPhoneError.hidden = false;
        senderPhoneInput.focus();
        return;
      }
      clearSenderPhoneError();
    }

    setSubmitLoading(true);
    showStatus('جارٍ إرسال طلب الدفع للمراجعة…', '');

    const payload = {
      student_id: session.user.id, course_id: courseId, amount: course.price, method: fields.method,
      reference_number: fields.reference_number || null, notes: fields.notes || null, status: 'pending'
    };
    // عمود sender_phone يُرسل فقط عند الدفع بالمحفظة. إذا كان هذا العمود غير
    // موجود بعد في جدول payment_requests على Supabase يجب إضافته قبل النشر،
    // وإلا سيفشل الإدراج ويظهر رسالة الخطأ العامة أدناه دون أي تأثير آخر.
    if (fields.method === 'wallet') payload.sender_phone = fields.sender_phone.replace(/\s+/g, '');

    const { data: inserted, error: requestError } = await supabase.from('payment_requests').insert(payload).select().single();

    setSubmitLoading(false);
    if (requestError) {
      showResult('error', { title: 'تعذر إرسال طلب الدفع', message: 'حدث خطأ أثناء إرسال الطلب، حاول مرة أخرى.', retry: true });
      return;
    }
    showStatus('تم استلام طلب الدفع. ستصلك رسالة فور مراجعته وتفعيل الكورس.', 'success');
    showResult('success', { title: 'تم إرسال طلب الدفع', message: 'تم استلام طلبك بنجاح وسيتم مراجعته من الإدارة.', meta: `رقم الطلب: #${inserted?.id ?? '—'} · قيد المراجعة` });
    form.reset();
  });
}

function initCheckoutNavbarShadow() {
  const header = document.querySelector('[data-checkout-navbar]');
  if (!header) return;
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 4);
  document.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

document.addEventListener('DOMContentLoaded', () => { initCourseLists(); initCheckout(); initCheckoutNavbarShadow(); });