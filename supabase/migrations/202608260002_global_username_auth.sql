-- FuneralMIS: globally unique username support for Supabase Auth profiles.
-- Existing passwords and auth.users identities are not changed.

create schema if not exists extensions;
create extension if not exists citext with schema extensions;

alter table public.users
  add column if not exists username extensions.citext;

with normalized as (
  select
    id,
    case
      when char_length(regexp_replace(lower(coalesce(split_part(email, '@', 1), '')), '[^a-z0-9._-]', '', 'g')) >= 1
        then 'u_' || regexp_replace(lower(split_part(email, '@', 1)), '[^a-z0-9._-]', '', 'g')
      else 'user_' || left(replace(id::text, '-', ''), 8)
    end as base_username,
    created_at
  from public.users
  where username is null
), ranked as (
  select
    id,
    base_username,
    row_number() over (partition by base_username order by created_at nulls last, id) as duplicate_number
  from normalized
)
update public.users u
set username = case
  when r.duplicate_number = 1 then left(r.base_username, 32)
  else left(r.base_username, 27) || '_' || r.duplicate_number::text
end
from ranked r
where u.id = r.id;

alter table public.users
  alter column username set not null;

create unique index if not exists users_username_unique
  on public.users (username);

alter table public.users
  drop constraint if exists users_username_format_check;

alter table public.users
  add constraint users_username_format_check
  check (username::text ~ '^[a-z0-9][a-z0-9._-]{2,31}$');

comment on column public.users.username
is 'Globally unique, case-insensitive login name. Supabase Auth continues to authenticate the underlying email identifier.';

create or replace function public.funeralmis_register_username_institution(
  p_auth_user_id uuid,
  p_institution_name text,
  p_username text,
  p_internal_email text,
  p_phone text,
  p_location text,
  p_logo_url text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $function$
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
$function$;

revoke all on function public.funeralmis_register_username_institution(uuid, text, text, text, text, text, text) from public;
revoke all on function public.funeralmis_register_username_institution(uuid, text, text, text, text, text, text) from anon;
revoke all on function public.funeralmis_register_username_institution(uuid, text, text, text, text, text, text) from authenticated;
grant execute on function public.funeralmis_register_username_institution(uuid, text, text, text, text, text, text) to service_role;
