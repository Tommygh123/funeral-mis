-- FuneralMIS: protected complimentary subscription extension
-- Safe to run once through Supabase migrations or SQL Editor.

create or replace function public.funeralmis_extend_subscription(
  p_institution_id uuid,
  p_days integer,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $function$
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
$function$;

revoke all on function public.funeralmis_extend_subscription(uuid, integer, text) from public;
revoke all on function public.funeralmis_extend_subscription(uuid, integer, text) from anon;
grant execute on function public.funeralmis_extend_subscription(uuid, integer, text) to authenticated;

comment on function public.funeralmis_extend_subscription(uuid, integer, text)
is 'SUPERADMIN-only complimentary extension. Synchronizes subscriptions and institutions and writes an audit record.';

