-- For the reviewed legacy schema: public.profiles(id uuid, name text, email text,
-- native_language text, goal text, level text, streak integer, last_active date,
-- created_at timestamp without time zone). Keep a database backup and test on staging.
-- Run this complete file once, not individual fragments. Does not delete user records.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='id' AND data_type='uuid')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='name' AND data_type='text') THEN
    RAISE EXCEPTION 'Expected legacy profiles schema not found; stop and review.';
  END IF;
END;
$$;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name text NOT NULL DEFAULT '';
UPDATE public.profiles SET full_name = COALESCE(name, '') WHERE full_name = '';

-- Included migration: 000_schema.sql
-- For fresh installations. Stage and inspect existing schema compatibility first.
CREATE TABLE IF NOT EXISTS public.profiles (
 id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 email text, full_name text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.lessons (id text PRIMARY KEY, title text NOT NULL);
CREATE TABLE IF NOT EXISTS public.user_progress (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 lesson_id text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.practice_sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 lesson_id text NOT NULL, summary text NOT NULL DEFAULT '' CHECK (length(summary) <= 2000),
 completed boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS practice_sessions_user_created ON public.practice_sessions(user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS public.vocabulary (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), word text NOT NULL);
CREATE TABLE IF NOT EXISTS public.user_vocabulary (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 vocabulary_id uuid REFERENCES public.vocabulary(id)
);
CREATE TABLE IF NOT EXISTS public.streaks (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 current_streak integer NOT NULL DEFAULT 0, longest_streak integer NOT NULL DEFAULT 0, last_active_date date
);
CREATE TABLE IF NOT EXISTS public.achievements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, title text
);
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles, public.user_progress, public.practice_sessions,
 public.user_vocabulary, public.streaks TO authenticated;
GRANT SELECT ON public.lessons, public.vocabulary, public.achievements TO authenticated;

-- Included migration: 001_rls_policies.sql
-- ═══════════════════════════════════════════════════════════════════
-- SpeakSmart AI — FORTRESS RLS Policies
-- Run in: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- ─── ENABLE RLS ON ALL TABLES ───
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.practice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vocabulary ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_vocabulary ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.achievements ENABLE ROW LEVEL SECURITY;

-- ═══ PROFILES ═══
DROP POLICY IF EXISTS "own_profile_select" ON public.profiles;
CREATE POLICY "own_profile_select" ON public.profiles FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "own_profile_update" ON public.profiles;
CREATE POLICY "own_profile_update" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "own_profile_insert" ON public.profiles;
CREATE POLICY "own_profile_insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "own_profile_delete" ON public.profiles;
CREATE POLICY "own_profile_delete" ON public.profiles FOR DELETE USING (auth.uid() = id);

-- ═══ LESSONS (public read) ═══
DROP POLICY IF EXISTS "lessons_read" ON public.lessons;
CREATE POLICY "lessons_read" ON public.lessons FOR SELECT TO authenticated USING (true);

-- ═══ USER PROGRESS ═══
DROP POLICY IF EXISTS "progress_select" ON public.user_progress;
CREATE POLICY "progress_select" ON public.user_progress FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "progress_insert" ON public.user_progress;
CREATE POLICY "progress_insert" ON public.user_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "progress_update" ON public.user_progress;
CREATE POLICY "progress_update" ON public.user_progress FOR UPDATE USING (auth.uid() = user_id);

-- ═══ PRACTICE SESSIONS ═══
DROP POLICY IF EXISTS "sessions_select" ON public.practice_sessions;
CREATE POLICY "sessions_select" ON public.practice_sessions FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "sessions_insert" ON public.practice_sessions;
CREATE POLICY "sessions_insert" ON public.practice_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ═══ VOCABULARY ═══
DROP POLICY IF EXISTS "vocab_read" ON public.vocabulary;
CREATE POLICY "vocab_read" ON public.vocabulary FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "user_vocab_select" ON public.user_vocabulary;
CREATE POLICY "user_vocab_select" ON public.user_vocabulary FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "user_vocab_insert" ON public.user_vocabulary;
CREATE POLICY "user_vocab_insert" ON public.user_vocabulary FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "user_vocab_update" ON public.user_vocabulary;
CREATE POLICY "user_vocab_update" ON public.user_vocabulary FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "user_vocab_delete" ON public.user_vocabulary;
CREATE POLICY "user_vocab_delete" ON public.user_vocabulary FOR DELETE USING (auth.uid() = user_id);

-- ═══ STREAKS ═══
DROP POLICY IF EXISTS "streaks_select" ON public.streaks;
CREATE POLICY "streaks_select" ON public.streaks FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "streaks_update" ON public.streaks;
CREATE POLICY "streaks_update" ON public.streaks FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "streaks_insert" ON public.streaks;
CREATE POLICY "streaks_insert" ON public.streaks FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ═══ ACHIEVEMENTS ═══
DROP POLICY IF EXISTS "achievements_select" ON public.achievements;
CREATE POLICY "achievements_select" ON public.achievements FOR SELECT USING (auth.uid() = user_id);

-- ═══ AUTO-CREATE PROFILE ON SIGNUP ═══
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, created_at)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NOW());
  INSERT INTO public.streaks (user_id, current_streak, longest_streak, last_active_date)
  VALUES (NEW.id, 0, 0, NOW()::date);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ═══ GDPR: DATA EXPORT ═══
