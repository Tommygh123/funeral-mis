


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "citext" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "http" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."create_institution_workspace"("inst_name" "text", "inst_email" "text", "inst_phone" "text", "inst_location" "text", "auth_user_id" "uuid", "admin_role_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  new_inst_id uuid;
begin
  -- 1. If a profile already exists for this ID, remove it to allow a clean insert
  delete from public.users where id = auth_user_id;

  -- 2. Create the Institution
  insert into public.institutions (name, email, phone, location, subscription_plan, subscription_status, local_tokens_balance)
  values (inst_name, inst_email, inst_phone, inst_location, 'free_trial', 'trialing', 1)
  returning id into new_inst_id;

  -- 3. Create the User Profile
  insert into public.users (id, institution_id, full_name, email, role_id, status)
  values (auth_user_id, new_inst_id, inst_name, inst_email, admin_role_id, 'active');
end;
$$;


ALTER FUNCTION "public"."create_institution_workspace"("inst_name" "text", "inst_email" "text", "inst_phone" "text", "inst_location" "text", "auth_user_id" "uuid", "admin_role_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_institution_workspace"("inst_name" "text", "inst_email" "text", "inst_phone" "text", "inst_location" "text", "inst_logo_url" "text", "auth_user_id" "uuid", "admin_role_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  -- 1. Create the Institution
  insert into public.institutions (name, email, phone, location, logo_url, subscription_plan, local_tokens_balance)
  values (inst_name, inst_email, inst_phone, inst_location, inst_logo_url, 'free_trial', 1);

  -- 2. Create the User Profile
  insert into public.users (id, institution_id, full_name, email, role_id, status)
  select auth_user_id, id, inst_name, inst_email, admin_role_id, 'active'
  from public.institutions where email = inst_email;
end;
$$;


ALTER FUNCTION "public"."create_institution_workspace"("inst_name" "text", "inst_email" "text", "inst_phone" "text", "inst_location" "text", "inst_logo_url" "text", "auth_user_id" "uuid", "admin_role_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."deduct_diaspora_token"("inst_id" "uuid", "amount" integer) RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  current_bal INT;
BEGIN
  SELECT diaspora_tokens_balance INTO current_bal FROM institutions WHERE id = inst_id;
  IF current_bal >= amount THEN
    UPDATE institutions SET diaspora_tokens_balance = diaspora_tokens_balance - amount WHERE id = inst_id;
    RETURN TRUE;
  ELSE
    RETURN FALSE;
  END IF;
END;
$$;


ALTER FUNCTION "public"."deduct_diaspora_token"("inst_id" "uuid", "amount" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."funeralmis_extend_subscription"("p_institution_id" "uuid", "p_days" integer, "p_reason" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth', 'pg_temp'
    AS $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_email text;
  v_institution public.institutions%rowtype;
  v_subscription public.subscriptions%rowtype;
  v_old_expiry timestamptz;
  v_base_expiry timestamptz;
  v_new_expiry timestamptz;
begin
  if v_actor_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  select u.email
  into v_actor_email
  from public.users u
  join public.roles r on r.id = u.role_id
  where u.id = v_actor_id
    and upper(r.name) = 'SUPERADMIN'
    and coalesce(u.status, 'active') = 'active';

  if v_actor_email is null then
    raise exception 'Only an active SUPERADMIN can extend subscriptions without payment.' using errcode = '42501';
  end if;

  if p_institution_id is null then
    raise exception 'Institution is required.' using errcode = '22023';
  end if;

  if p_days is null or p_days < 1 or p_days > 3650 then
    raise exception 'Extension must be between 1 and 3650 days.' using errcode = '22023';
  end if;

  if nullif(btrim(p_reason), '') is null or char_length(btrim(p_reason)) < 5 then
    raise exception 'A reason of at least 5 characters is required.' using errcode = '22023';
  end if;

  select *
  into v_institution
  from public.institutions
  where id = p_institution_id
  for update;

  if not found then
    raise exception 'Institution not found.' using errcode = 'P0002';
  end if;

  select *
  into v_subscription
  from public.subscriptions
  where institution_id = p_institution_id
  for update;

  v_old_expiry := greatest(
    coalesce(v_institution.subscription_end_date, '-infinity'::timestamptz),
    coalesce(v_subscription.expires_at, '-infinity'::timestamptz)
  );

  v_base_expiry := greatest(now(), v_old_expiry);
  v_new_expiry := v_base_expiry + make_interval(days => p_days);

  insert into public.subscriptions (
    institution_id, plan_name, amount, billing_market, currency,
    max_funerals, livestream_enabled, starts_at, expires_at, status, updated_at
  ) values (
    p_institution_id,
    coalesce(nullif(v_institution.subscription_plan, ''), 'COMPLIMENTARY'),
    0,
    'complimentary',
    'GHS',
    greatest(coalesce(v_institution.funeral_limit_per_month, 1), 1),
    coalesce(v_institution.streaming_enabled, false),
    now(),
    v_new_expiry,
    'active',
    now()
  )
  on conflict (institution_id) do update
  set expires_at = excluded.expires_at,
      status = 'active',
      updated_at = now();

  update public.institutions
  set subscription_end_date = v_new_expiry,
      subscription_status = 'active'
  where id = p_institution_id;

  insert into public.system_audit_logs (
    admin_email, action, target_id, details
  ) values (
    v_actor_email,
    'COMPLIMENTARY_SUBSCRIPTION_EXTENSION',
    p_institution_id,
    jsonb_build_object(
      'institution_name', v_institution.name,
      'days_added', p_days,
      'reason', btrim(p_reason),
      'previous_expiry', case when v_old_expiry = '-infinity'::timestamptz then null else v_old_expiry end,
      'base_expiry', v_base_expiry,
      'new_expiry', v_new_expiry,
      'payment_required', false,
      'actor_user_id', v_actor_id
    )
  );

  return jsonb_build_object(
    'success', true,
    'institution_id', p_institution_id,
    'institution_name', v_institution.name,
    'days_added', p_days,
    'new_expiry', v_new_expiry,
    'message', format('%s subscription extended by %s day(s).', v_institution.name, p_days)
  );
end;
$$;


ALTER FUNCTION "public"."funeralmis_extend_subscription"("p_institution_id" "uuid", "p_days" integer, "p_reason" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."funeralmis_extend_subscription"("p_institution_id" "uuid", "p_days" integer, "p_reason" "text") IS 'SUPERADMIN-only complimentary extension. Synchronizes subscriptions and institutions and writes an audit record.';



CREATE OR REPLACE FUNCTION "public"."funeralmis_register_username_institution"("p_auth_user_id" "uuid", "p_institution_name" "text", "p_username" "text", "p_internal_email" "text", "p_phone" "text", "p_location" "text", "p_logo_url" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
declare
  v_admin_role_id uuid;
  v_institution_id uuid;
  v_expiry timestamptz := now() + interval '14 days';
begin
  select id into v_admin_role_id from public.roles where upper(name) = 'ADMIN' limit 1;
  if v_admin_role_id is null then raise exception 'ADMIN role was not found.'; end if;

  insert into public.institutions (
    name, email, phone, location, logo_url, admin_user_id,
    subscription_plan, subscription_status, funeral_limit_per_month, subscription_end_date
  ) values (
    btrim(p_institution_name), p_internal_email, nullif(btrim(p_phone), ''),
    nullif(btrim(p_location), ''), nullif(btrim(p_logo_url), ''), p_auth_user_id,
    'BASIC', 'active', 1, v_expiry
  ) returning id into v_institution_id;

  insert into public.subscriptions (
    institution_id, plan_name, billing_market, amount, currency,
    max_funerals, status, starts_at, expires_at
  ) values (
    v_institution_id, 'free_trial', 'local', 0, 'GHS',
    1, 'active', now(), v_expiry
  );

  insert into public.users (
    id, institution_id, full_name, username, email, phone, role_id, status, auth_type
  ) values (
    p_auth_user_id, v_institution_id, btrim(p_institution_name), lower(btrim(p_username)),
    p_internal_email, nullif(btrim(p_phone), ''), v_admin_role_id, 'active', 'password'
  );

  insert into public.system_audit_logs (admin_email, action, target_id, details)
  values (
    p_internal_email, 'USERNAME_INSTITUTION_REGISTRATION', v_institution_id,
    jsonb_build_object('institution_name', btrim(p_institution_name), 'username', lower(btrim(p_username)), 'trial_days', 14, 'actor_user_id', p_auth_user_id)
  );

  return jsonb_build_object('success', true, 'institution_id', v_institution_id, 'expires_at', v_expiry);
end;
$$;


ALTER FUNCTION "public"."funeralmis_register_username_institution"("p_auth_user_id" "uuid", "p_institution_name" "text", "p_username" "text", "p_internal_email" "text", "p_phone" "text", "p_location" "text", "p_logo_url" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_funeral_code"("p_institution_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_next integer;
BEGIN

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


ALTER FUNCTION "public"."generate_funeral_code"("p_institution_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_institution_receipt_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
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


ALTER FUNCTION "public"."generate_institution_receipt_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_receipt_number"("inst_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
declare
  inst_prefix text;
  next_num bigint;
begin
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


ALTER FUNCTION "public"."generate_receipt_number"("inst_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_institution_token_balance"("inst_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    tokens_remaining INTEGER;
BEGIN
    SELECT local_tokens_balance + diaspora_tokens_balance 
    INTO tokens_remaining
    FROM public.institutions
    WHERE id = inst_id;

    -- Return 0 if no institution is found or if the value is null
    RETURN COALESCE(tokens_remaining, 0);
END;
$$;


ALTER FUNCTION "public"."get_institution_token_balance"("inst_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, status)
  VALUES (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', 'New User'),
    'active'
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_subscription_creation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.system_audit_logs (admin_email, action, target_id, details)
  VALUES ('SYSTEM_AUTO', 'NEW_SUBSCRIPTION', NEW.id, jsonb_build_object('plan', NEW.plan_name, 'amount', NEW.amount));
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_subscription_creation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."manual_admin_upgrade"("target_institution_id" "uuid", "p_plan_name" "text", "p_amount" numeric, "p_currency" "text", "p_momo_ref" "text", "admin_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
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


ALTER FUNCTION "public"."manual_admin_upgrade"("target_institution_id" "uuid", "p_plan_name" "text", "p_amount" numeric, "p_currency" "text", "p_momo_ref" "text", "admin_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."manual_admin_upgrade"("target_institution_id" "uuid", "p_plan_name" "text", "p_amount" numeric, "p_currency" "text", "p_max_funerals" integer, "p_momo_ref" "text", "admin_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    UPDATE public.institutions
    SET plan_type = p_plan_name,
        subscription_end = (now() + interval '30 days')
    WHERE id = target_institution_id;

    INSERT INTO public.offline_payments (institution_id, amount, currency, plan_type, momo_transaction_id, verified_by)
    VALUES (target_institution_id, p_amount, p_currency, p_plan_name, p_momo_ref, admin_user_id);
END;
$$;


ALTER FUNCTION "public"."manual_admin_upgrade"("target_institution_id" "uuid", "p_plan_name" "text", "p_amount" numeric, "p_currency" "text", "p_max_funerals" integer, "p_momo_ref" "text", "admin_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."manual_admin_upgrade"("target_institution_id" "uuid", "p_plan_name" "text", "p_amount" numeric, "p_currency" "text", "p_max_funerals" integer, "p_billing_market" "text", "p_momo_ref" "text", "admin_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- [Keep your existing logic here, but verify the SECURITY DEFINER header]
    -- ... (the rest of your logic)
END;
$$;


ALTER FUNCTION "public"."manual_admin_upgrade"("target_institution_id" "uuid", "p_plan_name" "text", "p_amount" numeric, "p_currency" "text", "p_max_funerals" integer, "p_billing_market" "text", "p_momo_ref" "text", "admin_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."manual_admin_upgrade"("p_target_id" "uuid", "p_plan_name" "text", "p_amount" numeric, "p_currency" "text", "p_max_funerals" integer, "p_billing_market" "text", "p_momo_ref" "text", "p_admin_user_id" "uuid", "p_livestream_enabled" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_expiry_date TIMESTAMP WITH TIME ZONE := now() + interval '30 days';
BEGIN
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


ALTER FUNCTION "public"."manual_admin_upgrade"("p_target_id" "uuid", "p_plan_name" "text", "p_amount" numeric, "p_currency" "text", "p_max_funerals" integer, "p_billing_market" "text", "p_momo_ref" "text", "p_admin_user_id" "uuid", "p_livestream_enabled" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_token_ledger_entry"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF NEW.transaction_type = 'DEPOSIT' THEN
        IF NEW.token_type = 'LOCAL' THEN
            UPDATE institutions 
            SET local_tokens_balance = local_tokens_balance + NEW.quantity
            WHERE id = NEW.institution_id;
        ELSIF NEW.token_type = 'DIASPORA' THEN
            UPDATE institutions 
            SET diaspora_tokens_balance = diaspora_tokens_balance + NEW.quantity
            WHERE id = NEW.institution_id;
        END IF;
    ELSIF NEW.transaction_type = 'CONSUMPTION' THEN
        IF NEW.token_type = 'LOCAL' THEN
            UPDATE institutions 
            SET local_tokens_balance = local_tokens_balance - NEW.quantity
            WHERE id = NEW.institution_id;
        ELSIF NEW.token_type = 'DIASPORA' THEN
            UPDATE institutions 
            SET diaspora_tokens_balance = diaspora_tokens_balance - NEW.quantity
            WHERE id = NEW.institution_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."process_token_ledger_entry"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."register_funeral_secure"("p_institution_id" "uuid", "p_funeral_data" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_limit INTEGER;
  v_current INTEGER;
  v_result JSONB;
BEGIN
  -- 1. Get limits and current count
  SELECT funeral_limit_per_month, total_funerals_registered 
  INTO v_limit, v_current
  FROM institutions 
  WHERE id = p_institution_id;

  -- 2. Check if limit is reached
  IF v_current >= v_limit THEN
    RETURN jsonb_build_object('success', false, 'message', 'Trial Limit Reached: Please upgrade your plan.');
  END IF;

  -- 3. Insert Funeral
  INSERT INTO funerals (institution_id, full_name, gender, age, date_of_death, burial_date, location, notes, status)
  VALUES (
    p_institution_id, 
    p_funeral_data->>'full_name',
    p_funeral_data->>'gender',
    (p_funeral_data->>'age')::INTEGER,
    (p_funeral_data->>'date_of_death')::DATE,
    (p_funeral_data->>'burial_date')::DATE,
    p_funeral_data->>'location',
    p_funeral_data->>'notes',
    'active'
  );

  -- 4. Increment counter
  UPDATE institutions 
  SET total_funerals_registered = total_funerals_registered + 1
  WHERE id = p_institution_id;

  RETURN jsonb_build_object('success', true, 'message', 'Funeral registered successfully.');
END;
$$;


ALTER FUNCTION "public"."register_funeral_secure"("p_institution_id" "uuid", "p_funeral_data" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_donation_sms"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_phone text;
begin

  v_phone := coalesce(NEW.donor_phone, NEW.donor_phone_national);
  v_phone := replace(v_phone, ' ', '');

  if v_phone is null or v_phone = '' then
    raise notice 'SMS SKIPPED: empty phone (id=%)', NEW.id;
    return NEW;
  end if;

  perform net.http_post(
    url := 'https://YOUR_PROJECT_REF.functions.supabase.co/send-donation-sms',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'phone', v_phone,
      'donorName', coalesce(NEW.donor_name, 'Donor'),
      'amount', NEW.amount,
      'institutionName', NEW.institution_id
    )
  );

  return NEW;
end;
$$;


ALTER FUNCTION "public"."trigger_donation_sms"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "institution_id" "uuid",
    "user_id" "uuid",
    "action" "text" NOT NULL,
    "entity_type" character varying(100),
    "entity_id" "uuid",
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."funeral_sequences" (
    "institution_id" "uuid" NOT NULL,
    "last_number" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."funeral_sequences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."funerals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "institution_id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "gender" "text",
    "photo_url" "text",
    "date_of_death" "date",
    "burial_date" "date",
    "location" "text",
    "notes" "text",
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "age" integer,
    "date_of_birth" "date",
    "family_contact_name" "text",
    "family_contact_phone" character varying,
    "closed_at" timestamp without time zone,
    "archived_at" timestamp without time zone,
    "is_active_weekend" boolean DEFAULT true,
    "manager_id" "uuid"
);


ALTER TABLE "public"."funerals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "institution_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "funeral_id" "uuid",
    "recipient_name" "text",
    "recipient_relation" "text",
    "donor_name" "text",
    "donor_phone" "text",
    "amount" numeric NOT NULL,
    "currency" "text" DEFAULT 'GHS'::"text" NOT NULL,
    "exchange_rate" numeric DEFAULT 1,
    "amount_base" numeric NOT NULL,
    "payment_method" "text",
    "reference" "text",
    "receipt_url" "text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "donor_country_code" character varying(10) DEFAULT '+233'::character varying NOT NULL,
    "donor_phone_national" character varying(30) NOT NULL,
    "phone_valid" boolean DEFAULT true,
    "receipt_number" "text",
    "idempotency_key" "text",
    "status" "text" DEFAULT 'active'::"text",
    "payment_source" "text" DEFAULT 'cashier'::"text",
    "transaction_type" "text" DEFAULT 'fee'::"text",
    CONSTRAINT "phone_length_check" CHECK (("length"("donor_phone") >= 10))
);


ALTER TABLE "public"."transactions" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."global_financial_stats" WITH ("security_invoker"='on') AS
 SELECT "institution_id",
    "currency",
    "sum"("amount") AS "total_amount",
    "count"(*) AS "transaction_count"
   FROM "public"."transactions"
  GROUP BY "institution_id", "currency";


ALTER VIEW "public"."global_financial_stats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."institution_receipt_counters" (
    "institution_id" "uuid" NOT NULL,
    "last_number" integer DEFAULT 0
);


ALTER TABLE "public"."institution_receipt_counters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."institutions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "location" character varying(255),
    "email" character varying(255),
    "phone" character varying(50),
    "logo_url" "text",
    "subscription_plan" character varying(50),
    "subscription_status" character varying(50) DEFAULT 'active'::character varying,
    "sms_balance" integer DEFAULT 0,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "admin_user_id" "uuid",
    "whatsapp_enabled" boolean DEFAULT true,
    "webhook_url" "text" DEFAULT ''::"text",
    "streaming_enabled" boolean DEFAULT false,
    "subscription_end_date" timestamp with time zone,
    "funeral_limit_per_month" integer DEFAULT 1,
    "total_funerals_this_period" integer DEFAULT 0,
    "total_funerals_registered" integer DEFAULT 0,
    "prefix" "text"
);


ALTER TABLE "public"."institutions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "institution_id" "uuid",
    "sms_enabled" boolean DEFAULT true,
    "whatsapp_enabled" boolean DEFAULT false,
    "email_enabled" boolean DEFAULT false,
    "preferred_channel" "text" DEFAULT 'sms'::"text",
    "whatsapp_business_phone_number_id" "text",
    "whatsapp_permanent_access_token" "text",
    "whatsapp_waba_id" "text"
);


ALTER TABLE "public"."notification_settings" OWNER TO "postgres";


COMMENT ON COLUMN "public"."notification_settings"."whatsapp_business_phone_number_id" IS 'Meta Cloud API Phone Number ID unique identifier';



COMMENT ON COLUMN "public"."notification_settings"."whatsapp_permanent_access_token" IS 'System user access token generated in Meta Business Suite';



CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "institution_id" "uuid" NOT NULL,
    "transaction_id" "uuid",
    "funeral_id" "uuid",
    "channel" "text" NOT NULL,
    "recipient" "text" NOT NULL,
    "message" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "provider" "text",
    "error" "text",
    "retry_count" integer DEFAULT 0,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "sent_at" timestamp without time zone
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."offline_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "institution_id" "uuid",
    "plan_name" "text",
    "amount" numeric,
    "currency" "text" DEFAULT 'GHS'::"text",
    "momo_ref" "text",
    "admin_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "plan_type" "text"
);


ALTER TABLE "public"."offline_payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" character varying(100) NOT NULL,
    "description" "text"
);


ALTER TABLE "public"."permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_token_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "institution_id" "uuid" NOT NULL,
    "transaction_type" character varying NOT NULL,
    "token_type" character varying NOT NULL,
    "quantity" integer NOT NULL,
    "amount_paid" numeric(10,2) DEFAULT 0.00,
    "currency" character varying DEFAULT 'GHS'::character varying,
    "reference_note" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "check_token_type" CHECK ((("token_type")::"text" = ANY ((ARRAY['LOCAL'::character varying, 'DIASPORA'::character varying])::"text"[]))),
    CONSTRAINT "check_tx_type" CHECK ((("transaction_type")::"text" = ANY ((ARRAY['DEPOSIT'::character varying, 'CONSUMPTION'::character varying])::"text"[])))
);


ALTER TABLE "public"."platform_token_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."receipt_sequences" (
    "institution_id" "uuid" NOT NULL,
    "prefix" "text" NOT NULL,
    "last_number" bigint DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."receipt_sequences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."role_permissions" (
    "role_id" "uuid" NOT NULL,
    "permission_id" "uuid" NOT NULL
);


ALTER TABLE "public"."role_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(50) NOT NULL,
    "description" "text"
);


ALTER TABLE "public"."roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sms_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "institution_id" "uuid" NOT NULL,
    "transaction_id" "uuid",
    "phone" "text" NOT NULL,
    "message" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "provider" "text" DEFAULT 'mock'::"text",
    "error" "text",
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."sms_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "institution_id" "uuid",
    "plan_name" "text" NOT NULL,
    "billing_market" "text" NOT NULL,
    "amount" numeric NOT NULL,
    "currency" "text" NOT NULL,
    "max_funerals" integer NOT NULL,
    "livestream_enabled" boolean DEFAULT false,
    "starts_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "expires_at" timestamp with time zone NOT NULL,
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "updated_at" timestamp with time zone
);


ALTER TABLE "public"."subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."system_audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "admin_email" "text",
    "action" "text",
    "target_id" "uuid",
    "details" "jsonb",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"())
);


ALTER TABLE "public"."system_audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."system_global_configs" (
    "config_key" character varying NOT NULL,
    "config_value" "text" NOT NULL,
    "currency" character varying(10),
    "description" "text",
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."system_global_configs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_funeral_access" (
    "user_id" "uuid" NOT NULL,
    "funeral_id" "uuid" NOT NULL
);


ALTER TABLE "public"."user_funeral_access" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "login_time" timestamp without time zone DEFAULT "now"(),
    "logout_time" timestamp without time zone,
    "ip_address" character varying(100),
    "device_info" "text"
);


ALTER TABLE "public"."user_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "institution_id" "uuid",
    "full_name" character varying(255) NOT NULL,
    "email" character varying(255),
    "phone" character varying(50),
    "password_hash" "text",
    "pin_hash" "text",
    "role_id" "uuid",
    "auth_type" character varying(20) DEFAULT 'password'::character varying,
    "status" character varying(20) DEFAULT 'active'::character varying,
    "last_login" timestamp without time zone,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "username" "public"."citext" NOT NULL,
    CONSTRAINT "users_username_format_check" CHECK ((("username")::"text" ~ '^[a-z0-9][a-z0-9._-]{2,31}$'::"text"))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


COMMENT ON COLUMN "public"."users"."username" IS 'Globally unique, case-insensitive login name. Supabase Auth continues to authenticate the underlying email identifier.';



CREATE TABLE IF NOT EXISTS "public"."voided_transactions" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "reference" "text" NOT NULL,
    "reason" "text"
);


ALTER TABLE "public"."voided_transactions" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."valid_transactions" AS
 SELECT "t"."id",
    "t"."institution_id",
    "t"."user_id",
    "t"."funeral_id",
    "t"."recipient_name",
    "t"."recipient_relation",
    "t"."donor_name",
    "t"."donor_phone",
    "t"."amount",
    "t"."currency",
    "t"."exchange_rate",
    "t"."amount_base",
    "t"."payment_method",
    "t"."reference",
    "t"."receipt_url",
    "t"."created_at",
    "t"."donor_country_code",
    "t"."donor_phone_national",
    "t"."phone_valid",
    "t"."receipt_number",
    "t"."idempotency_key",
    "t"."status"
   FROM ("public"."transactions" "t"
     LEFT JOIN "public"."voided_transactions" "v" ON (("t"."reference" = "v"."reference")))
  WHERE ("v"."reference" IS NULL);


ALTER VIEW "public"."valid_transactions" OWNER TO "postgres";


ALTER TABLE "public"."voided_transactions" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."voided_transactions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."funeral_sequences"
    ADD CONSTRAINT "funeral_sequences_pkey" PRIMARY KEY ("institution_id");



ALTER TABLE ONLY "public"."funerals"
    ADD CONSTRAINT "funerals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."institution_receipt_counters"
    ADD CONSTRAINT "institution_receipt_counters_pkey" PRIMARY KEY ("institution_id");



ALTER TABLE ONLY "public"."institutions"
    ADD CONSTRAINT "institutions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."institutions"
    ADD CONSTRAINT "institutions_prefix_key" UNIQUE ("prefix");



ALTER TABLE ONLY "public"."notification_settings"
    ADD CONSTRAINT "notification_settings_institution_id_key" UNIQUE ("institution_id");



ALTER TABLE ONLY "public"."notification_settings"
    ADD CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."offline_payments"
    ADD CONSTRAINT "offline_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."permissions"
    ADD CONSTRAINT "permissions_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."permissions"
    ADD CONSTRAINT "permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_token_transactions"
    ADD CONSTRAINT "platform_token_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."receipt_sequences"
    ADD CONSTRAINT "receipt_sequences_pkey" PRIMARY KEY ("institution_id");



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id", "permission_id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sms_logs"
    ADD CONSTRAINT "sms_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_audit_logs"
    ADD CONSTRAINT "system_audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_global_configs"
    ADD CONSTRAINT "system_global_configs_pkey" PRIMARY KEY ("config_key");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_receipt_number_key" UNIQUE ("receipt_number");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "unique_institution_id" UNIQUE ("institution_id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "unique_tenant_reference" UNIQUE ("institution_id", "reference");



ALTER TABLE ONLY "public"."user_funeral_access"
    ADD CONSTRAINT "user_funeral_access_pkey" PRIMARY KEY ("user_id", "funeral_id");



ALTER TABLE ONLY "public"."user_sessions"
    ADD CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_phone_key" UNIQUE ("phone");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."voided_transactions"
    ADD CONSTRAINT "voided_transactions_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_audit_logs_institution" ON "public"."audit_logs" USING "btree" ("institution_id");



CREATE INDEX "idx_audit_logs_user" ON "public"."audit_logs" USING "btree" ("user_id");



CREATE INDEX "idx_funerals_active_by_institution" ON "public"."funerals" USING "btree" ("institution_id", "status") WHERE ("status" = 'active'::"text");



CREATE INDEX "idx_funerals_institution" ON "public"."funerals" USING "btree" ("institution_id");



CREATE INDEX "idx_funerals_institution_status" ON "public"."funerals" USING "btree" ("institution_id", "status");



CREATE INDEX "idx_funerals_manager" ON "public"."funerals" USING "btree" ("manager_id");



CREATE INDEX "idx_funerals_status" ON "public"."funerals" USING "btree" ("status");



CREATE INDEX "idx_sessions_user" ON "public"."user_sessions" USING "btree" ("user_id");



CREATE INDEX "idx_sms_institution" ON "public"."sms_logs" USING "btree" ("institution_id");



CREATE INDEX "idx_sms_transaction" ON "public"."sms_logs" USING "btree" ("transaction_id");



CREATE INDEX "idx_subscriptions_institution" ON "public"."subscriptions" USING "btree" ("institution_id", "status");



CREATE INDEX "idx_transactions_tenant_phone_search" ON "public"."transactions" USING "btree" ("institution_id", "donor_country_code", "donor_phone_national");



CREATE INDEX "idx_txn_funeral" ON "public"."transactions" USING "btree" ("funeral_id");



CREATE INDEX "idx_txn_institution" ON "public"."transactions" USING "btree" ("institution_id");



CREATE INDEX "idx_users_institution" ON "public"."users" USING "btree" ("institution_id");



CREATE INDEX "idx_users_role" ON "public"."users" USING "btree" ("role_id");



CREATE UNIQUE INDEX "users_username_unique" ON "public"."users" USING "btree" ("username") WHERE ("username" IS NOT NULL);



CREATE OR REPLACE TRIGGER "donation_sms_trigger" AFTER INSERT ON "public"."transactions" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_donation_sms"();



CREATE OR REPLACE TRIGGER "on_subscription_created" AFTER INSERT ON "public"."subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."log_subscription_creation"();



CREATE OR REPLACE TRIGGER "set_institution_receipt_id" BEFORE INSERT ON "public"."transactions" FOR EACH ROW EXECUTE FUNCTION "public"."generate_institution_receipt_id"();



CREATE OR REPLACE TRIGGER "trigger_wallet_balance_sync" AFTER INSERT ON "public"."platform_token_transactions" FOR EACH ROW EXECUTE FUNCTION "public"."process_token_ledger_entry"();



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."funerals"
    ADD CONSTRAINT "fk_funerals_institution" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id");



ALTER TABLE ONLY "public"."sms_logs"
    ADD CONSTRAINT "fk_sms_logs_institution" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id");



ALTER TABLE ONLY "public"."funerals"
    ADD CONSTRAINT "funerals_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."institution_receipt_counters"
    ADD CONSTRAINT "institution_receipt_counters_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."offline_payments"
    ADD CONSTRAINT "offline_payments_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."offline_payments"
    ADD CONSTRAINT "offline_payments_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id");



ALTER TABLE ONLY "public"."platform_token_transactions"
    ADD CONSTRAINT "platform_token_transactions_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sms_logs"
    ADD CONSTRAINT "sms_logs_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_funeral_id_fkey" FOREIGN KEY ("funeral_id") REFERENCES "public"."funerals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_funeral_access"
    ADD CONSTRAINT "user_funeral_access_funeral_id_fkey" FOREIGN KEY ("funeral_id") REFERENCES "public"."funerals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_funeral_access"
    ADD CONSTRAINT "user_funeral_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_sessions"
    ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id");



CREATE POLICY "Allow authenticated insert" ON "public"."users" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow authenticated insert users" ON "public"."users" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow authenticated read users" ON "public"."users" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated select" ON "public"."users" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated to read institutions" ON "public"."offline_payments" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated update" ON "public"."users" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated users to insert" ON "public"."voided_transactions" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow authenticated users to read" ON "public"."voided_transactions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated users to read global configs" ON "public"."system_global_configs" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow insert for all users" ON "public"."institutions" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "Allow institution insert" ON "public"."institutions" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow public read access" ON "public"."funerals" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow read institutions" ON "public"."institutions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow update for status" ON "public"."funerals" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow update own record" ON "public"."users" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Institution insert" ON "public"."institutions" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Institution scoped insert" ON "public"."funerals" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."institution_id" = "funerals"."institution_id")))));



CREATE POLICY "Institution scoped transactions" ON "public"."transactions" TO "authenticated" USING (("institution_id" IN ( SELECT "users"."institution_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"())))) WITH CHECK (("institution_id" IN ( SELECT "users"."institution_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Institution select" ON "public"."institutions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Only superadmins can update global configs" ON "public"."system_global_configs" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."users" "u"
     JOIN "public"."roles" "r" ON (("u"."role_id" = "r"."id")))
  WHERE (("u"."id" = "auth"."uid"()) AND (("r"."name")::"text" = 'SUPERADMIN'::"text")))));



CREATE POLICY "Service role can insert" ON "public"."subscriptions" FOR INSERT WITH CHECK (true);



CREATE POLICY "SuperAdmin can view all sms logs" ON "public"."sms_logs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."users" "u"
     JOIN "public"."roles" "r" ON (("u"."role_id" = "r"."id")))
  WHERE (("u"."id" = "auth"."uid"()) AND (("r"."name")::"text" = 'SUPERADMIN'::"text")))));



CREATE POLICY "SuperAdmin_Access_Policy" ON "public"."funerals" TO "authenticated" USING ((("auth"."jwt"() ->> 'email'::"text") = 'tcc2000gh@gmail.com'::"text"));



CREATE POLICY "SuperAdmins can see all global sms logs" ON "public"."sms_logs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."users" "u"
     JOIN "public"."roles" "r" ON (("u"."role_id" = "r"."id")))
  WHERE (("u"."id" = "auth"."uid"()) AND (("r"."name")::"text" = 'SUPERADMIN'::"text")))));



