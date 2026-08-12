-- LMS v2 — NEW DATABASE SCHEMA
-- Run this file in Supabase SQL Editor on a NEW project, or after running reset-legacy.sql.
-- Auth users are created through the website / Supabase Auth, never with plaintext SQL passwords.

create extension if not exists pgcrypto;

do $$ begin create type public.app_role as enum ('admin','teacher','student'); exception when duplicate_object then null; end $$;
do $$ begin create type public.payment_method as enum ('cash_center','wallet','bank_transfer','online'); exception when duplicate_object then null; end $$;
do $$ begin create type public.payment_status as enum ('pending','approved','rejected'); exception when duplicate_object then null; end $$;
do $$ begin create type public.content_kind as enum ('video','worksheet','board','note','pdf'); exception when duplicate_object then null; end $$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.app_role not null default 'student',
  stage text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete restrict,
  title text not null check (char_length(trim(title)) >= 3),
  slug text unique,
  subject text not null,
  target_stages text[] not null default '{}',
  description text,
  price numeric(10,2) not null default 0 check (price >= 0),
  is_published boolean not null default false,
  requires_monthly_subscription boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.course_modules (
  id uuid primary key default gen_random_uuid(), course_id uuid not null references public.courses(id) on delete cascade,
  title text not null, position integer not null default 0, unique(course_id, position)
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(), module_id uuid not null references public.course_modules(id) on delete cascade,
  title text not null, description text, position integer not null default 0,
  video_url text, is_preview boolean not null default false, unique(module_id, position)
);

create table public.content_items (
  id uuid primary key default gen_random_uuid(), teacher_id uuid not null references public.profiles(id) on delete cascade,
  title text not null, kind public.content_kind not null, stage text not null,
  file_url text not null, is_published boolean not null default true, created_at timestamptz not null default now()
);

create table public.course_payment_requests (
  id uuid primary key default gen_random_uuid(), student_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete restrict, amount numeric(10,2) not null check(amount >= 0),
  method public.payment_method not null, reference_number text, proof_url text, notes text,
  status public.payment_status not null default 'pending', reviewed_by uuid references public.profiles(id), reviewed_at timestamptz, created_at timestamptz not null default now(),
  unique(student_id, course_id, status)
);

create table public.enrollments (
  id uuid primary key default gen_random_uuid(), student_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade, payment_request_id uuid unique references public.course_payment_requests(id) on delete set null,
  enrolled_at timestamptz not null default now(), unique(student_id, course_id)
);

create table public.monthly_payment_requests (
  id uuid primary key default gen_random_uuid(), student_id uuid not null references public.profiles(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade, amount numeric(10,2) not null check(amount >= 0),
  method public.payment_method not null, reference_number text, proof_url text, notes text,
  status public.payment_status not null default 'pending', reviewed_by uuid references public.profiles(id), reviewed_at timestamptz, created_at timestamptz not null default now(),
  unique(student_id, teacher_id, status)
);

create table public.monthly_subscriptions (
  id uuid primary key default gen_random_uuid(), student_id uuid not null references public.profiles(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade, payment_request_id uuid unique references public.monthly_payment_requests(id) on delete set null,
  starts_at timestamptz not null default now(), ends_at timestamptz not null, unique(student_id, teacher_id)
);

create table public.live_sessions (
  id uuid primary key default gen_random_uuid(), course_id uuid not null references public.courses(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade, title text not null, stage text not null,
  starts_at timestamptz not null, meeting_url text not null, created_at timestamptz not null default now()
);

create table public.quizzes (
  id uuid primary key default gen_random_uuid(), teacher_id uuid not null references public.profiles(id) on delete cascade,
  title text not null, stage text not null, course_id uuid references public.courses(id) on delete set null,
  is_published boolean not null default false, created_at timestamptz not null default now()
);

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(), quiz_id uuid not null references public.quizzes(id) on delete cascade,
  question text not null, options jsonb not null check(jsonb_typeof(options) = 'array'), correct_option integer not null check(correct_option >= 0), position integer not null default 0
);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(), quiz_id uuid not null references public.quizzes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade, answers jsonb not null default '{}'::jsonb,
  score numeric(5,2), submitted_at timestamptz, created_at timestamptz not null default now(), unique(quiz_id, student_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null, body text not null, read_at timestamptz, created_at timestamptz not null default now()
);

create index courses_teacher_idx on public.courses(teacher_id);
create index content_teacher_stage_idx on public.content_items(teacher_id, stage);
create index enrollments_student_idx on public.enrollments(student_id, course_id);
create index monthly_subscription_idx on public.monthly_subscriptions(student_id, teacher_id, ends_at);
create index live_stage_idx on public.live_sessions(stage, starts_at);

-- Helpers. SECURITY DEFINER lets policies safely inspect role/access.
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role='admin' and is_active);
$$;
create or replace function public.is_teacher() returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role='teacher' and is_active);
$$;
create or replace function public.has_course_access(p_course uuid) returns boolean language sql stable security definer set search_path=public as $$
 select public.is_admin() or exists(select 1 from public.courses c where c.id=p_course and c.teacher_id=auth.uid()) or exists(select 1 from public.enrollments e where e.course_id=p_course and e.student_id=auth.uid());
