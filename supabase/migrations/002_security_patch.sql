BEGIN;
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

COMMIT;
