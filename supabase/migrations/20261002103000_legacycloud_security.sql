-- LegacyCloud 114: reviewed against supplied 2026-10-02 public schema.
BEGIN;
SET LOCAL lock_timeout = '10s';

CREATE OR REPLACE FUNCTION public.legacycloud_security_actor()
RETURNS TABLE(institution_id uuid, role_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT u.institution_id, upper(btrim(r.name)) FROM public.users u
 JOIN public.roles r ON r.id=u.role_id WHERE u.id=auth.uid() AND u.status='active'
$$;
REVOKE ALL ON FUNCTION public.legacycloud_security_actor() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.legacycloud_security_actor() TO authenticated;
CREATE OR REPLACE FUNCTION public.legacycloud_security_scope(target uuid, allowed_roles text[] DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS(SELECT 1 FROM public.legacycloud_security_actor() a WHERE
 a.role_name='SUPERADMIN' OR (a.institution_id=target AND
 (allowed_roles IS NULL OR a.role_name=ANY(allowed_roles))))
$$;
REVOKE ALL ON FUNCTION public.legacycloud_security_scope(uuid,text[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.legacycloud_security_scope(uuid,text[]) TO authenticated;


ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.audit_logs FROM PUBLIC, anon, authenticated;

ALTER TABLE public.funeral_sequences ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.funeral_sequences FROM PUBLIC, anon, authenticated;

ALTER TABLE public.funerals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access" ON public.funerals;

DROP POLICY IF EXISTS "Allow update for status" ON public.funerals;

DROP POLICY IF EXISTS "Institution scoped insert" ON public.funerals;

DROP POLICY IF EXISTS "SuperAdmin_Access_Policy" ON public.funerals;

DROP POLICY IF EXISTS "institution_scoped_access" ON public.funerals;

REVOKE ALL ON TABLE public.funerals FROM PUBLIC, anon, authenticated;

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Institution scoped transactions" ON public.transactions;

DROP POLICY IF EXISTS "authenticated access transactions" ON public.transactions;

REVOKE ALL ON TABLE public.transactions FROM PUBLIC, anon, authenticated;

ALTER TABLE public.institution_receipt_counters ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.institution_receipt_counters FROM PUBLIC, anon, authenticated;

ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow insert for all users" ON public.institutions;

DROP POLICY IF EXISTS "Allow institution insert" ON public.institutions;

DROP POLICY IF EXISTS "Allow read institutions" ON public.institutions;

DROP POLICY IF EXISTS "Institution insert" ON public.institutions;

DROP POLICY IF EXISTS "Institution select" ON public.institutions;

DROP POLICY IF EXISTS "allow insert" ON public.institutions;

DROP POLICY IF EXISTS "allow insert institutions" ON public.institutions;

DROP POLICY IF EXISTS "authenticated access institutions" ON public.institutions;

DROP POLICY IF EXISTS "dev insert institutions" ON public.institutions;

DROP POLICY IF EXISTS "insert institutions" ON public.institutions;

DROP POLICY IF EXISTS "select institutions" ON public.institutions;

REVOKE ALL ON TABLE public.institutions FROM PUBLIC, anon, authenticated;

ALTER TABLE public.legacycloud_fx_state ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.legacycloud_fx_state FROM PUBLIC, anon, authenticated;

ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.notification_settings FROM PUBLIC, anon, authenticated;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.notifications FROM PUBLIC, anon, authenticated;

ALTER TABLE public.offline_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated to read institutions" ON public.offline_payments;

REVOKE ALL ON TABLE public.offline_payments FROM PUBLIC, anon, authenticated;

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.permissions FROM PUBLIC, anon, authenticated;

ALTER TABLE public.platform_token_transactions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.platform_token_transactions FROM PUBLIC, anon, authenticated;

ALTER TABLE public.receipt_sequences ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.receipt_sequences FROM PUBLIC, anon, authenticated;

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.role_permissions FROM PUBLIC, anon, authenticated;

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.roles FROM PUBLIC, anon, authenticated;

ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "SuperAdmin can view all sms logs" ON public.sms_logs;

DROP POLICY IF EXISTS "SuperAdmins can see all global sms logs" ON public.sms_logs;

DROP POLICY IF EXISTS "authenticated access sms_logs" ON public.sms_logs;

REVOKE ALL ON TABLE public.sms_logs FROM PUBLIC, anon, authenticated;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can insert" ON public.subscriptions;

DROP POLICY IF EXISTS "Users can view own institution subscriptions" ON public.subscriptions;

REVOKE ALL ON TABLE public.subscriptions FROM PUBLIC, anon, authenticated;

ALTER TABLE public.system_audit_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.system_audit_logs FROM PUBLIC, anon, authenticated;

ALTER TABLE public.system_global_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to read global configs" ON public.system_global_configs;

DROP POLICY IF EXISTS "Only superadmins can update global configs" ON public.system_global_configs;

REVOKE ALL ON TABLE public.system_global_configs FROM PUBLIC, anon, authenticated;

ALTER TABLE public.user_funeral_access ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.user_funeral_access FROM PUBLIC, anon, authenticated;

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.user_sessions FROM PUBLIC, anon, authenticated;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated insert" ON public.users;

DROP POLICY IF EXISTS "Allow authenticated insert users" ON public.users;

DROP POLICY IF EXISTS "Allow authenticated read users" ON public.users;

DROP POLICY IF EXISTS "Allow authenticated select" ON public.users;

DROP POLICY IF EXISTS "Allow authenticated update" ON public.users;

DROP POLICY IF EXISTS "Allow update own record" ON public.users;

DROP POLICY IF EXISTS "authenticated access users" ON public.users;

DROP POLICY IF EXISTS "dev insert users" ON public.users;

DROP POLICY IF EXISTS "insert users" ON public.users;

DROP POLICY IF EXISTS "select users" ON public.users;

REVOKE ALL ON TABLE public.users FROM PUBLIC, anon, authenticated;

ALTER TABLE public.voided_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to insert" ON public.voided_transactions;

DROP POLICY IF EXISTS "Allow authenticated users to read" ON public.voided_transactions;

REVOKE ALL ON TABLE public.voided_transactions FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.roles TO authenticated;

DROP POLICY IF EXISTS lc_read ON public.roles;

CREATE POLICY lc_read ON public.roles FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS lc_manage ON public.roles;

CREATE POLICY lc_manage ON public.roles FOR ALL TO authenticated USING (public.legacycloud_security_scope(NULL)) WITH CHECK (public.legacycloud_security_scope(NULL));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.permissions TO authenticated;

DROP POLICY IF EXISTS lc_read ON public.permissions;

CREATE POLICY lc_read ON public.permissions FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS lc_manage ON public.permissions;

CREATE POLICY lc_manage ON public.permissions FOR ALL TO authenticated USING (public.legacycloud_security_scope(NULL)) WITH CHECK (public.legacycloud_security_scope(NULL));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_permissions TO authenticated;

DROP POLICY IF EXISTS lc_read ON public.role_permissions;

CREATE POLICY lc_read ON public.role_permissions FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS lc_manage ON public.role_permissions;

CREATE POLICY lc_manage ON public.role_permissions FOR ALL TO authenticated USING (public.legacycloud_security_scope(NULL)) WITH CHECK (public.legacycloud_security_scope(NULL));

GRANT SELECT ON public.institution_receipt_counters TO authenticated;

DROP POLICY IF EXISTS lc_read ON public.institution_receipt_counters;

CREATE POLICY lc_read ON public.institution_receipt_counters FOR SELECT TO authenticated USING (public.legacycloud_security_scope(institution_id));

GRANT SELECT ON public.receipt_sequences TO authenticated;

DROP POLICY IF EXISTS lc_read ON public.receipt_sequences;

CREATE POLICY lc_read ON public.receipt_sequences FOR SELECT TO authenticated USING (public.legacycloud_security_scope(institution_id));

GRANT SELECT ON public.funeral_sequences TO authenticated;

DROP POLICY IF EXISTS lc_read ON public.funeral_sequences;

CREATE POLICY lc_read ON public.funeral_sequences FOR SELECT TO authenticated USING (public.legacycloud_security_scope(institution_id));

GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;

DROP POLICY IF EXISTS lc_read ON public.notifications;

CREATE POLICY lc_read ON public.notifications FOR SELECT TO authenticated USING (public.legacycloud_security_scope(institution_id));

DROP POLICY IF EXISTS lc_insert ON public.notifications;

CREATE POLICY lc_insert ON public.notifications FOR INSERT TO authenticated WITH CHECK (public.legacycloud_security_scope(institution_id,ARRAY['ADMIN','SUPERVISOR','CASHIER']::text[]));

DROP POLICY IF EXISTS lc_update ON public.notifications;

CREATE POLICY lc_update ON public.notifications FOR UPDATE TO authenticated USING (public.legacycloud_security_scope(institution_id,ARRAY['ADMIN','SUPERVISOR','CASHIER']::text[])) WITH CHECK (public.legacycloud_security_scope(institution_id,ARRAY['ADMIN','SUPERVISOR','CASHIER']::text[]));

GRANT SELECT, INSERT, UPDATE ON public.sms_logs TO authenticated;

DROP POLICY IF EXISTS lc_read ON public.sms_logs;

CREATE POLICY lc_read ON public.sms_logs FOR SELECT TO authenticated USING (public.legacycloud_security_scope(institution_id));

DROP POLICY IF EXISTS lc_insert ON public.sms_logs;

CREATE POLICY lc_insert ON public.sms_logs FOR INSERT TO authenticated WITH CHECK (public.legacycloud_security_scope(institution_id,ARRAY['ADMIN','SUPERVISOR','CASHIER']::text[]));

DROP POLICY IF EXISTS lc_update ON public.sms_logs;

CREATE POLICY lc_update ON public.sms_logs FOR UPDATE TO authenticated USING (public.legacycloud_security_scope(institution_id,ARRAY['ADMIN','SUPERVISOR','CASHIER']::text[])) WITH CHECK (public.legacycloud_security_scope(institution_id,ARRAY['ADMIN','SUPERVISOR','CASHIER']::text[]));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_token_transactions TO authenticated;

DROP POLICY IF EXISTS lc_read ON public.platform_token_transactions;

CREATE POLICY lc_read ON public.platform_token_transactions FOR SELECT TO authenticated USING (public.legacycloud_security_scope(institution_id));

DROP POLICY IF EXISTS lc_manage ON public.platform_token_transactions;

CREATE POLICY lc_manage ON public.platform_token_transactions FOR ALL TO authenticated USING (public.legacycloud_security_scope(NULL)) WITH CHECK (public.legacycloud_security_scope(NULL));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.offline_payments TO authenticated;

DROP POLICY IF EXISTS lc_read ON public.offline_payments;

CREATE POLICY lc_read ON public.offline_payments FOR SELECT TO authenticated USING (public.legacycloud_security_scope(institution_id));

DROP POLICY IF EXISTS lc_manage ON public.offline_payments;

CREATE POLICY lc_manage ON public.offline_payments FOR ALL TO authenticated USING (public.legacycloud_security_scope(NULL)) WITH CHECK (public.legacycloud_security_scope(NULL));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;

DROP POLICY IF EXISTS lc_read ON public.subscriptions;

CREATE POLICY lc_read ON public.subscriptions FOR SELECT TO authenticated USING (public.legacycloud_security_scope(institution_id));

DROP POLICY IF EXISTS lc_manage ON public.subscriptions;

CREATE POLICY lc_manage ON public.subscriptions FOR ALL TO authenticated USING (public.legacycloud_security_scope(NULL)) WITH CHECK (public.legacycloud_security_scope(NULL));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_settings TO authenticated;

DROP POLICY IF EXISTS lc_access ON public.notification_settings;

CREATE POLICY lc_access ON public.notification_settings FOR ALL TO authenticated USING (public.legacycloud_security_scope(institution_id,ARRAY['ADMIN']::text[])) WITH CHECK (public.legacycloud_security_scope(institution_id,ARRAY['ADMIN']::text[]));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_logs TO authenticated;

DROP POLICY IF EXISTS lc_access ON public.audit_logs;

CREATE POLICY lc_access ON public.audit_logs FOR ALL TO authenticated USING (public.legacycloud_security_scope(institution_id,ARRAY['ADMIN']::text[])) WITH CHECK (public.legacycloud_security_scope(institution_id,ARRAY['ADMIN']::text[]));

GRANT SELECT, INSERT ON public.system_audit_logs TO authenticated;

DROP POLICY IF EXISTS lc_read ON public.system_audit_logs;

CREATE POLICY lc_read ON public.system_audit_logs FOR SELECT TO authenticated USING (public.legacycloud_security_scope(NULL));

DROP POLICY IF EXISTS lc_insert ON public.system_audit_logs;

CREATE POLICY lc_insert ON public.system_audit_logs FOR INSERT TO authenticated WITH CHECK (public.legacycloud_security_scope(NULL));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_global_configs TO authenticated;

DROP POLICY IF EXISTS lc_read ON public.system_global_configs;

CREATE POLICY lc_read ON public.system_global_configs FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS lc_manage ON public.system_global_configs;

CREATE POLICY lc_manage ON public.system_global_configs FOR ALL TO authenticated USING (public.legacycloud_security_scope(NULL)) WITH CHECK (public.legacycloud_security_scope(NULL));

GRANT SELECT, UPDATE ON public.institutions TO authenticated;

DROP POLICY IF EXISTS lc_read ON public.institutions;

CREATE POLICY lc_read ON public.institutions FOR SELECT TO authenticated USING (public.legacycloud_security_scope(id));

DROP POLICY IF EXISTS lc_update ON public.institutions;

CREATE POLICY lc_update ON public.institutions FOR UPDATE TO authenticated USING (public.legacycloud_security_scope(id,ARRAY['ADMIN']::text[])) WITH CHECK (public.legacycloud_security_scope(id,ARRAY['ADMIN']::text[]));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO authenticated;

DROP POLICY IF EXISTS lc_read ON public.users;

CREATE POLICY lc_read ON public.users FOR SELECT TO authenticated USING (id=auth.uid() OR public.legacycloud_security_scope(institution_id,ARRAY['ADMIN','SUPERVISOR']));

DROP POLICY IF EXISTS lc_manage ON public.users;

CREATE POLICY lc_manage ON public.users FOR ALL TO authenticated USING (public.legacycloud_security_scope(NULL)) WITH CHECK (public.legacycloud_security_scope(NULL));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.funerals TO authenticated;

DROP POLICY IF EXISTS lc_read ON public.funerals;

CREATE POLICY lc_read ON public.funerals FOR SELECT TO authenticated USING (public.legacycloud_security_scope(institution_id) AND (NOT EXISTS(SELECT 1 FROM public.legacycloud_security_actor() a WHERE a.role_name IN ('FUNERALHEAD','FAMILYHEAD')) OR manager_id=auth.uid()));

DROP POLICY IF EXISTS lc_manage ON public.funerals;

CREATE POLICY lc_manage ON public.funerals FOR ALL TO authenticated USING (public.legacycloud_security_scope(institution_id,ARRAY['ADMIN','SUPERVISOR'])) WITH CHECK (public.legacycloud_security_scope(institution_id,ARRAY['ADMIN','SUPERVISOR']));

GRANT SELECT, INSERT ON public.transactions TO authenticated;

DROP POLICY IF EXISTS lc_read ON public.transactions;

CREATE POLICY lc_read ON public.transactions FOR SELECT TO authenticated USING (public.legacycloud_security_scope(institution_id) AND (NOT EXISTS(SELECT 1 FROM public.legacycloud_security_actor() a WHERE a.role_name IN ('FUNERALHEAD','FAMILYHEAD')) OR EXISTS(SELECT 1 FROM public.funerals f WHERE f.id=funeral_id AND f.manager_id=auth.uid())));

DROP POLICY IF EXISTS lc_insert ON public.transactions;

CREATE POLICY lc_insert ON public.transactions FOR INSERT TO authenticated WITH CHECK (public.legacycloud_security_scope(institution_id,ARRAY['ADMIN','SUPERVISOR','CASHIER']::text[]) AND (user_id IS NULL OR user_id=auth.uid()) AND EXISTS(SELECT 1 FROM public.funerals f WHERE f.id=funeral_id AND f.institution_id=transactions.institution_id));

GRANT SELECT, INSERT ON public.voided_transactions TO authenticated;

DROP POLICY IF EXISTS lc_read ON public.voided_transactions;

CREATE POLICY lc_read ON public.voided_transactions FOR SELECT TO authenticated USING (EXISTS(SELECT 1 FROM public.transactions t WHERE t.reference=voided_transactions.reference AND public.legacycloud_security_scope(t.institution_id)));

DROP POLICY IF EXISTS lc_insert ON public.voided_transactions;

CREATE POLICY lc_insert ON public.voided_transactions FOR INSERT TO authenticated WITH CHECK (EXISTS(SELECT 1 FROM public.transactions t WHERE t.reference=voided_transactions.reference AND public.legacycloud_security_scope(t.institution_id,ARRAY['ADMIN','SUPERVISOR','CASHIER'])));

GRANT USAGE ON SEQUENCE public.voided_transactions_id_seq TO authenticated; REVOKE ALL ON SEQUENCE public.voided_transactions_id_seq FROM anon;

GRANT SELECT, INSERT, UPDATE ON public.user_sessions TO authenticated;

DROP POLICY IF EXISTS lc_access ON public.user_sessions;

CREATE POLICY lc_access ON public.user_sessions FOR ALL TO authenticated USING (user_id=auth.uid() OR public.legacycloud_security_scope(NULL)) WITH CHECK (user_id=auth.uid() OR public.legacycloud_security_scope(NULL));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_funeral_access TO authenticated;

DROP POLICY IF EXISTS lc_read ON public.user_funeral_access;

CREATE POLICY lc_read ON public.user_funeral_access FOR SELECT TO authenticated USING (user_id=auth.uid() OR public.legacycloud_security_scope(NULL));

DROP POLICY IF EXISTS lc_manage ON public.user_funeral_access;

CREATE POLICY lc_manage ON public.user_funeral_access FOR ALL TO authenticated USING (EXISTS(SELECT 1 FROM public.funerals f JOIN public.users u ON u.id=user_id AND u.institution_id=f.institution_id WHERE f.id=funeral_id AND public.legacycloud_security_scope(f.institution_id,ARRAY['ADMIN']))) WITH CHECK (EXISTS(SELECT 1 FROM public.funerals f JOIN public.users u ON u.id=user_id AND u.institution_id=f.institution_id WHERE f.id=funeral_id AND public.legacycloud_security_scope(f.institution_id,ARRAY['ADMIN'])));

CREATE OR REPLACE FUNCTION public.legacycloud_public_funeral(p_funeral_id uuid)
RETURNS TABLE(id uuid,institution_id uuid,full_name text,photo_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT f.id,f.institution_id,f.full_name,f.photo_url FROM public.funerals f
 WHERE f.id=p_funeral_id AND f.status='active'
$$;
REVOKE ALL ON FUNCTION public.legacycloud_public_funeral(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.legacycloud_public_funeral(uuid) TO anon,authenticated;
ALTER VIEW public.valid_transactions SET (security_invoker=true);
REVOKE ALL ON public.valid_transactions,public.global_financial_stats FROM PUBLIC,anon;
GRANT SELECT ON public.valid_transactions,public.global_financial_stats TO authenticated;


CREATE OR REPLACE FUNCTION "public"."generate_institution_receipt_id"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER SET search_path=public,pg_temp
    AS $$
DECLARE
  new_seq INTEGER;
BEGIN
  -- This part is the "secret sauce": 
  -- It finds the institution's row, adds 1 to the number, 
  -- or starts at 1 if it's their very first donation ever.
  INSERT INTO institution_receipt_counters (institution_id, last_number)
  VALUES (NEW.institution_id, 1)
  ON CONFLICT (institution_id) 
  DO UPDATE SET last_number = institution_receipt_counters.last_number + 1
  RETURNING last_number INTO new_seq;

  -- Generate the receipt string: e.g., REC-260605-0001
  NEW.reference := 'REC-' || to_char(now(), 'YYMMDD') || '-' || LPAD(new_seq::text, 4, '0');
  
  RETURN NEW;
END;
$$;




CREATE OR REPLACE FUNCTION "public"."generate_receipt_number"("inst_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER SET search_path=public,pg_temp
    AS $$
declare
  inst_prefix text;
  next_num bigint;
BEGIN
 IF NOT public.legacycloud_security_scope(inst_id,ARRAY['ADMIN','SUPERVISOR','CASHIER']) THEN RAISE EXCEPTION 'Institution access required' USING ERRCODE='42501'; END IF;
  -- get or create sequence row
  insert into receipt_sequences (institution_id, prefix, last_number)
  values (inst_id, 'FUN', 0)
  on conflict (institution_id)
  do nothing;

  -- lock row safely
  select prefix, last_number
  into inst_prefix, next_num
  from receipt_sequences
  where institution_id = inst_id
  for update;

  next_num := next_num + 1;

  update receipt_sequences
  set last_number = next_num
  where institution_id = inst_id;

  return inst_prefix || '-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(next_num::text, 6, '0');
end;
$$;




CREATE OR REPLACE FUNCTION "public"."generate_funeral_code"("p_institution_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER SET search_path=public,pg_temp
    AS $$
DECLARE
  v_next integer;
BEGIN
 IF NOT public.legacycloud_security_scope(p_institution_id,ARRAY['ADMIN','SUPERVISOR','CASHIER']) THEN RAISE EXCEPTION 'Institution access required' USING ERRCODE='42501'; END IF;

  INSERT INTO funeral_sequences (
    institution_id,
    last_number
  )
  VALUES (
    p_institution_id,
    0
  )
  ON CONFLICT (institution_id)
  DO NOTHING;

  SELECT last_number
  INTO v_next
  FROM funeral_sequences
  WHERE institution_id = p_institution_id
  FOR UPDATE;

  v_next := v_next + 1;

  UPDATE funeral_sequences
  SET last_number = v_next
  WHERE institution_id = p_institution_id;

  RETURN 'F' || LPAD(v_next::text, 3, '0');

END;
$$;




REVOKE ALL ON FUNCTION public.create_institution_workspace(text,text,text,text,uuid,uuid) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.create_institution_workspace(text,text,text,text,uuid,uuid) TO service_role;

REVOKE ALL ON FUNCTION public.create_institution_workspace(text,text,text,text,text,uuid,uuid) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.create_institution_workspace(text,text,text,text,text,uuid,uuid) TO service_role;

REVOKE ALL ON FUNCTION public.deduct_diaspora_token(uuid,integer) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.deduct_diaspora_token(uuid,integer) TO service_role;

REVOKE ALL ON FUNCTION public.funeralmis_register_email_institution(uuid,text,text,text,text,text,text) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.funeralmis_register_email_institution(uuid,text,text,text,text,text,text) TO service_role;

REVOKE ALL ON FUNCTION public.generate_funeral_code(uuid) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.generate_funeral_code(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.generate_institution_receipt_id() FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.generate_receipt_number(uuid) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.generate_receipt_number(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.get_institution_token_balance(uuid) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.get_institution_token_balance(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.legacycloud_funeralhead_contributions() FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.legacycloud_funeralhead_contributions() TO authenticated;

REVOKE ALL ON FUNCTION public.legacycloud_fx_status() FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.legacycloud_fx_status() TO authenticated;

REVOKE ALL ON FUNCTION public.legacycloud_superadmin_directory() FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.legacycloud_superadmin_directory() TO authenticated;

REVOKE ALL ON FUNCTION public.log_subscription_creation() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION "public"."manual_admin_upgrade"("target_institution_id" "uuid", "p_plan_name" "text", "p_amount" numeric, "p_currency" "text", "p_momo_ref" "text", "admin_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER SET search_path=public,pg_temp
    AS $$
BEGIN
 PERFORM public.legacycloud_require_superadmin();
    -- Update the institutions table using the column names from your data object
    UPDATE public.institutions
    SET subscription_plan = p_plan_name,
        subscription_end_date = (now() + interval '30 days')
    WHERE id = target_institution_id;

    -- Record the payment in your offline_payments table
    INSERT INTO public.offline_payments (institution_id, amount, currency, plan_type, momo_transaction_id, verified_by)
    VALUES (target_institution_id, p_amount, p_currency, p_plan_name, p_momo_ref, admin_user_id);
END;
$$;




REVOKE ALL ON FUNCTION public.manual_admin_upgrade(uuid,text,numeric,text,text,uuid) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.manual_admin_upgrade(uuid,text,numeric,text,text,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION "public"."manual_admin_upgrade"("target_institution_id" "uuid", "p_plan_name" "text", "p_amount" numeric, "p_currency" "text", "p_max_funerals" integer, "p_momo_ref" "text", "admin_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER SET search_path=public,pg_temp
    AS $$
BEGIN
 PERFORM public.legacycloud_require_superadmin();
    UPDATE public.institutions
    SET plan_type = p_plan_name,
        subscription_end = (now() + interval '30 days')
    WHERE id = target_institution_id;

    INSERT INTO public.offline_payments (institution_id, amount, currency, plan_type, momo_transaction_id, verified_by)
    VALUES (target_institution_id, p_amount, p_currency, p_plan_name, p_momo_ref, admin_user_id);
END;
$$;




REVOKE ALL ON FUNCTION public.manual_admin_upgrade(uuid,text,numeric,text,integer,text,uuid) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.manual_admin_upgrade(uuid,text,numeric,text,integer,text,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION "public"."manual_admin_upgrade"("target_institution_id" "uuid", "p_plan_name" "text", "p_amount" numeric, "p_currency" "text", "p_max_funerals" integer, "p_billing_market" "text", "p_momo_ref" "text", "admin_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER SET search_path=public,pg_temp
    AS $$
BEGIN
 PERFORM public.legacycloud_require_superadmin();
    -- [Keep your existing logic here, but verify the SECURITY DEFINER header]
    -- ... (the rest of your logic)
END;
$$;




REVOKE ALL ON FUNCTION public.manual_admin_upgrade(uuid,text,numeric,text,integer,text,text,uuid) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.manual_admin_upgrade(uuid,text,numeric,text,integer,text,text,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION "public"."manual_admin_upgrade"("p_target_id" "uuid", "p_plan_name" "text", "p_amount" numeric, "p_currency" "text", "p_max_funerals" integer, "p_billing_market" "text", "p_momo_ref" "text", "p_admin_user_id" "uuid", "p_livestream_enabled" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER SET search_path=public,pg_temp
    AS $$
DECLARE
    v_expiry_date TIMESTAMP WITH TIME ZONE := now() + interval '30 days';
BEGIN
 PERFORM public.legacycloud_require_superadmin();
    -- 1. Upsert Subscription Record (Source of Truth)
    INSERT INTO public.subscriptions (
        institution_id, plan_name, amount, currency, max_funerals, 
        billing_market, livestream_enabled, status, starts_at, expires_at, updated_at
    )
    VALUES (
        p_target_id, p_plan_name, p_amount, p_currency, p_max_funerals, 
        p_billing_market, p_livestream_enabled, 'active', now(), v_expiry_date, now()
    )
    ON CONFLICT (institution_id) 
    DO UPDATE SET 
        plan_name = EXCLUDED.plan_name,
        amount = EXCLUDED.amount,
        max_funerals = EXCLUDED.max_funerals,
        livestream_enabled = EXCLUDED.livestream_enabled,
        expires_at = EXCLUDED.expires_at,
        updated_at = EXCLUDED.updated_at,
        status = 'active';

    -- 2. Sync/Cache to Institution Record
    UPDATE public.institutions
    SET subscription_plan = p_plan_name,
        funeral_limit_per_month = p_max_funerals,
        subscription_status = 'active',
        subscription_end_date = v_expiry_date,
        streaming_enabled = p_livestream_enabled
    WHERE id = p_target_id; 

    -- 3. Log Audit/Payment
    INSERT INTO public.offline_payments (
        institution_id, amount, currency, plan_name, momo_ref, admin_user_id
    )
    VALUES (
        p_target_id, p_amount, p_currency, p_plan_name, p_momo_ref, p_admin_user_id
    );
END;
$$;




REVOKE ALL ON FUNCTION public.manual_admin_upgrade(uuid,text,numeric,text,integer,text,text,uuid,boolean) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.manual_admin_upgrade(uuid,text,numeric,text,integer,text,text,uuid,boolean) TO authenticated;

REVOKE ALL ON FUNCTION public.process_token_ledger_entry() FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.trigger_donation_sms() FROM PUBLIC,anon,authenticated;


-- Tenant administrators may edit branding/contact settings, not grant themselves paid plans.
CREATE OR REPLACE FUNCTION public.legacycloud_protect_institution_billing()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF coalesce(auth.role(),'') IN ('anon','authenticated') AND NOT public.legacycloud_security_scope(NULL) THEN
  IF (NEW.subscription_plan,NEW.subscription_status,NEW.subscription_end_date,
      NEW.funeral_limit_per_month,NEW.streaming_enabled,NEW.sms_balance,NEW.admin_user_id)
     IS DISTINCT FROM
     (OLD.subscription_plan,OLD.subscription_status,OLD.subscription_end_date,
      OLD.funeral_limit_per_month,OLD.streaming_enabled,OLD.sms_balance,OLD.admin_user_id) THEN
   RAISE EXCEPTION 'Billing and entitlement changes require a verified server operation or SuperAdmin' USING ERRCODE='42501';
  END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.legacycloud_protect_institution_billing() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS legacycloud_protect_institution_billing ON public.institutions;
CREATE TRIGGER legacycloud_protect_institution_billing BEFORE UPDATE ON public.institutions
FOR EACH ROW EXECUTE FUNCTION public.legacycloud_protect_institution_billing();
CREATE OR REPLACE FUNCTION public.legacycloud_require_superadmin()
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.legacycloud_security_scope(NULL) THEN
  RAISE EXCEPTION 'SuperAdmin access required' USING ERRCODE='42501';
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.legacycloud_require_superadmin() FROM PUBLIC,anon,authenticated;
REVOKE CREATE ON SCHEMA public FROM PUBLIC,anon,authenticated;

-- Future postgres-owned objects require explicit client grants.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC,anon,authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC,anon,authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC,anon,authenticated;
COMMIT; NOTIFY pgrst,'reload schema';