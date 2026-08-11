-- Phase 1 foundation for the new course and payments flow.
-- Run in Supabase SQL Editor before enabling the new pages in production.
-- This uses Supabase Auth; do not connect it to the legacy `users.password` flow.

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

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references public.profiles(id),
  title text not null,
  slug text unique,
  subject text,
  stage text,
  description text,
  cover_image_url text,
  price numeric(10,2) not null default 0 check (price >= 0),
  lesson_count integer not null default 0 check (lesson_count >= 0),
  is_published boolean not null default false,
  created_at timestamptz not null default now()
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
  payment_request_id uuid unique references public.payment_requests(id),
  enrolled_at timestamptz not null default now(),
  unique (student_id, course_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists payment_requests_student_idx on public.payment_requests(student_id, created_at desc);
create index if not exists payment_requests_status_idx on public.payment_requests(status, created_at desc);
create index if not exists enrollments_student_idx on public.enrollments(student_id);

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.payment_requests enable row level security;
alter table public.enrollments enable row level security;
alter table public.notifications enable row level security;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create policy "published courses are readable" on public.courses for select using (is_published or teacher_id = auth.uid() or public.is_admin());
create policy "teachers manage own courses" on public.courses for all using (teacher_id = auth.uid() or public.is_admin()) with check (teacher_id = auth.uid() or public.is_admin());
create policy "students read own profile" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "students update own profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "students create their requests" on public.payment_requests for insert with check (student_id = auth.uid() and status = 'pending');
create policy "students read own requests" on public.payment_requests for select using (student_id = auth.uid() or public.is_admin());
create policy "admins review payment requests" on public.payment_requests for update using (public.is_admin()) with check (public.is_admin());
create policy "students read own enrollments" on public.enrollments for select using (student_id = auth.uid() or public.is_admin());
create policy "admins create enrollments" on public.enrollments for insert with check (public.is_admin());
create policy "students read own notifications" on public.notifications for select using (user_id = auth.uid());
create policy "students mark own notifications read" on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Approve payment requests only from an admin server action / Edge Function.
-- The function creates enrollment + notification atomically; students can never call it directly.
create or replace function public.approve_payment_request(request_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare req public.payment_requests;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  select * into req from public.payment_requests where id = request_id for update;
  if req.id is null or req.status <> 'pending' then raise exception 'invalid payment request'; end if;
  update public.payment_requests set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now() where id = request_id;
  insert into public.enrollments(student_id, course_id, payment_request_id) values(req.student_id, req.course_id, req.id) on conflict (student_id, course_id) do nothing;
  insert into public.notifications(user_id, title, body) values(req.student_id, 'تم تفعيل اشتراكك', 'تمت مراجعة الدفع وتفعيل الكورس في حسابك.');
end;
$$;
