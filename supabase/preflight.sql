-- Read-only inventory. Review on staging before applying migrations to an existing database.
SELECT table_name, column_name, data_type, is_nullable FROM information_schema.columns
WHERE table_schema = 'public' ORDER BY table_name, ordinal_position;
SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check FROM pg_policies WHERE schemaname = 'public';
SELECT routine_name, grantee, privilege_type FROM information_schema.routine_privileges WHERE routine_schema = 'public';
