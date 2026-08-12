-- Al-Ma'moun LMS — secure, repeatable Supabase schema
-- Run this in Supabase SQL Editor. It does not drop application data.
-- Before using it: create one Auth user, then set that profile to admin once
-- from SQL Editor: update public.profiles set role = 'admin' where id = '<AUTH_USER_UUID>';

create extension if not exists pgcrypto;

do $$ begin create type public.app_role as enum ('admin', 'teacher', 'student'); exception when duplicate_object then null; end $$;
do $$ begin create type public.payment_method as enum ('cash', 'wallet', 'bank_transfer', 'online'); exception when duplicate_object then null; end $$;
do $$ begin create type public.payment_status as enum ('pending', 'approved', 'rejected', 'paid'); exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.app_role not null default 'student',
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_teacher()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'teacher');
$$;

-- A user may edit their name, but cannot give themselves a higher role.
create or replace function public.prevent_profile_role_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role
     and not public.is_admin()
     and coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
     and current_user <> 'postgres' then
    raise exception 'role changes require an administrator';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role before update on public.profiles
for each row execute procedure public.prevent_profile_role_change();

-- Creates a profile even when email confirmation delays the first session.
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', 'طالب جديد'), 'student')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_auth_user();

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete restrict,
  title text not null check (char_length(trim(title)) between 3 and 160),
  slug text unique,
  subject text,
  stage text,
  description text,
  cover_image_url text,
  price numeric(10,2) not null default 0 check (price >= 0),
  lesson_count integer not null default 0 check (lesson_count >= 0),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.course_modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  unique (course_id, position)
);

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.course_modules(id) on delete cascade,
  title text not null,
  description text,
  position integer not null default 0 check (position >= 0),
  duration_seconds integer check (duration_seconds >= 0),
  is_preview boolean not null default false,
  created_at timestamptz not null default now(),
  unique (module_id, position)
);

create table if not exists public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete restrict,
  amount numeric(10,2) not null check (amount >= 0),
  method public.payment_method not null,
  status public.payment_status not null default 'pending',
  reference_number text,
  notes text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  payment_request_id uuid unique references public.payment_requests(id) on delete set null,
  enrolled_at timestamptz not null default now(),
  unique (student_id, course_id)
);

create table if not exists public.lesson_progress (
  student_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  watch_progress numeric(5,2) not null default 0 check (watch_progress between 0 and 100),
  last_position_seconds integer not null default 0 check (last_position_seconds >= 0),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (student_id, lesson_id)
);

create table if not exists public.live_sessions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete restrict,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  meeting_url text,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists courses_teacher_idx on public.courses(teacher_id, created_at desc);
create index if not exists modules_course_idx on public.course_modules(course_id, position);
create index if not exists lessons_module_idx on public.lessons(module_id, position);
create index if not exists payments_student_idx on public.payment_requests(student_id, created_at desc);
create index if not exists payments_status_idx on public.payment_requests(status, created_at desc);
create index if not exists enrollments_student_idx on public.enrollments(student_id, course_id);
create index if not exists live_course_idx on public.live_sessions(course_id, starts_at);
create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.course_modules enable row level security;
alter table public.lessons enable row level security;
alter table public.payment_requests enable row level security;
alter table public.enrollments enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.live_sessions enable row level security;
alter table public.notifications enable row level security;

-- Recreate policies safely on every run.
drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_insert on public.profiles;
drop policy if exists profiles_update on public.profiles;
drop policy if exists courses_select on public.courses;
drop policy if exists courses_insert on public.courses;
drop policy if exists courses_update on public.courses;
drop policy if exists courses_delete on public.courses;
drop policy if exists modules_select on public.course_modules;
drop policy if exists modules_manage on public.course_modules;
drop policy if exists lessons_select on public.lessons;
drop policy if exists lessons_manage on public.lessons;
drop policy if exists payments_select on public.payment_requests;
drop policy if exists payments_insert on public.payment_requests;
drop policy if exists enrollments_select on public.enrollments;
drop policy if exists progress_manage on public.lesson_progress;
drop policy if exists live_select on public.live_sessions;
drop policy if exists live_manage on public.live_sessions;
drop policy if exists notifications_select on public.notifications;
drop policy if exists notifications_update on public.notifications;