$$;
create or replace function public.has_monthly_access(p_teacher uuid) returns boolean language sql stable security definer set search_path=public as $$
 select public.is_admin() or p_teacher=auth.uid() or exists(select 1 from public.monthly_subscriptions s where s.teacher_id=p_teacher and s.student_id=auth.uid() and s.ends_at > now());
$$;

-- Auth trigger: every self-registered person starts as a student.
create or replace function public.handle_new_auth_user() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into public.profiles(id, full_name, role) values(new.id, coalesce(new.raw_user_meta_data->>'full_name','طالب جديد'), 'student') on conflict(id) do nothing; return new; end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_auth_user();

-- User cannot promote themselves or change their active state.
create or replace function public.protect_profile() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if (new.role is distinct from old.role or new.is_active is distinct from old.is_active) and not public.is_admin() and current_user <> 'postgres' then raise exception 'admin only'; end if;
 return new;
end; $$;
drop trigger if exists protect_profile on public.profiles;
create trigger protect_profile before update on public.profiles for each row execute procedure public.protect_profile();

alter table public.profiles enable row level security; alter table public.courses enable row level security; alter table public.course_modules enable row level security; alter table public.lessons enable row level security; alter table public.content_items enable row level security; alter table public.course_payment_requests enable row level security; alter table public.enrollments enable row level security; alter table public.monthly_payment_requests enable row level security; alter table public.monthly_subscriptions enable row level security; alter table public.live_sessions enable row level security; alter table public.quizzes enable row level security; alter table public.quiz_questions enable row level security; alter table public.quiz_attempts enable row level security; alter table public.notifications enable row level security;

-- remove every policy in public schema and rebuild from the single source below.
do $$ declare r record; begin for r in select schemaname, tablename, policyname from pg_policies where schemaname='public' loop execute format('drop policy if exists %I on public.%I',r.policyname,r.tablename); end loop; end $$;

