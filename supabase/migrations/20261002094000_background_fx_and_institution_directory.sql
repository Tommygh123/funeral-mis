BEGIN;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.legacycloud_fx_state (
  id integer PRIMARY KEY CHECK (id=1),
  request_id bigint,
  request_started_at timestamptz,
  last_checked_at timestamptz,
  next_check_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  refreshed_at timestamptz,
  rate numeric,
  last_error text
);
ALTER TABLE public.legacycloud_fx_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.legacycloud_fx_state FROM PUBLIC, anon, authenticated;
INSERT INTO public.legacycloud_fx_state(id) VALUES(1) ON CONFLICT(id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.legacycloud_fx_tick()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 st public.legacycloud_fx_state%ROWTYPE;
 response record;
 payload jsonb;
 new_rate numeric;
 published timestamptz;
 request bigint;
BEGIN
 IF NOT pg_catalog.pg_try_advisory_xact_lock(74111001) THEN
   RETURN jsonb_build_object('state','busy');
 END IF;
 SELECT * INTO st FROM public.legacycloud_fx_state WHERE id=1 FOR UPDATE;
 IF st.request_id IS NOT NULL THEN
   SELECT * INTO response FROM net._http_response WHERE id=st.request_id;
   IF NOT FOUND THEN
     IF st.request_started_at > now()-interval '5 minutes' THEN
       RETURN jsonb_build_object('state','waiting');
     END IF;
     UPDATE public.legacycloud_fx_state SET request_id=NULL,
       next_check_at=now()+interval '15 minutes',last_error='Currency request timed out; last saved rate retained.' WHERE id=1;
     RETURN jsonb_build_object('state','retry_scheduled');
   END IF;
   BEGIN
     IF response.status_code IS DISTINCT FROM 200 OR coalesce(response.timed_out,false) OR response.error_msg IS NOT NULL THEN
       RAISE EXCEPTION 'Currency provider request failed (HTTP %).',response.status_code;
     END IF;
     payload:=response.content::jsonb;
     new_rate:=(payload->'rates'->>'GHS')::numeric;
     published:=to_timestamp((payload->>'time_last_update_unix')::double precision);
     IF payload->>'result' IS DISTINCT FROM 'success' OR payload->>'base_code' IS DISTINCT FROM 'USD'
        OR new_rate IS NULL OR new_rate<=0 OR new_rate::text IN ('NaN','Infinity','-Infinity')
        OR published IS NULL OR published<now()-interval '3 days' OR published>now()+interval '1 hour' THEN
       RAISE EXCEPTION 'Currency provider returned an invalid or outdated USD/GHS rate.';
     END IF;
     INSERT INTO public.system_global_configs(config_key,config_value)
       VALUES('usd_to_ghs_rate',new_rate::text)
       ON CONFLICT(config_key) DO UPDATE SET config_value=excluded.config_value;
     UPDATE public.legacycloud_fx_state SET request_id=NULL,rate=new_rate,published_at=published,
       refreshed_at=now(),next_check_at=now()+interval '1 hour',last_error=NULL WHERE id=1;
     RETURN jsonb_build_object('state','updated','rate',new_rate);
   EXCEPTION WHEN OTHERS THEN
     UPDATE public.legacycloud_fx_state SET request_id=NULL,next_check_at=now()+interval '15 minutes',last_error=SQLERRM WHERE id=1;
     RETURN jsonb_build_object('state','retry_scheduled');
   END;
 END IF;
 IF st.next_check_at>now() THEN RETURN jsonb_build_object('state','up_to_date'); END IF;
 BEGIN
   SELECT net.http_get(url:='https://open.er-api.com/v6/latest/USD',timeout_milliseconds:=10000) INTO request;
   UPDATE public.legacycloud_fx_state SET request_id=request,request_started_at=now(),last_checked_at=now() WHERE id=1;
   RETURN jsonb_build_object('state','requested');
 EXCEPTION WHEN OTHERS THEN
   UPDATE public.legacycloud_fx_state SET next_check_at=now()+interval '15 minutes',last_error=SQLERRM WHERE id=1;
   RETURN jsonb_build_object('state','retry_scheduled');
 END;
END $$;
REVOKE ALL ON FUNCTION public.legacycloud_fx_tick() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.legacycloud_require_superadmin()
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT (
   coalesce(auth.jwt()->>'email','')='admin@legacycloud.com'
   OR EXISTS(SELECT 1 FROM public.users u WHERE u.id=auth.uid()
     AND lower(coalesce(to_jsonb(u)->>'role','')) IN ('superadmin','super_admin'))
 ) THEN RAISE EXCEPTION 'SuperAdmin access required' USING ERRCODE='42501'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.legacycloud_require_superadmin() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.legacycloud_fx_status()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 PERFORM public.legacycloud_require_superadmin();
 SELECT jsonb_build_object('rate',coalesce(s.rate,(SELECT c.config_value::numeric FROM public.system_global_configs c WHERE c.config_key='usd_to_ghs_rate')),
   'published_at',s.published_at,'refreshed_at',s.refreshed_at,'last_checked_at',s.last_checked_at,
   'next_check_at',s.next_check_at,'last_error',s.last_error,'pending',s.request_id IS NOT NULL,
   'scheduled',EXISTS(SELECT 1 FROM cron.job j WHERE j.jobname='legacycloud-usd-ghs-auto-refresh' AND j.active))
 INTO result FROM public.legacycloud_fx_state s WHERE s.id=1;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.legacycloud_fx_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.legacycloud_fx_status() TO authenticated;

CREATE OR REPLACE FUNCTION public.legacycloud_superadmin_directory()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE directory jsonb; history jsonb; funeral_count bigint;
BEGIN
 PERFORM public.legacycloud_require_superadmin();
 SELECT coalesce(jsonb_agg(jsonb_build_object(
   'institution_id',i.id,'institution_name',i.name,
   'plan_name',coalesce(latest.item->>'plan_name',to_jsonb(i)->>'subscription_plan','No subscription'),
   'status',coalesce(latest.item->>'status',to_jsonb(i)->>'subscription_status','No subscription'),
   'amount',latest.item->'amount','currency',latest.item->>'currency',
   'expires_at',latest.item->>'expires_at','subscription_count',
      (SELECT count(*) FROM public.subscriptions s WHERE s.institution_id=i.id)
 ) ORDER BY lower(i.name)),'[]'::jsonb) INTO directory
 FROM public.institutions i
 LEFT JOIN LATERAL (
   SELECT to_jsonb(s) item FROM public.subscriptions s WHERE s.institution_id=i.id
   ORDER BY to_jsonb(s)->>'created_at' DESC NULLS LAST,s.id DESC LIMIT 1
 ) latest ON true;
 SELECT coalesce(jsonb_agg(to_jsonb(s)||jsonb_build_object('institution_name',coalesce(i.name,'Institution unavailable'))
   ORDER BY to_jsonb(s)->>'created_at' DESC NULLS LAST),'[]'::jsonb) INTO history
 FROM public.subscriptions s LEFT JOIN public.institutions i ON i.id=s.institution_id;
 SELECT count(*) INTO funeral_count FROM public.funerals f WHERE f.status='active';
 RETURN jsonb_build_object('institutions',directory,'subscriptions',history,'active_funeral_count',funeral_count);
END $$;
REVOKE ALL ON FUNCTION public.legacycloud_superadmin_directory() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.legacycloud_superadmin_directory() TO authenticated;

-- The tick consumes the asynchronous response on the following minute.
-- It makes an external request only when the hourly check is due.
SELECT cron.schedule('legacycloud-usd-ghs-auto-refresh','* * * * *','SELECT public.legacycloud_fx_tick();');
SELECT public.legacycloud_fx_tick();
COMMIT;
NOTIFY pgrst,'reload schema';
