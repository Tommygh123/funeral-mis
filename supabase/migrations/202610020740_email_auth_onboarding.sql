-- Complete transition from legacy username login to real email authentication.
-- Existing username values are preserved, but new accounts no longer require a username.

alter table public.users drop constraint if exists users_username_format_check;
alter table public.users alter column username drop not null;
drop index if exists public.users_username_unique;
comment on column public.users.username is 'Legacy field retained for existing records. New authentication uses Supabase Auth email.';

create or replace function public.funeralmis_register_email_institution(
  p_auth_user_id uuid,
  p_institution_name text,
  p_admin_full_name text,
  p_email text,
  p_phone text default null,
  p_location text default null,
  p_logo_url text default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  v_admin_role_id uuid;
  v_institution_id uuid;
  v_expiry timestamptz := now() + interval '14 days';
begin
  if p_auth_user_id is null then raise exception 'Auth user ID is required.'; end if;
  if nullif(btrim(p_institution_name), '') is null then raise exception 'Institution name is required.'; end if;
  if nullif(btrim(p_admin_full_name), '') is null then raise exception 'Administrator full name is required.'; end if;
  if nullif(btrim(p_email), '') is null then raise exception 'Email address is required.'; end if;

  select id into v_admin_role_id from public.roles where upper(name) = 'ADMIN' limit 1;
  if v_admin_role_id is null then raise exception 'ADMIN role was not found.'; end if;

  insert into public.institutions (
    name, email, phone, location, logo_url, admin_user_id,
    subscription_plan, subscription_status, funeral_limit_per_month, subscription_end_date
  ) values (
    btrim(p_institution_name), lower(btrim(p_email)), nullif(btrim(p_phone), ''),
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
    id, institution_id, full_name, email, phone, role_id, status, auth_type
  ) values (
    p_auth_user_id, v_institution_id, btrim(p_admin_full_name), lower(btrim(p_email)),
    nullif(btrim(p_phone), ''), v_admin_role_id, 'active', 'password'
  );

  insert into public.system_audit_logs (admin_email, action, target_id, details)
  values (
    lower(btrim(p_email)), 'EMAIL_INSTITUTION_REGISTRATION', v_institution_id,
    jsonb_build_object('institution_name', btrim(p_institution_name), 'admin_full_name', btrim(p_admin_full_name),
      'email', lower(btrim(p_email)), 'trial_days', 14, 'actor_user_id', p_auth_user_id)
  );

  return jsonb_build_object('success', true, 'institution_id', v_institution_id,
    'admin_user_id', p_auth_user_id, 'email', lower(btrim(p_email)), 'expires_at', v_expiry);
end;
$function$;

revoke all on function public.funeralmis_register_email_institution(uuid,text,text,text,text,text,text) from public;
grant execute on function public.funeralmis_register_email_institution(uuid,text,text,text,text,text,text) to service_role;
