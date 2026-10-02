import { supabase } from '../supabase';
export const PLAN_KEYS = ['price_local_base','price_local_stream','price_business_volume','price_diaspora_base','price_diaspora_5_funeral','price_diaspora_stream','usd_to_ghs_rate'];
export function parsePlanSettings(rows) {
  const values = {};
  for (const row of rows || []) {
    const key = String(row.config_key || '').trim();
    const raw = String(row.config_value ?? '').trim();
    const value = raw === '' ? NaN : Number(raw);
    if (PLAN_KEYS.includes(key) && Number.isFinite(value) && value > 0) values[key] = value;
  }
  return values;
}
export async function loadPlanSettings() {
  const {data,error} = await supabase.rpc('legacycloud_public_plan_settings');
  if (error) throw new Error('Unable to load saved plan prices. Please retry.');
  const values = parsePlanSettings(data);
  if (['price_local_base','price_business_volume','price_diaspora_base','price_diaspora_5_funeral','usd_to_ghs_rate'].some(key => !values[key])) {
    throw new Error('Plan prices are unavailable. Ask the SuperAdmin to check and commit the Global Configuration.');
  }
  return values;
}
const marketFrom = value => {
  const key = String(value || '').toLowerCase();
  if (key === 'diaspora' || key === 'international' || key.startsWith('diaspora')) return false;
  if (key === 'local' || key.startsWith('local') || key === 'business' || key === 'premium_local') return true;
  return null;
};
export async function resolvePlanAudience(countryHint) {
  const {data:{user},error} = await supabase.auth.getUser();
  if (error && error.name !== 'AuthSessionMissingError') throw new Error('Unable to check your account. Please retry.');
  let institutionId = null, isSuperAdmin = false, isGhana = null;
  if (user) {
    const {data:profile,error:profileError} = await supabase.from('users').select('*').eq('id',user.id).maybeSingle();
    if (profileError) throw new Error('Unable to check your account market. Please retry.');
    institutionId = profile?.institution_id || null;
    if(profile?.role_id) {
      const {data:role,error:roleError}=await supabase.from('roles').select('name').eq('id',profile.role_id).maybeSingle();
      if(roleError) throw new Error('Unable to check your account role. Please retry.');
      isSuperAdmin=String(role?.name || '').trim().toUpperCase()==='SUPERADMIN';
    }
    if (institutionId) {
      const {data:subs,error:subError} = await supabase.from('subscriptions').select('billing_market,plan_name').eq('institution_id',institutionId).order('created_at',{ascending:false}).limit(20);
      if (subError) throw new Error('Unable to check your subscription market. Please retry.');
      const prior = (subs || []).find(s => s.plan_name !== 'free_trial' && (marketFrom(s.plan_name) !== null || marketFrom(s.billing_market) !== null));
      if (prior) isGhana = marketFrom(prior.plan_name) ?? marketFrom(prior.billing_market);
    }
    if (isGhana === null) isGhana = marketFrom(profile?.billing_market || user.user_metadata?.billing_market);
    const country = profile?.country_code || user.user_metadata?.country_code;
    if (isGhana === null && country) isGhana = String(country).toUpperCase() === 'GH';
  }
  if (isGhana === null && countryHint) isGhana = String(countryHint).toUpperCase() === 'GH';
  if (isGhana === null && !isSuperAdmin) {
    const response = await fetch('https://ipapi.co/json/',{signal:AbortSignal.timeout(8000)});
    const geo = await response.json();
    if (!response.ok || !geo.country_code) throw new Error('Unable to identify your market. Please retry.');
    isGhana = geo.country_code === 'GH';
  }
  return {institutionId,userEmail:user?.email || '',isSuperAdmin,isGhana:isGhana ?? true};
}
export async function fetchUsdGhsRate() {
  const response = await fetch('https://open.er-api.com/v6/latest/USD',{signal:AbortSignal.timeout(10000)});
  if (!response.ok) throw new Error('Currency rate service is unavailable.');
  const data = await response.json();
  const rate = Number(data.rates?.GHS);
  if (data.result !== 'success' || data.base_code !== 'USD' || !Number.isFinite(rate) || rate <= 0 || !data.time_last_update_unix) throw new Error('Currency service returned an invalid rate.');
  if (Date.now()/1000 - data.time_last_update_unix > 3*86400) throw new Error('Currency service returned an outdated rate.');
  return {rate,updatedAt:new Date(data.time_last_update_unix*1000).toLocaleString()};
}