-- Policy names from the earlier draft; remove them so their wider access
-- rules cannot remain active after this migration.
drop policy if exists "published courses are readable" on public.courses;
drop policy if exists "teachers manage own courses" on public.courses;
drop policy if exists "students read own profile" on public.profiles;
drop policy if exists "students update own profile" on public.profiles;
drop policy if exists "users create own student profile" on public.profiles;
drop policy if exists "students create their requests" on public.payment_requests;
drop policy if exists "students read own requests" on public.payment_requests;
drop policy if exists "admins review payment requests" on public.payment_requests;
drop policy if exists "students read own enrollments" on public.enrollments;
drop policy if exists "admins create enrollments" on public.enrollments;
drop policy if exists "students read own notifications" on public.notifications;
drop policy if exists "students mark own notifications read" on public.notifications;
drop policy if exists "authorized users read modules" on public.course_modules;
drop policy if exists "teachers manage modules" on public.course_modules;
drop policy if exists "authorized users read lessons" on public.lessons;
drop policy if exists "teachers manage lessons" on public.lessons;
drop policy if exists "students manage own progress" on public.lesson_progress;
drop policy if exists "authorized users read live sessions" on public.live_sessions;
drop policy if exists "teachers manage own live sessions" on public.live_sessions;

create policy profiles_select on public.profiles for select
  using (id = auth.uid() or role = 'teacher' or public.is_admin());
create policy profiles_insert on public.profiles for insert
  with check (id = auth.uid() and role = 'student');
create policy profiles_update on public.profiles for update
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

create policy courses_select on public.courses for select
  using (is_published or teacher_id = auth.uid() or public.is_admin());
create policy courses_insert on public.courses for insert
  with check ((public.is_teacher() and teacher_id = auth.uid()) or public.is_admin());
create policy courses_update on public.courses for update
  using ((public.is_teacher() and teacher_id = auth.uid()) or public.is_admin())
  with check ((public.is_teacher() and teacher_id = auth.uid()) or public.is_admin());
create policy courses_delete on public.courses for delete
  using ((public.is_teacher() and teacher_id = auth.uid()) or public.is_admin());

create policy modules_select on public.course_modules for select
  using (exists (select 1 from public.courses c where c.id = course_id and (c.is_published or c.teacher_id = auth.uid() or public.is_admin())));
create policy modules_manage on public.course_modules for all
  using (exists (select 1 from public.courses c where c.id = course_id and ((public.is_teacher() and c.teacher_id = auth.uid()) or public.is_admin())))
  with check (exists (select 1 from public.courses c where c.id = course_id and ((public.is_teacher() and c.teacher_id = auth.uid()) or public.is_admin())));

create policy lessons_select on public.lessons for select
  using (is_preview or exists (select 1 from public.course_modules m join public.courses c on c.id = m.course_id where m.id = module_id and (c.teacher_id = auth.uid() or public.is_admin() or exists (select 1 from public.enrollments e where e.course_id = c.id and e.student_id = auth.uid()))));
create policy lessons_manage on public.lessons for all
  using (exists (select 1 from public.course_modules m join public.courses c on c.id = m.course_id where m.id = module_id and ((public.is_teacher() and c.teacher_id = auth.uid()) or public.is_admin())))
  with check (exists (select 1 from public.course_modules m join public.courses c on c.id = m.course_id where m.id = module_id and ((public.is_teacher() and c.teacher_id = auth.uid()) or public.is_admin())));

create policy payments_select on public.payment_requests for select
  using (student_id = auth.uid() or public.is_admin());
create policy payments_insert on public.payment_requests for insert
  with check (student_id = auth.uid() and status = 'pending' and exists (select 1 from public.courses c where c.id = course_id and c.is_published and c.price = amount));
create policy enrollments_select on public.enrollments for select
  using (student_id = auth.uid() or public.is_admin());
create policy progress_manage on public.lesson_progress for all
  using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy live_select on public.live_sessions for select
  using (teacher_id = auth.uid() or public.is_admin() or exists (select 1 from public.enrollments e where e.course_id = live_sessions.course_id and e.student_id = auth.uid()));
create policy live_manage on public.live_sessions for all
  using ((public.is_teacher() and teacher_id = auth.uid()) or public.is_admin())
  with check ((public.is_teacher() and teacher_id = auth.uid()) or public.is_admin());
create policy notifications_select on public.notifications for select
  using (user_id = auth.uid() or public.is_admin());
create policy notifications_update on public.notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Call this only from a signed-in admin session or a verified server action.
-- It atomically approves the request, creates enrollment, and notifies the student.
create or replace function public.approve_payment_request(request_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare req public.payment_requests;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  select * into req from public.payment_requests where id = request_id for update;
  if req.id is null or req.status <> 'pending' then raise exception 'invalid payment request'; end if;
  update public.payment_requests set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now() where id = req.id;
  insert into public.enrollments(student_id, course_id, payment_request_id)
  values (req.student_id, req.course_id, req.id)
  on conflict (student_id, course_id) do nothing;
  insert into public.notifications(user_id, title, body)
  values (req.student_id, 'تم تفعيل اشتراكك', 'تمت مراجعة الدفع وتفعيل الكورس في حسابك.');
end;
$$;

revoke all on function public.approve_payment_request(uuid) from public;
grant execute on function public.approve_payment_request(uuid) to authenticated;
