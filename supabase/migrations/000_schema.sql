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
