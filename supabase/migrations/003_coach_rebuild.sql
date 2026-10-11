-- Additive migration: existing practice sessions and SpendWise are unchanged.
BEGIN;
CREATE TABLE IF NOT EXISTS public.coach_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  native_language text NOT NULL CHECK (native_language IN ('English','Tamil','Hindi','Telugu','Malayalam','Kannada','Bengali')),
  level text NOT NULL CHECK (level IN ('Getting started','Building confidence','Comfortable speaking')),
  goal text NOT NULL CHECK (goal IN ('Everyday conversations','Career & interviews','Workplace communication','Travel & connection')),
  daily_minutes integer NOT NULL CHECK (daily_minutes IN (5,10,15))
);
CREATE TABLE IF NOT EXISTS public.coach_sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scenario_id text NOT NULL CHECK (scenario_id IN ('daily','introductions','interview','meeting','travel','incident')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed')),
  profile jsonb NOT NULL,
  transcript jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(transcript) = 'array' AND jsonb_array_length(transcript) <= 81),
  revision integer NOT NULL DEFAULT 0 CHECK (revision BETWEEN 0 AND 40),
  report jsonb,
  duration_seconds integer NOT NULL DEFAULT 0 CHECK (duration_seconds BETWEEN 0 AND 3600),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS coach_sessions_user_created ON public.coach_sessions(user_id, created_at DESC);
ALTER TABLE public.coach_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS coach_profile_own ON public.coach_profiles;
CREATE POLICY coach_profile_own ON public.coach_profiles FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS coach_session_own ON public.coach_sessions;
CREATE POLICY coach_session_own ON public.coach_sessions FOR SELECT TO authenticated USING (user_id = auth.uid());
REVOKE ALL ON public.coach_profiles, public.coach_sessions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coach_profiles TO authenticated;
GRANT SELECT ON public.coach_sessions TO authenticated;

CREATE OR REPLACE FUNCTION public.coach_start_session(p_id uuid, p_scenario text, p_profile jsonb, p_opening text)
RETURNS public.coach_sessions LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE s public.coach_sessions;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501'; END IF;
  IF p_opening IS NULL OR length(p_opening) NOT BETWEEN 1 AND 1000 OR p_profile IS NULL OR octet_length(p_profile::text) > 4000 THEN RAISE EXCEPTION 'INVALID_SESSION'; END IF;
  INSERT INTO public.coach_sessions(id,user_id,scenario_id,profile,transcript)
  VALUES (p_id, auth.uid(), p_scenario, p_profile, jsonb_build_array(jsonb_build_object('role','assistant','content',p_opening))) ON CONFLICT (id) DO NOTHING;
  SELECT * INTO s FROM public.coach_sessions WHERE id=p_id AND user_id=auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'SESSION_NOT_FOUND'; END IF;
  RETURN s;
END; $$;
CREATE OR REPLACE FUNCTION public.coach_append_turn(p_id uuid, p_revision integer, p_turn_id uuid, p_text text, p_reply text, p_correction jsonb, p_duration integer)
RETURNS public.coach_sessions LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE s public.coach_sessions;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501'; END IF;
  SELECT * INTO s FROM public.coach_sessions WHERE id=p_id AND user_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SESSION_NOT_FOUND'; END IF;
  IF p_turn_id IS NULL THEN RAISE EXCEPTION 'INVALID_TURN'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(s.transcript) t WHERE t->>'turn_id'=p_turn_id::text) THEN RETURN s; END IF;
  IF s.status <> 'active' THEN RAISE EXCEPTION 'SESSION_COMPLETE'; END IF;
  IF p_revision IS DISTINCT FROM s.revision THEN RAISE EXCEPTION 'SESSION_CONFLICT'; END IF;
  IF p_duration IS NULL OR p_duration NOT BETWEEN 0 AND 3600 OR s.revision >= 40 OR p_text IS NULL OR length(trim(p_text)) NOT BETWEEN 1 AND 2000 OR p_reply IS NULL OR length(trim(p_reply)) NOT BETWEEN 1 AND 2000 OR octet_length(coalesce(p_correction::text,'')) > 6000 THEN RAISE EXCEPTION 'INVALID_TURN'; END IF;
  UPDATE public.coach_sessions SET transcript = transcript || jsonb_build_array(
    jsonb_build_object('role','user','content',p_text,'turn_id',p_turn_id,'correction',p_correction),
    jsonb_build_object('role','assistant','content',p_reply,'turn_id',p_turn_id)), revision=revision+1, duration_seconds=greatest(duration_seconds,p_duration)
  WHERE id=p_id RETURNING * INTO s;
  RETURN s;
END; $$;
CREATE OR REPLACE FUNCTION public.coach_complete_session(p_id uuid, p_revision integer, p_report jsonb, p_duration integer)
RETURNS public.coach_sessions LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE s public.coach_sessions;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501'; END IF;
  SELECT * INTO s FROM public.coach_sessions WHERE id=p_id AND user_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SESSION_NOT_FOUND'; END IF;
  IF s.status='completed' THEN RETURN s; END IF;
  IF p_revision IS DISTINCT FROM s.revision THEN RAISE EXCEPTION 'SESSION_CONFLICT'; END IF;
  IF s.revision < 2 OR p_report IS NULL OR jsonb_typeof(p_report) <> 'object' OR octet_length(p_report::text) > 20000 OR p_duration IS NULL OR p_duration NOT BETWEEN 0 AND 3600 THEN RAISE EXCEPTION 'INVALID_REPORT'; END IF;
  UPDATE public.coach_sessions SET status='completed',report=p_report,duration_seconds=greatest(duration_seconds,p_duration),completed_at=now() WHERE id=p_id RETURNING * INTO s;
  RETURN s;
END; $$;
REVOKE ALL ON FUNCTION public.coach_start_session(uuid,text,jsonb,text), public.coach_append_turn(uuid,integer,uuid,text,text,jsonb,integer), public.coach_complete_session(uuid,integer,jsonb,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_start_session(uuid,text,jsonb,text), public.coach_append_turn(uuid,integer,uuid,text,text,jsonb,integer), public.coach_complete_session(uuid,integer,jsonb,integer) TO authenticated;
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
    'coach_profile', (SELECT row_to_json(cp) FROM public.coach_profiles cp WHERE cp.user_id = target_user_id),
    'coach_sessions', (SELECT json_agg(row_to_json(cs)) FROM public.coach_sessions cs WHERE cs.user_id = target_user_id),
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
  DELETE FROM public.coach_sessions WHERE user_id = target_user_id;
  DELETE FROM public.coach_profiles WHERE user_id = target_user_id;
  DELETE FROM public.user_vocabulary WHERE user_id = target_user_id;
  DELETE FROM public.practice_sessions WHERE user_id = target_user_id;
  DELETE FROM public.user_progress WHERE user_id = target_user_id;
  DELETE FROM public.streaks WHERE user_id = target_user_id;
  DELETE FROM public.achievements WHERE user_id = target_user_id;
  DELETE FROM public.profiles WHERE id = target_user_id;
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';


REVOKE ALL ON FUNCTION public.export_user_data(uuid), public.delete_user_data(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.export_user_data(uuid), public.delete_user_data(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