CREATE OR REPLACE FUNCTION public.export_user_data(target_user_id uuid)
RETURNS json AS $$
BEGIN
  IF auth.uid() IS NULL OR target_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;
  RETURN json_build_object(
    'profile', (SELECT row_to_json(p) FROM public.profiles p WHERE p.id = target_user_id),
    'progress', (SELECT json_agg(row_to_json(up)) FROM public.user_progress up WHERE up.user_id = target_user_id),
    'sessions', (SELECT json_agg(row_to_json(ps)) FROM public.practice_sessions ps WHERE ps.user_id = target_user_id),
    'vocabulary', (SELECT json_agg(row_to_json(uv)) FROM public.user_vocabulary uv WHERE uv.user_id = target_user_id),
    'streaks', (SELECT row_to_json(s) FROM public.streaks s WHERE s.user_id = target_user_id),
    'exported_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- ═══ GDPR: ACCOUNT DELETION ═══
CREATE OR REPLACE FUNCTION public.delete_user_data(target_user_id uuid)
RETURNS boolean AS $$
BEGIN
  IF auth.uid() IS NULL OR target_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.user_vocabulary WHERE user_id = target_user_id;
  DELETE FROM public.practice_sessions WHERE user_id = target_user_id;
  DELETE FROM public.user_progress WHERE user_id = target_user_id;
  DELETE FROM public.streaks WHERE user_id = target_user_id;
  DELETE FROM public.achievements WHERE user_id = target_user_id;
  DELETE FROM public.profiles WHERE id = target_user_id;
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- ═══ SECURITY: Revoke direct table access from anon role ═══
REVOKE ALL ON public.profiles, public.lessons, public.user_progress, public.practice_sessions, public.vocabulary, public.user_vocabulary, public.streaks, public.achievements FROM anon;


REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.export_user_data(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_user_data(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.export_user_data(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_data(uuid) TO authenticated;

-- Included migration: 002_security_patch.sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, created_at)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NOW());
  INSERT INTO public.streaks (user_id, current_streak, longest_streak, last_active_date)
  VALUES (NEW.id, 0, 0, NOW()::date);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ═══ GDPR: DATA EXPORT ═══
CREATE OR REPLACE FUNCTION public.export_user_data(target_user_id uuid)
RETURNS json AS $$
BEGIN
  IF auth.uid() IS NULL OR target_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;
  RETURN json_build_object(
    'profile', (SELECT row_to_json(p) FROM public.profiles p WHERE p.id = target_user_id),
    'progress', (SELECT json_agg(row_to_json(up)) FROM public.user_progress up WHERE up.user_id = target_user_id),
    'sessions', (SELECT json_agg(row_to_json(ps)) FROM public.practice_sessions ps WHERE ps.user_id = target_user_id),
    'vocabulary', (SELECT json_agg(row_to_json(uv)) FROM public.user_vocabulary uv WHERE uv.user_id = target_user_id),
    'streaks', (SELECT row_to_json(s) FROM public.streaks s WHERE s.user_id = target_user_id),
    'exported_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- ═══ GDPR: ACCOUNT DELETION ═══
CREATE OR REPLACE FUNCTION public.delete_user_data(target_user_id uuid)
RETURNS boolean AS $$
BEGIN
  IF auth.uid() IS NULL OR target_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.user_vocabulary WHERE user_id = target_user_id;
  DELETE FROM public.practice_sessions WHERE user_id = target_user_id;
  DELETE FROM public.user_progress WHERE user_id = target_user_id;
  DELETE FROM public.streaks WHERE user_id = target_user_id;
  DELETE FROM public.achievements WHERE user_id = target_user_id;
  DELETE FROM public.profiles WHERE id = target_user_id;
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';


REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.export_user_data(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_user_data(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.export_user_data(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_data(uuid) TO authenticated;

-- The browser can consume its quota, but cannot read or edit quota counters.
CREATE SCHEMA IF NOT EXISTS speaksmart_private;
REVOKE ALL ON SCHEMA speaksmart_private FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS speaksmart_private.ai_usage (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_day date NOT NULL, day_count integer NOT NULL,
  usage_minute timestamptz NOT NULL, minute_count integer NOT NULL
);
REVOKE ALL ON speaksmart_private.ai_usage FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.consume_ai_quota()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  caller uuid := auth.uid();
  today date := (statement_timestamp() AT TIME ZONE 'UTC')::date;
  minute_bucket timestamptz := date_trunc('minute', statement_timestamp());
  accepted boolean;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501'; END IF;
  INSERT INTO speaksmart_private.ai_usage AS usage (user_id, usage_day, day_count, usage_minute, minute_count)
  VALUES (caller, today, 1, minute_bucket, 1)
  ON CONFLICT (user_id) DO UPDATE SET
    usage_day = today,
    day_count = CASE WHEN usage.usage_day = today THEN usage.day_count + 1 ELSE 1 END,
    usage_minute = minute_bucket,
    minute_count = CASE WHEN usage.usage_minute = minute_bucket THEN usage.minute_count + 1 ELSE 1 END
  WHERE (usage.usage_day <> today OR usage.day_count < 200)
    AND (usage.usage_minute <> minute_bucket OR usage.minute_count < 20)
  RETURNING true INTO accepted;
  IF accepted IS DISTINCT FROM true THEN RAISE EXCEPTION 'AI_QUOTA_EXCEEDED'; END IF;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.consume_ai_quota() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_ai_quota() TO authenticated;


-- Preserve existing profile rows; fill gaps for existing authenticated accounts.
INSERT INTO public.profiles (id, email, full_name, created_at)
SELECT id, email, COALESCE(raw_user_meta_data->>'full_name', ''), now()
FROM auth.users ON CONFLICT (id) DO NOTHING;
INSERT INTO public.streaks (user_id, current_streak, longest_streak, last_active_date)
SELECT id, 0, 0, NULL FROM auth.users ON CONFLICT (user_id) DO NOTHING;
-- PUBLIC grants would otherwise be inherited by every database role.
REVOKE ALL ON public.profiles, public.lessons, public.user_progress,
 public.practice_sessions, public.vocabulary, public.user_vocabulary,
 public.streaks, public.achievements FROM PUBLIC;
COMMIT;
