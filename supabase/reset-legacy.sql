-- DANGEROUS: Run ONLY after backup if you want a completely clean LMS database.
-- It removes ALL old and new LMS public data. It does NOT delete auth.users.
drop table if exists public.quiz_attempts, public.quiz_questions, public.quizzes, public.live_sessions, public.lesson_progress, public.lessons, public.course_modules, public.monthly_subscriptions, public.monthly_payment_requests, public.enrollments, public.course_payment_requests, public.content_items, public.courses, public.notifications, public.profiles cascade;
drop table if exists public.solutions, public.playlist_videos, public.playlists, public.videos, public.pdfs, public.pdfs2, public.notes, public.teacher_profile, public.social_links, public.teacher_comments, public.login_logs, public.users cascade;
drop function if exists public.approve_course_payment(uuid), public.approve_monthly_payment(uuid,integer), public.has_course_access(uuid), public.has_monthly_access(uuid), public.is_admin(), public.is_teacher(), public.handle_new_auth_user(), public.protect_profile() cascade;
drop type if exists public.content_kind, public.payment_status, public.payment_method, public.app_role cascade;