CREATE POLICY "Users can view own institution subscriptions" ON "public"."subscriptions" FOR SELECT USING ((("institution_id" IN ( SELECT "institutions"."id"
   FROM "public"."institutions"
  WHERE (("institutions"."id" = "auth"."uid"()) OR ("institutions"."id" IN ( SELECT "users"."institution_id"
           FROM "public"."users"
          WHERE ("users"."id" = "auth"."uid"())))))) AND ("status" = ANY (ARRAY['active'::"text", 'trialing'::"text"]))));



CREATE POLICY "allow insert" ON "public"."institutions" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "allow insert institutions" ON "public"."institutions" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "authenticated access institutions" ON "public"."institutions" USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "authenticated access sms_logs" ON "public"."sms_logs" USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "authenticated access transactions" ON "public"."transactions" USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "authenticated access users" ON "public"."users" USING (("auth"."role"() = 'authenticated'::"text")) WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "dev insert institutions" ON "public"."institutions" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "dev insert users" ON "public"."users" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



ALTER TABLE "public"."funeral_sequences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."funerals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "insert institutions" ON "public"."institutions" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "insert users" ON "public"."users" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "institution_scoped_access" ON "public"."funerals" TO "authenticated" USING (("institution_id" = ( SELECT "users"."institution_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"())))) WITH CHECK (("institution_id" = ( SELECT "users"."institution_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



ALTER TABLE "public"."institutions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."offline_payments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "select institutions" ON "public"."institutions" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "select users" ON "public"."users" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."sms_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."system_audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."system_global_configs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."voided_transactions" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






GRANT ALL ON FUNCTION "public"."citextin"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."citextin"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."citextin"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citextin"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."citextout"("public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citextout"("public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citextout"("public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citextout"("public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."citextrecv"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."citextrecv"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."citextrecv"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citextrecv"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."citextsend"("public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citextsend"("public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citextsend"("public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citextsend"("public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."citext"(boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."citext"(boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."citext"(boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext"(boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."citext"(character) TO "postgres";
GRANT ALL ON FUNCTION "public"."citext"(character) TO "anon";
GRANT ALL ON FUNCTION "public"."citext"(character) TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext"(character) TO "service_role";



GRANT ALL ON FUNCTION "public"."citext"("inet") TO "postgres";
GRANT ALL ON FUNCTION "public"."citext"("inet") TO "anon";
GRANT ALL ON FUNCTION "public"."citext"("inet") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext"("inet") TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."bytea_to_text"("data" "bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."bytea_to_text"("data" "bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."bytea_to_text"("data" "bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bytea_to_text"("data" "bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."citext_cmp"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citext_cmp"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citext_cmp"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext_cmp"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."citext_eq"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citext_eq"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citext_eq"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext_eq"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."citext_ge"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citext_ge"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citext_ge"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext_ge"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."citext_gt"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citext_gt"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citext_gt"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext_gt"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."citext_hash"("public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citext_hash"("public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citext_hash"("public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext_hash"("public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."citext_hash_extended"("public"."citext", bigint) TO "postgres";
GRANT ALL ON FUNCTION "public"."citext_hash_extended"("public"."citext", bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."citext_hash_extended"("public"."citext", bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext_hash_extended"("public"."citext", bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."citext_larger"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citext_larger"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citext_larger"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext_larger"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."citext_le"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citext_le"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citext_le"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext_le"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."citext_lt"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citext_lt"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citext_lt"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext_lt"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."citext_ne"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citext_ne"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citext_ne"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext_ne"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."citext_pattern_cmp"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citext_pattern_cmp"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citext_pattern_cmp"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext_pattern_cmp"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."citext_pattern_ge"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citext_pattern_ge"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citext_pattern_ge"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext_pattern_ge"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."citext_pattern_gt"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citext_pattern_gt"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citext_pattern_gt"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext_pattern_gt"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."citext_pattern_le"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citext_pattern_le"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citext_pattern_le"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext_pattern_le"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."citext_pattern_lt"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citext_pattern_lt"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citext_pattern_lt"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext_pattern_lt"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."citext_smaller"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."citext_smaller"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."citext_smaller"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."citext_smaller"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_institution_workspace"("inst_name" "text", "inst_email" "text", "inst_phone" "text", "inst_location" "text", "auth_user_id" "uuid", "admin_role_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_institution_workspace"("inst_name" "text", "inst_email" "text", "inst_phone" "text", "inst_location" "text", "auth_user_id" "uuid", "admin_role_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_institution_workspace"("inst_name" "text", "inst_email" "text", "inst_phone" "text", "inst_location" "text", "auth_user_id" "uuid", "admin_role_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_institution_workspace"("inst_name" "text", "inst_email" "text", "inst_phone" "text", "inst_location" "text", "inst_logo_url" "text", "auth_user_id" "uuid", "admin_role_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_institution_workspace"("inst_name" "text", "inst_email" "text", "inst_phone" "text", "inst_location" "text", "inst_logo_url" "text", "auth_user_id" "uuid", "admin_role_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_institution_workspace"("inst_name" "text", "inst_email" "text", "inst_phone" "text", "inst_location" "text", "inst_logo_url" "text", "auth_user_id" "uuid", "admin_role_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."deduct_diaspora_token"("inst_id" "uuid", "amount" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."deduct_diaspora_token"("inst_id" "uuid", "amount" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."deduct_diaspora_token"("inst_id" "uuid", "amount" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."funeralmis_extend_subscription"("p_institution_id" "uuid", "p_days" integer, "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."funeralmis_extend_subscription"("p_institution_id" "uuid", "p_days" integer, "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."funeralmis_extend_subscription"("p_institution_id" "uuid", "p_days" integer, "p_reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."funeralmis_register_username_institution"("p_auth_user_id" "uuid", "p_institution_name" "text", "p_username" "text", "p_internal_email" "text", "p_phone" "text", "p_location" "text", "p_logo_url" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."funeralmis_register_username_institution"("p_auth_user_id" "uuid", "p_institution_name" "text", "p_username" "text", "p_internal_email" "text", "p_phone" "text", "p_location" "text", "p_logo_url" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_funeral_code"("p_institution_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_funeral_code"("p_institution_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_funeral_code"("p_institution_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_institution_receipt_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_institution_receipt_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_institution_receipt_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_receipt_number"("inst_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_receipt_number"("inst_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_receipt_number"("inst_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_institution_token_balance"("inst_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_institution_token_balance"("inst_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_institution_token_balance"("inst_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."http"("request" "public"."http_request") TO "postgres";
GRANT ALL ON FUNCTION "public"."http"("request" "public"."http_request") TO "anon";
GRANT ALL ON FUNCTION "public"."http"("request" "public"."http_request") TO "authenticated";
GRANT ALL ON FUNCTION "public"."http"("request" "public"."http_request") TO "service_role";



GRANT ALL ON FUNCTION "public"."http_delete"("uri" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."http_delete"("uri" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."http_delete"("uri" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_delete"("uri" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."http_delete"("uri" character varying, "content" character varying, "content_type" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."http_delete"("uri" character varying, "content" character varying, "content_type" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."http_delete"("uri" character varying, "content" character varying, "content_type" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_delete"("uri" character varying, "content" character varying, "content_type" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."http_get"("uri" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."http_get"("uri" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."http_get"("uri" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_get"("uri" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."http_get"("uri" character varying, "data" "jsonb") TO "postgres";
GRANT ALL ON FUNCTION "public"."http_get"("uri" character varying, "data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."http_get"("uri" character varying, "data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_get"("uri" character varying, "data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."http_head"("uri" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."http_head"("uri" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."http_head"("uri" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_head"("uri" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."http_header"("field" character varying, "value" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."http_header"("field" character varying, "value" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."http_header"("field" character varying, "value" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_header"("field" character varying, "value" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."http_list_curlopt"() TO "postgres";
GRANT ALL ON FUNCTION "public"."http_list_curlopt"() TO "anon";
GRANT ALL ON FUNCTION "public"."http_list_curlopt"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_list_curlopt"() TO "service_role";



GRANT ALL ON FUNCTION "public"."http_patch"("uri" character varying, "content" character varying, "content_type" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."http_patch"("uri" character varying, "content" character varying, "content_type" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."http_patch"("uri" character varying, "content" character varying, "content_type" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_patch"("uri" character varying, "content" character varying, "content_type" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."http_post"("uri" character varying, "data" "jsonb") TO "postgres";
GRANT ALL ON FUNCTION "public"."http_post"("uri" character varying, "data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."http_post"("uri" character varying, "data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_post"("uri" character varying, "data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."http_post"("uri" character varying, "content" character varying, "content_type" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."http_post"("uri" character varying, "content" character varying, "content_type" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."http_post"("uri" character varying, "content" character varying, "content_type" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_post"("uri" character varying, "content" character varying, "content_type" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."http_put"("uri" character varying, "content" character varying, "content_type" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."http_put"("uri" character varying, "content" character varying, "content_type" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."http_put"("uri" character varying, "content" character varying, "content_type" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_put"("uri" character varying, "content" character varying, "content_type" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."http_reset_curlopt"() TO "postgres";
GRANT ALL ON FUNCTION "public"."http_reset_curlopt"() TO "anon";
GRANT ALL ON FUNCTION "public"."http_reset_curlopt"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_reset_curlopt"() TO "service_role";



GRANT ALL ON FUNCTION "public"."http_set_curlopt"("curlopt" character varying, "value" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."http_set_curlopt"("curlopt" character varying, "value" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."http_set_curlopt"("curlopt" character varying, "value" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."http_set_curlopt"("curlopt" character varying, "value" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."log_subscription_creation"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_subscription_creation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_subscription_creation"() TO "service_role";



GRANT ALL ON FUNCTION "public"."manual_admin_upgrade"("target_institution_id" "uuid", "p_plan_name" "text", "p_amount" numeric, "p_currency" "text", "p_momo_ref" "text", "admin_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."manual_admin_upgrade"("target_institution_id" "uuid", "p_plan_name" "text", "p_amount" numeric, "p_currency" "text", "p_momo_ref" "text", "admin_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."manual_admin_upgrade"("target_institution_id" "uuid", "p_plan_name" "text", "p_amount" numeric, "p_currency" "text", "p_momo_ref" "text", "admin_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."manual_admin_upgrade"("target_institution_id" "uuid", "p_plan_name" "text", "p_amount" numeric, "p_currency" "text", "p_max_funerals" integer, "p_momo_ref" "text", "admin_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."manual_admin_upgrade"("target_institution_id" "uuid", "p_plan_name" "text", "p_amount" numeric, "p_currency" "text", "p_max_funerals" integer, "p_momo_ref" "text", "admin_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."manual_admin_upgrade"("target_institution_id" "uuid", "p_plan_name" "text", "p_amount" numeric, "p_currency" "text", "p_max_funerals" integer, "p_momo_ref" "text", "admin_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."manual_admin_upgrade"("target_institution_id" "uuid", "p_plan_name" "text", "p_amount" numeric, "p_currency" "text", "p_max_funerals" integer, "p_billing_market" "text", "p_momo_ref" "text", "admin_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."manual_admin_upgrade"("target_institution_id" "uuid", "p_plan_name" "text", "p_amount" numeric, "p_currency" "text", "p_max_funerals" integer, "p_billing_market" "text", "p_momo_ref" "text", "admin_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."manual_admin_upgrade"("target_institution_id" "uuid", "p_plan_name" "text", "p_amount" numeric, "p_currency" "text", "p_max_funerals" integer, "p_billing_market" "text", "p_momo_ref" "text", "admin_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."manual_admin_upgrade"("p_target_id" "uuid", "p_plan_name" "text", "p_amount" numeric, "p_currency" "text", "p_max_funerals" integer, "p_billing_market" "text", "p_momo_ref" "text", "p_admin_user_id" "uuid", "p_livestream_enabled" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."manual_admin_upgrade"("p_target_id" "uuid", "p_plan_name" "text", "p_amount" numeric, "p_currency" "text", "p_max_funerals" integer, "p_billing_market" "text", "p_momo_ref" "text", "p_admin_user_id" "uuid", "p_livestream_enabled" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."manual_admin_upgrade"("p_target_id" "uuid", "p_plan_name" "text", "p_amount" numeric, "p_currency" "text", "p_max_funerals" integer, "p_billing_market" "text", "p_momo_ref" "text", "p_admin_user_id" "uuid", "p_livestream_enabled" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."process_token_ledger_entry"() TO "anon";
GRANT ALL ON FUNCTION "public"."process_token_ledger_entry"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_token_ledger_entry"() TO "service_role";



GRANT ALL ON FUNCTION "public"."regexp_match"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."regexp_match"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."regexp_match"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."regexp_match"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."regexp_match"("public"."citext", "public"."citext", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."regexp_match"("public"."citext", "public"."citext", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."regexp_match"("public"."citext", "public"."citext", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."regexp_match"("public"."citext", "public"."citext", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."regexp_matches"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."regexp_matches"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."regexp_matches"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."regexp_matches"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."regexp_matches"("public"."citext", "public"."citext", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."regexp_matches"("public"."citext", "public"."citext", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."regexp_matches"("public"."citext", "public"."citext", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."regexp_matches"("public"."citext", "public"."citext", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."regexp_replace"("public"."citext", "public"."citext", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."regexp_replace"("public"."citext", "public"."citext", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."regexp_replace"("public"."citext", "public"."citext", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."regexp_replace"("public"."citext", "public"."citext", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."regexp_replace"("public"."citext", "public"."citext", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."regexp_replace"("public"."citext", "public"."citext", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."regexp_replace"("public"."citext", "public"."citext", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."regexp_replace"("public"."citext", "public"."citext", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."regexp_split_to_array"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."regexp_split_to_array"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."regexp_split_to_array"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."regexp_split_to_array"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."regexp_split_to_array"("public"."citext", "public"."citext", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."regexp_split_to_array"("public"."citext", "public"."citext", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."regexp_split_to_array"("public"."citext", "public"."citext", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."regexp_split_to_array"("public"."citext", "public"."citext", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."regexp_split_to_table"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."regexp_split_to_table"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."regexp_split_to_table"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."regexp_split_to_table"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."regexp_split_to_table"("public"."citext", "public"."citext", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."regexp_split_to_table"("public"."citext", "public"."citext", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."regexp_split_to_table"("public"."citext", "public"."citext", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."regexp_split_to_table"("public"."citext", "public"."citext", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."register_funeral_secure"("p_institution_id" "uuid", "p_funeral_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."register_funeral_secure"("p_institution_id" "uuid", "p_funeral_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."register_funeral_secure"("p_institution_id" "uuid", "p_funeral_data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."replace"("public"."citext", "public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."replace"("public"."citext", "public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."replace"("public"."citext", "public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."replace"("public"."citext", "public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."split_part"("public"."citext", "public"."citext", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."split_part"("public"."citext", "public"."citext", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."split_part"("public"."citext", "public"."citext", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."split_part"("public"."citext", "public"."citext", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."strpos"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."strpos"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."strpos"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strpos"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."text_to_bytea"("data" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."text_to_bytea"("data" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."text_to_bytea"("data" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."text_to_bytea"("data" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."texticlike"("public"."citext", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."texticlike"("public"."citext", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."texticlike"("public"."citext", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."texticlike"("public"."citext", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."texticlike"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."texticlike"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."texticlike"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."texticlike"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."texticnlike"("public"."citext", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."texticnlike"("public"."citext", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."texticnlike"("public"."citext", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."texticnlike"("public"."citext", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."texticnlike"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."texticnlike"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."texticnlike"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."texticnlike"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."texticregexeq"("public"."citext", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."texticregexeq"("public"."citext", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."texticregexeq"("public"."citext", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."texticregexeq"("public"."citext", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."texticregexeq"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."texticregexeq"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."texticregexeq"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."texticregexeq"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."texticregexne"("public"."citext", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."texticregexne"("public"."citext", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."texticregexne"("public"."citext", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."texticregexne"("public"."citext", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."texticregexne"("public"."citext", "public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."texticregexne"("public"."citext", "public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."texticregexne"("public"."citext", "public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."texticregexne"("public"."citext", "public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."translate"("public"."citext", "public"."citext", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."translate"("public"."citext", "public"."citext", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."translate"("public"."citext", "public"."citext", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."translate"("public"."citext", "public"."citext", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_donation_sms"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_donation_sms"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_donation_sms"() TO "service_role";



GRANT ALL ON FUNCTION "public"."urlencode"("string" "bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."urlencode"("string" "bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."urlencode"("string" "bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."urlencode"("string" "bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."urlencode"("data" "jsonb") TO "postgres";
GRANT ALL ON FUNCTION "public"."urlencode"("data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."urlencode"("data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."urlencode"("data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."urlencode"("string" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."urlencode"("string" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."urlencode"("string" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."urlencode"("string" character varying) TO "service_role";












GRANT ALL ON FUNCTION "public"."max"("public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."max"("public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."max"("public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."max"("public"."citext") TO "service_role";



GRANT ALL ON FUNCTION "public"."min"("public"."citext") TO "postgres";
GRANT ALL ON FUNCTION "public"."min"("public"."citext") TO "anon";
GRANT ALL ON FUNCTION "public"."min"("public"."citext") TO "authenticated";
GRANT ALL ON FUNCTION "public"."min"("public"."citext") TO "service_role";









GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."funeral_sequences" TO "anon";
GRANT ALL ON TABLE "public"."funeral_sequences" TO "authenticated";
GRANT ALL ON TABLE "public"."funeral_sequences" TO "service_role";



GRANT ALL ON TABLE "public"."funerals" TO "anon";
GRANT ALL ON TABLE "public"."funerals" TO "authenticated";
GRANT ALL ON TABLE "public"."funerals" TO "service_role";



GRANT ALL ON TABLE "public"."transactions" TO "anon";
GRANT ALL ON TABLE "public"."transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."transactions" TO "service_role";



GRANT ALL ON TABLE "public"."global_financial_stats" TO "anon";
GRANT ALL ON TABLE "public"."global_financial_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."global_financial_stats" TO "service_role";



GRANT ALL ON TABLE "public"."institution_receipt_counters" TO "anon";
GRANT ALL ON TABLE "public"."institution_receipt_counters" TO "authenticated";
GRANT ALL ON TABLE "public"."institution_receipt_counters" TO "service_role";



GRANT ALL ON TABLE "public"."institutions" TO "anon";
GRANT ALL ON TABLE "public"."institutions" TO "authenticated";
GRANT ALL ON TABLE "public"."institutions" TO "service_role";



GRANT ALL ON TABLE "public"."notification_settings" TO "anon";
GRANT ALL ON TABLE "public"."notification_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_settings" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."offline_payments" TO "anon";
GRANT ALL ON TABLE "public"."offline_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."offline_payments" TO "service_role";



GRANT ALL ON TABLE "public"."permissions" TO "anon";
GRANT ALL ON TABLE "public"."permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."permissions" TO "service_role";



GRANT ALL ON TABLE "public"."platform_token_transactions" TO "anon";
GRANT ALL ON TABLE "public"."platform_token_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_token_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."receipt_sequences" TO "anon";
GRANT ALL ON TABLE "public"."receipt_sequences" TO "authenticated";
GRANT ALL ON TABLE "public"."receipt_sequences" TO "service_role";



GRANT ALL ON TABLE "public"."role_permissions" TO "anon";
GRANT ALL ON TABLE "public"."role_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."role_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."roles" TO "anon";
GRANT ALL ON TABLE "public"."roles" TO "authenticated";
GRANT ALL ON TABLE "public"."roles" TO "service_role";



GRANT ALL ON TABLE "public"."sms_logs" TO "anon";
GRANT ALL ON TABLE "public"."sms_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."sms_logs" TO "service_role";



GRANT ALL ON TABLE "public"."subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."system_audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."system_audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."system_audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."system_global_configs" TO "anon";
GRANT ALL ON TABLE "public"."system_global_configs" TO "authenticated";
GRANT ALL ON TABLE "public"."system_global_configs" TO "service_role";



GRANT ALL ON TABLE "public"."user_funeral_access" TO "anon";
GRANT ALL ON TABLE "public"."user_funeral_access" TO "authenticated";
GRANT ALL ON TABLE "public"."user_funeral_access" TO "service_role";



GRANT ALL ON TABLE "public"."user_sessions" TO "anon";
GRANT ALL ON TABLE "public"."user_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."voided_transactions" TO "anon";
GRANT ALL ON TABLE "public"."voided_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."voided_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."valid_transactions" TO "anon";
GRANT ALL ON TABLE "public"."valid_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."valid_transactions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."voided_transactions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."voided_transactions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."voided_transactions_id_seq" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";



































drop extension if exists "pg_net";

create extension if not exists "pg_net" with schema "public";

drop policy "allow insert institutions" on "public"."institutions";

drop policy "dev insert institutions" on "public"."institutions";

drop policy "insert institutions" on "public"."institutions";

drop policy "select institutions" on "public"."institutions";

drop policy "dev insert users" on "public"."users";

drop policy "insert users" on "public"."users";

drop policy "select users" on "public"."users";

alter table "public"."platform_token_transactions" drop constraint "check_token_type";

alter table "public"."platform_token_transactions" drop constraint "check_tx_type";

alter table "public"."platform_token_transactions" add constraint "check_token_type" CHECK (((token_type)::text = ANY ((ARRAY['LOCAL'::character varying, 'DIASPORA'::character varying])::text[]))) not valid;

alter table "public"."platform_token_transactions" validate constraint "check_token_type";

alter table "public"."platform_token_transactions" add constraint "check_tx_type" CHECK (((transaction_type)::text = ANY ((ARRAY['DEPOSIT'::character varying, 'CONSUMPTION'::character varying])::text[]))) not valid;

alter table "public"."platform_token_transactions" validate constraint "check_tx_type";


  create policy "allow insert institutions"
  on "public"."institutions"
  as permissive
  for insert
  to anon, authenticated
with check (true);



  create policy "dev insert institutions"
  on "public"."institutions"
  as permissive
  for insert
  to anon, authenticated
with check (true);



  create policy "insert institutions"
  on "public"."institutions"
  as permissive
  for insert
  to anon, authenticated
with check (true);



  create policy "select institutions"
  on "public"."institutions"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "dev insert users"
  on "public"."users"
  as permissive
  for insert
  to anon, authenticated
with check (true);



  create policy "insert users"
  on "public"."users"
  as permissive
  for insert
  to anon, authenticated
with check (true);



  create policy "select users"
  on "public"."users"
  as permissive
  for select
  to anon, authenticated
using (true);



  create policy "Enable read access for all users"
  on "storage"."buckets"
  as permissive
  for select
  to public
using (true);



  create policy "Allow authenticated inserts on deceased images"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check ((bucket_id = 'deceased-logos'::text));



  create policy "Allow authenticated uploads"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check ((bucket_id = 'institution-logos'::text));



  create policy "Allow authenticated users to upload deceased logos"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check ((bucket_id = 'deceased-logos'::text));



  create policy "Allow authenticated users to upload logos"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check ((bucket_id = 'institution-logos'::text));



  create policy "Allow public read access to institution logos"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'institution-logos'::text));



  create policy "Allow public read"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'institution-logos'::text));



  create policy "Allow public select on deceased images"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'deceased-logos'::text));



  create policy "Enable users to view their own data only"
  on "storage"."objects"
  as permissive
  for all
  to authenticated;



  create policy "Give access to a folder d6twnj_0"
  on "storage"."objects"
  as permissive
  for select
  to public
using (((bucket_id = 'deceased-logos'::text) AND ((storage.foldername(name))[1] = 'admin'::text) AND ((storage.foldername(name))[2] = 'assets'::text) AND (( SELECT (auth.uid())::text AS uid) = 'd7bed83c-44a0-4a4f-925f-efc384ea1e50'::text)));



  create policy "Give access to a folder d6twnj_1"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (((bucket_id = 'deceased-logos'::text) AND ((storage.foldername(name))[1] = 'admin'::text) AND ((storage.foldername(name))[2] = 'assets'::text) AND (( SELECT (auth.uid())::text AS uid) = 'd7bed83c-44a0-4a4f-925f-efc384ea1e50'::text)));



  create policy "Give access to a folder d6twnj_2"
  on "storage"."objects"
  as permissive
  for update
  to public
using (((bucket_id = 'deceased-logos'::text) AND ((storage.foldername(name))[1] = 'admin'::text) AND ((storage.foldername(name))[2] = 'assets'::text) AND (( SELECT (auth.uid())::text AS uid) = 'd7bed83c-44a0-4a4f-925f-efc384ea1e50'::text)));



  create policy "allow public read"
  on "storage"."objects"
  as permissive
  for select
  to anon
using ((bucket_id = 'institution-logos'::text));



  create policy "allow public uploads"
  on "storage"."objects"
  as permissive
  for insert
  to anon
with check ((bucket_id = 'institution-logos'::text));



  create policy "dev upload logos"
  on "storage"."objects"
  as permissive
  for insert
  to anon, authenticated
with check ((bucket_id = 'institution-logos'::text));



  create policy "public read logos"
  on "storage"."objects"
  as permissive
  for select
  to anon, authenticated
using ((bucket_id = 'institution-logos'::text));



