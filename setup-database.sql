-- ============================================================
-- 🎓 Al-Ma'moun LMS - Database Setup
-- ============================================================
-- شغل الملف ده مرة واحدة في Supabase > SQL Editor
-- لإنشاء الجداول الناقصة + ضبط RLS
-- ============================================================

-- 1) جدول سجل الدخول
CREATE TABLE IF NOT EXISTS public.login_logs (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID,
  user_name   TEXT,
  user_email  TEXT,
  user_role   TEXT,
  login_time  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_logs_time
  ON public.login_logs (login_time DESC);

CREATE INDEX IF NOT EXISTS idx_login_logs_role
  ON public.login_logs (user_role);


-- 2) جدول قوائم التشغيل
CREATE TABLE IF NOT EXISTS public.playlists (
  id            BIGSERIAL PRIMARY KEY,
  teacher_id    UUID,
  teacher_name  TEXT,
  name          TEXT NOT NULL,
  price         NUMERIC DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_playlists_teacher
  ON public.playlists (teacher_id);


-- 3) جدول فيديوهات قوائم التشغيل
CREATE TABLE IF NOT EXISTS public.playlist_videos (
  id            BIGSERIAL PRIMARY KEY,
  playlist_id   BIGINT REFERENCES public.playlists(id) ON DELETE CASCADE,
  title         TEXT,
  url           TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pvideos_playlist
  ON public.playlist_videos (playlist_id);


-- ============================================================
-- ⚠️ مهم: السماح بالقراءة والكتابة من المتصفح مباشرة
-- (المنصة بتستخدم publishable key من غير auth)
-- ============================================================

-- تفعيل RLS
ALTER TABLE public.login_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlists        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlist_videos  ENABLE ROW LEVEL SECURITY;

-- مسح السياسات القديمة لو موجودة
DROP POLICY IF EXISTS "anon_all_login_logs"      ON public.login_logs;
DROP POLICY IF EXISTS "anon_all_playlists"       ON public.playlists;
DROP POLICY IF EXISTS "anon_all_playlist_videos" ON public.playlist_videos;

-- السماح للجميع بكل العمليات (مناسب للنظام الحالي اللي بيشتغل من غير auth)
CREATE POLICY "anon_all_login_logs"
  ON public.login_logs FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "anon_all_playlists"
  ON public.playlists FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "anon_all_playlist_videos"
  ON public.playlist_videos FOR ALL TO anon, authenticated
  USING (true) WITH CHECK (true);

-- ============================================================
-- ✅ خلاص! دلوقتي:
--   1. سجل الدخول هيشتغل في صفحة الأدمن
--   2. قوائم التشغيل هتشتغل من صفحة المدرس
--   3. الكروت هتظهر في الصفحة الرئيسية
-- ============================================================
