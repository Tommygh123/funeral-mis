BEGIN;
CREATE OR REPLACE FUNCTION public.legacycloud_require_superadmin()
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (
   SELECT 1 FROM public.users u JOIN public.roles r ON r.id=u.role_id
   WHERE u.id=auth.uid()
     AND upper(btrim(r.name))='SUPERADMIN'
 ) THEN
   RAISE EXCEPTION 'SuperAdmin access required' USING ERRCODE='42501';
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.legacycloud_require_superadmin() FROM PUBLIC,anon,authenticated;
COMMIT;
NOTIFY pgrst,'reload schema';
