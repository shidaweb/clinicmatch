-- Read-only preflight. Run against production/staging; never apply migrations from this file.
BEGIN READ ONLY;
SELECT table_name,string_agg(column_name || ':' || udt_name || CASE WHEN is_nullable='NO' THEN '!' ELSE '' END,', ' ORDER BY ordinal_position) AS columns
FROM information_schema.columns WHERE table_schema='public' GROUP BY table_name ORDER BY table_name;
SELECT c.relname AS table_name,con.conname,pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' ORDER BY c.relname,con.conname;
SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check
FROM pg_policies WHERE schemaname IN ('public','storage') ORDER BY schemaname,tablename,policyname;
SELECT p.proname,p.prosecdef,p.proconfig,pg_get_functiondef(p.oid) AS definition
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN ('sync_comment_count','auth_org_id','auth_is_admin','check_mediation_agreement_signed','issue_commission_invoice');
SELECT grantee,table_name,string_agg(privilege_type,',' ORDER BY privilege_type) AS privileges
FROM information_schema.role_table_grants WHERE table_schema='public' AND grantee IN ('anon','authenticated','service_role') GROUP BY grantee,table_name ORDER BY grantee,table_name;
SELECT 'listings' AS source,count(*) FROM public.listings UNION ALL SELECT 'wanted_requests',count(*) FROM public.wanted_requests UNION ALL SELECT 'consultations',count(*) FROM public.consultations;
COMMIT;
