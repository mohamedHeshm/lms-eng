-- ============================================================================
-- المأمون التعليمية — سكيمة قاعدة البيانات الكاملة (النظام الجديد فقط)
-- شغّل هذا الملف كامل في Supabase SQL Editor على مشروع جديد أو نظيف.
-- يفترض أن جداول قديمة مثل users / playlists / playlist_videos / videos /
-- pdfs / pdfs2 / sample_videos غير مستخدمة بعد الآن ويمكن حذفها لاحقًا يدويًا
-- بعد التأكد من ترحيل أي بيانات مهمة.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ============================================================================
-- 1) PROFILES — ملف كل مستخدم، مرتبط مباشرة بـ auth.users (Supabase Auth)
-- ============================================================================
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text,                         -- منسوخة من auth.users عند التسجيل ليسهل على الأدمن إدارة الأدوار
  role text not null check (role in ('admin','teacher','student')),
  stage text,                         -- مرحلة الطالب الدراسية
  teacher_id uuid references profiles(id) on delete set null, -- المدرس المسؤول عن الطالب (للاشتراك الشهري)
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- إنشاء بروفايل تلقائيًا عند التسجيل عبر Supabase Auth
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role, stage)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'مستخدم جديد'),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'student'),
    new.raw_user_meta_data->>'stage'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================================
-- 2) COURSES + LESSONS (تحل محل playlists / playlist_videos القديمة)
-- ============================================================================
create table if not exists courses (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  subject text,
  stage text,
  price numeric not null default 0,
  description text,
  cover_image_url text,
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists course_lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  title text not null,
  video_url text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (student_id, course_id)
);

-- ============================================================================
-- 3) طلبات دفع الكورسات (منفصلة تمامًا عن الاشتراك الشهري)
-- ============================================================================
create table if not exists payment_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  amount numeric not null,
  method text not null check (method in ('cash','wallet','bank_transfer','online')),
  reference_number text,
  notes text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references profiles(id)
);

-- عند القبول: ينشئ اشتراك (enrollment) تلقائيًا
create or replace function approve_course_payment()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    insert into enrollments (student_id, course_id)
    values (new.student_id, new.course_id)
    on conflict (student_id, course_id) do nothing;
    new.reviewed_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists on_payment_request_approved on payment_requests;
create trigger on_payment_request_approved
  before update on payment_requests
  for each row execute function approve_course_payment();

-- ============================================================================
-- 4) الاشتراك الشهري عند المدرس (منفصل تمامًا عن دفع الكورسات)
--    الطالب يدفع اشتراك شهري لمدرسه؛ لو مش مدفوع للشهر الحالي يتحظر عن
--    الاختبارات/الشيتات/السبورة/المذكرات الخاصة بهذا المدرس.
-- ============================================================================
create table if not exists subscription_payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,
  teacher_id uuid not null references profiles(id) on delete cascade,
  month date not null,               -- أول يوم في الشهر المقصود، مثال: 2026-08-01
  amount numeric not null,
  method text not null check (method in ('cash','wallet','bank_transfer','online')),
  reference_number text,
  notes text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references profiles(id),
  unique (student_id, teacher_id, month)
);

create or replace function mark_subscription_reviewed()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.status in ('approved','rejected') and old.status is distinct from new.status then
    new.reviewed_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists on_subscription_reviewed on subscription_payments;
create trigger on_subscription_reviewed
  before update on subscription_payments
  for each row execute function mark_subscription_reviewed();

-- دالة تتحقق هل الطالب مشترك فعليًا عند مدرسه للشهر الحالي (أو شهر محدد)
create or replace function has_active_subscription(p_student uuid, p_teacher uuid, p_month date default date_trunc('month', now())::date)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from subscription_payments
    where student_id = p_student
      and teacher_id = p_teacher
      and month = date_trunc('month', p_month)::date
      and status = 'approved'
  );
$$;

-- ============================================================================
-- 5) المواد التعليمية: شيتات + سبورة + مذكرات، مرتبطة بمرحلة معينة
--    (تظهر فقط للطلاب المشتركين اشتراك شهري ساري عند نفس المدرس)
-- ============================================================================
create table if not exists materials (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references profiles(id) on delete cascade,
  type text not null check (type in ('sheet','board','note')), -- شيت / سبورة / مذكرة
  stage text not null,
  title text not null,
  file_url text not null,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 6) الاختبارات أونلاين — مرتبطة بمرحلة، ومحظورة عن غير المشتركين