create policy profiles_read on public.profiles for select using(id=auth.uid() or role='teacher' or public.is_admin());
create policy profiles_update on public.profiles for update using(id=auth.uid() or public.is_admin()) with check(id=auth.uid() or public.is_admin());
create policy courses_read on public.courses for select using(is_published or teacher_id=auth.uid() or public.is_admin());
create policy courses_write on public.courses for all using((public.is_teacher() and teacher_id=auth.uid()) or public.is_admin()) with check((public.is_teacher() and teacher_id=auth.uid()) or public.is_admin());
create policy modules_read on public.course_modules for select using(public.has_course_access(course_id) or exists(select 1 from public.courses c where c.id=course_id and c.is_published));
create policy modules_write on public.course_modules for all using(exists(select 1 from public.courses c where c.id=course_id and ((c.teacher_id=auth.uid() and public.is_teacher()) or public.is_admin()))) with check(exists(select 1 from public.courses c where c.id=course_id and ((c.teacher_id=auth.uid() and public.is_teacher()) or public.is_admin())));
create policy lessons_read on public.lessons for select using(is_preview or public.has_course_access((select course_id from public.course_modules where id=module_id)));
create policy lessons_write on public.lessons for all using(exists(select 1 from public.course_modules m join public.courses c on c.id=m.course_id where m.id=module_id and ((c.teacher_id=auth.uid() and public.is_teacher()) or public.is_admin()))) with check(exists(select 1 from public.course_modules m join public.courses c on c.id=m.course_id where m.id=module_id and ((c.teacher_id=auth.uid() and public.is_teacher()) or public.is_admin())));
create policy content_read on public.content_items for select using(is_published and public.has_monthly_access(teacher_id));
create policy content_write on public.content_items for all using((teacher_id=auth.uid() and public.is_teacher()) or public.is_admin()) with check((teacher_id=auth.uid() and public.is_teacher()) or public.is_admin());
create policy course_payment_read on public.course_payment_requests for select using(student_id=auth.uid() or public.is_admin() or exists(select 1 from public.courses c where c.id=course_id and c.teacher_id=auth.uid()));
create policy course_payment_create on public.course_payment_requests for insert with check(student_id=auth.uid() and status='pending' and exists(select 1 from public.courses c where c.id=course_id and c.is_published));
create policy enrollment_read on public.enrollments for select using(student_id=auth.uid() or public.is_admin() or exists(select 1 from public.courses c where c.id=course_id and c.teacher_id=auth.uid()));
create policy monthly_payment_read on public.monthly_payment_requests for select using(student_id=auth.uid() or teacher_id=auth.uid() or public.is_admin());
create policy monthly_payment_create on public.monthly_payment_requests for insert with check(student_id=auth.uid() and status='pending');
create policy subscriptions_read on public.monthly_subscriptions for select using(student_id=auth.uid() or teacher_id=auth.uid() or public.is_admin());
create policy live_read on public.live_sessions for select using(public.has_course_access(course_id) and public.has_monthly_access(teacher_id));
create policy live_write on public.live_sessions for all using((teacher_id=auth.uid() and public.is_teacher()) or public.is_admin()) with check((teacher_id=auth.uid() and public.is_teacher()) or public.is_admin());
create policy quiz_read on public.quizzes for select using(is_published and public.has_monthly_access(teacher_id) or teacher_id=auth.uid() or public.is_admin());
create policy quiz_write on public.quizzes for all using((teacher_id=auth.uid() and public.is_teacher()) or public.is_admin()) with check((teacher_id=auth.uid() and public.is_teacher()) or public.is_admin());
create policy question_read on public.quiz_questions for select using(exists(select 1 from public.quizzes q where q.id=quiz_id and (q.teacher_id=auth.uid() or public.is_admin() or (q.is_published and public.has_monthly_access(q.teacher_id)))));
create policy question_write on public.quiz_questions for all using(exists(select 1 from public.quizzes q where q.id=quiz_id and ((q.teacher_id=auth.uid() and public.is_teacher()) or public.is_admin()))) with check(exists(select 1 from public.quizzes q where q.id=quiz_id and ((q.teacher_id=auth.uid() and public.is_teacher()) or public.is_admin())));
create policy attempts_read on public.quiz_attempts for select using(student_id=auth.uid() or public.is_admin() or exists(select 1 from public.quizzes q where q.id=quiz_id and q.teacher_id=auth.uid()));
create policy attempts_create on public.quiz_attempts for insert with check(student_id=auth.uid());
create policy notifications_read on public.notifications for select using(user_id=auth.uid() or public.is_admin());
create policy notifications_update on public.notifications for update using(user_id=auth.uid()) with check(user_id=auth.uid());

-- Admin-only approval functions. Client cannot forge approval.
create or replace function public.approve_course_payment(p_id uuid) returns void language plpgsql security definer set search_path=public as $$ declare p public.course_payment_requests; begin if not public.is_admin() then raise exception 'not authorized'; end if; select * into p from public.course_payment_requests where id=p_id and status='pending' for update; if p.id is null then raise exception 'invalid request'; end if; update public.course_payment_requests set status='approved',reviewed_by=auth.uid(),reviewed_at=now() where id=p.id; insert into public.enrollments(student_id,course_id,payment_request_id) values(p.student_id,p.course_id,p.id) on conflict(student_id,course_id) do nothing; insert into public.notifications(user_id,title,body) values(p.student_id,'تم تفعيل الكورس','تم قبول دفع الكورس وإضافته إلى حسابك.'); end; $$;
create or replace function public.approve_monthly_payment(p_id uuid, p_days integer default 30) returns void language plpgsql security definer set search_path=public as $$ declare p public.monthly_payment_requests; begin if not public.is_admin() and not public.is_teacher() then raise exception 'not authorized'; end if; select * into p from public.monthly_payment_requests where id=p_id and status='pending' for update; if p.id is null or (not public.is_admin() and p.teacher_id<>auth.uid()) then raise exception 'invalid request'; end if; update public.monthly_payment_requests set status='approved',reviewed_by=auth.uid(),reviewed_at=now() where id=p.id; insert into public.monthly_subscriptions(student_id,teacher_id,payment_request_id,starts_at,ends_at) values(p.student_id,p.teacher_id,p.id,now(),now()+make_interval(days=>p_days)) on conflict(student_id,teacher_id) do update set payment_request_id=excluded.payment_request_id,starts_at=now(),ends_at=excluded.ends_at; insert into public.notifications(user_id,title,body) values(p.student_id,'تم تفعيل الاشتراك الشهري','تم تفعيل اشتراكك الشهري ويمكنك الآن فتح المحتوى والحصص والاختبارات.'); end; $$;
revoke all on function public.approve_course_payment(uuid) from public; revoke all on function public.approve_monthly_payment(uuid,integer) from public; grant execute on function public.approve_course_payment(uuid), public.approve_monthly_payment(uuid,integer) to authenticated;
