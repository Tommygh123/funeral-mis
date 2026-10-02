-- Run in SQL Editor after installation. First query should return zero rows.
SELECT n.nspname AS schema_name,c.relname AS unprotected_table
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind IN ('r','p') AND NOT c.relrowsecurity;

SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check
FROM pg_policies WHERE schemaname='public' ORDER BY tablename,policyname;

SELECT p.proname,pg_get_function_identity_arguments(p.oid) AS arguments,
 p.prosecdef AS security_definer,has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.prosecdef ORDER BY p.proname;

SELECT relname,reloptions FROM pg_class
WHERE oid IN ('public.valid_transactions'::regclass,'public.global_financial_stats'::regclass);