-- ============================================================================
create table if not exists quizzes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references profiles(id) on delete cascade,
  stage text not null,
  title text not null,
  description text,
  duration_minutes int,
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references quizzes(id) on delete cascade,
  question_text text not null,
  options jsonb not null,          -- ["اختيار 1", "اختيار 2", ...]
  correct_index int not null,
  sort_order int not null default 0
);

create table if not exists quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references quizzes(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  answers jsonb not null,          -- { "question_id": chosen_index }
  score int not null,
  total int not null,
  submitted_at timestamptz not null default now(),
  unique (quiz_id, student_id)
);

-- ============================================================================
-- 7) تفعيل RLS على كل الجداول
-- ============================================================================
alter table profiles enable row level security;
alter table courses enable row level security;
alter table course_lessons enable row level security;
alter table enrollments enable row level security;
alter table payment_requests enable row level security;
alter table subscription_payments enable row level security;
alter table materials enable row level security;
alter table quizzes enable row level security;
alter table quiz_questions enable row level security;
alter table quiz_attempts enable row level security;

-- Helper: هل المستخدم الحالي أدمن؟
create or replace function is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

-- ---------- profiles ----------
drop policy if exists "profiles_select_own_or_admin" on profiles;
create policy "profiles_select_own_or_admin" on profiles for select
  using (id = auth.uid() or is_admin() or
         -- المدرس يقدر يشوف بروفايلات طلابه
         (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'teacher') and teacher_id = auth.uid()));

drop policy if exists "profiles_update_own_or_admin" on profiles;
create policy "profiles_update_own_or_admin" on profiles for update
  using (id = auth.uid() or is_admin());

drop policy if exists "profiles_insert_admin" on profiles;
create policy "profiles_insert_admin" on profiles for insert
  with check (id = auth.uid() or is_admin());

-- ---------- courses ----------
drop policy if exists "courses_public_read_published" on courses;
create policy "courses_public_read_published" on courses for select
  using (is_published = true or teacher_id = auth.uid() or is_admin());

drop policy if exists "courses_teacher_write" on courses;
create policy "courses_teacher_write" on courses for insert
  with check (teacher_id = auth.uid());
drop policy if exists "courses_teacher_update" on courses;
create policy "courses_teacher_update" on courses for update
  using (teacher_id = auth.uid() or is_admin());
drop policy if exists "courses_teacher_delete" on courses;
create policy "courses_teacher_delete" on courses for delete
  using (teacher_id = auth.uid() or is_admin());

-- ---------- course_lessons ----------
drop policy if exists "lessons_read" on course_lessons;
create policy "lessons_read" on course_lessons for select
  using (
    exists (select 1 from courses c where c.id = course_id and (c.teacher_id = auth.uid() or is_admin()))
    or exists (select 1 from enrollments e join courses c on c.id = e.course_id
               where c.id = course_id and e.student_id = auth.uid())
  );
drop policy if exists "lessons_write" on course_lessons;
create policy "lessons_write" on course_lessons for all
  using (exists (select 1 from courses c where c.id = course_id and c.teacher_id = auth.uid()))
  with check (exists (select 1 from courses c where c.id = course_id and c.teacher_id = auth.uid()));

-- ---------- enrollments ----------
drop policy if exists "enrollments_read_own" on enrollments;
create policy "enrollments_read_own" on enrollments for select
  using (student_id = auth.uid() or is_admin()
         or exists (select 1 from courses c where c.id = course_id and c.teacher_id = auth.uid()));
drop policy if exists "enrollments_admin_write" on enrollments;
create policy "enrollments_admin_write" on enrollments for all
  using (is_admin()) with check (is_admin());

-- ---------- payment_requests (دفع الكورس) ----------
drop policy if exists "payreq_student_insert" on payment_requests;
create policy "payreq_student_insert" on payment_requests for insert
  with check (student_id = auth.uid());
drop policy if exists "payreq_read" on payment_requests;
create policy "payreq_read" on payment_requests for select
  using (student_id = auth.uid() or is_admin()
         or exists (select 1 from courses c where c.id = course_id and c.teacher_id = auth.uid()));
drop policy if exists "payreq_admin_update" on payment_requests;
create policy "payreq_admin_update" on payment_requests for update
  using (is_admin());

-- ---------- subscription_payments (الاشتراك الشهري) ----------
drop policy if exists "sub_student_insert" on subscription_payments;
create policy "sub_student_insert" on subscription_payments for insert
  with check (student_id = auth.uid());
drop policy if exists "sub_read" on subscription_payments;
create policy "sub_read" on subscription_payments for select
  using (student_id = auth.uid() or is_admin() or teacher_id = auth.uid());
