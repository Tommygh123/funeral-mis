BEGIN;
-- Public visitors can read only the seven published pricing values.
-- Existing table policies and administrator write permissions stay unchanged.
CREATE OR REPLACE FUNCTION public.legacycloud_public_plan_settings()
RETURNS TABLE(config_key text, config_value text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT c.config_key::text, c.config_value::text
  FROM public.system_global_configs c
  WHERE c.config_key IN (
    'price_local_base', 'price_local_stream', 'price_business_volume',
    'price_diaspora_base', 'price_diaspora_5_funeral', 'price_diaspora_stream',
    'usd_to_ghs_rate'
  );
$$;
REVOKE ALL ON FUNCTION public.legacycloud_public_plan_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.legacycloud_public_plan_settings() TO anon, authenticated;
COMMIT;
NOTIFY pgrst, 'reload schema';