drop policy if exists "sub_review_update" on subscription_payments;
create policy "sub_review_update" on subscription_payments for update
  using (is_admin() or teacher_id = auth.uid());

-- ---------- materials (شيتات / سبورة / مذكرات) ----------
drop policy if exists "materials_teacher_write" on materials;
create policy "materials_teacher_write" on materials for all
  using (teacher_id = auth.uid() or is_admin())
  with check (teacher_id = auth.uid());

drop policy if exists "materials_student_read" on materials;
create policy "materials_student_read" on materials for select
  using (
    teacher_id = auth.uid() or is_admin()
    or exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role = 'student'
        and p.teacher_id = materials.teacher_id
        and p.stage = materials.stage
        and has_active_subscription(auth.uid(), materials.teacher_id)
    )
  );

-- ---------- quizzes ----------
drop policy if exists "quizzes_teacher_write" on quizzes;
create policy "quizzes_teacher_write" on quizzes for all
  using (teacher_id = auth.uid() or is_admin())
  with check (teacher_id = auth.uid());

drop policy if exists "quizzes_student_read" on quizzes;
create policy "quizzes_student_read" on quizzes for select
  using (
    teacher_id = auth.uid() or is_admin()
    or (is_published = true and exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role = 'student'
        and p.teacher_id = quizzes.teacher_id
        and p.stage = quizzes.stage
        and has_active_subscription(auth.uid(), quizzes.teacher_id)
    ))
  );

-- ---------- quiz_questions ----------
drop policy if exists "quiz_questions_teacher_write" on quiz_questions;
create policy "quiz_questions_teacher_write" on quiz_questions for all
  using (exists (select 1 from quizzes q where q.id = quiz_id and q.teacher_id = auth.uid()))
  with check (exists (select 1 from quizzes q where q.id = quiz_id and q.teacher_id = auth.uid()));

drop policy if exists "quiz_questions_student_read" on quiz_questions;
create policy "quiz_questions_student_read" on quiz_questions for select
  using (
    exists (
      select 1 from quizzes q
      where q.id = quiz_id
        and (
          q.teacher_id = auth.uid() or is_admin()
          or (q.is_published = true and exists (
            select 1 from profiles p
            where p.id = auth.uid() and p.role = 'student'
              and p.teacher_id = q.teacher_id and p.stage = q.stage
              and has_active_subscription(auth.uid(), q.teacher_id)
          ))
        )
    )
  );

-- ---------- quiz_attempts ----------
drop policy if exists "quiz_attempts_student_insert" on quiz_attempts;
create policy "quiz_attempts_student_insert" on quiz_attempts for insert
  with check (student_id = auth.uid());
drop policy if exists "quiz_attempts_read" on quiz_attempts;
create policy "quiz_attempts_read" on quiz_attempts for select
  using (student_id = auth.uid() or is_admin()
         or exists (select 1 from quizzes q where q.id = quiz_id and q.teacher_id = auth.uid()));

-- ============================================================================
-- 8) فهارس لتحسين الأداء
-- ============================================================================
create index if not exists idx_courses_teacher on courses(teacher_id);
create index if not exists idx_courses_published on courses(is_published);
create index if not exists idx_enrollments_student on enrollments(student_id);
create index if not exists idx_payreq_student on payment_requests(student_id);
create index if not exists idx_payreq_status on payment_requests(status);
create index if not exists idx_sub_student_teacher_month on subscription_payments(student_id, teacher_id, month);
create index if not exists idx_materials_teacher_stage on materials(teacher_id, stage);
create index if not exists idx_quizzes_teacher_stage on quizzes(teacher_id, stage);
create index if not exists idx_profiles_teacher on profiles(teacher_id);
create index if not exists idx_profiles_email on profiles(email);

-- ============================================================================
-- 9) Storage buckets مطلوبة (نفّذها مرة واحدة، أو أنشئها يدويًا من لوحة Storage):
--    - "files": صور غلاف الكورسات + صور بروفايل المدرس (عام/قابل للقراءة)
--    - "materials": ملفات الشيتات/المذكرات + صور السبورة (خاص، يُقرأ عبر رابط موقّع
--      أو تُجعل عامة إذا كانت المواد نفسها محمية بمنطق العرض في الواجهة فقط —
--      يُفضّل جعلها عامة القراءة لأن الحظر الحقيقي هنا هو RLS على جدول materials
--      الذي يتحكم فى ظهور الرابط أصلًا، وليس في الوصول المباشر للملف بعد معرفته)
-- ============================================================================
