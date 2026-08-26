import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return reply(405, { success: false, message: 'Method not allowed.' });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) return reply(500, { success: false, message: 'Server configuration is incomplete.' });
    const adminClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    const body = await request.json();
    const institutionName = String(body?.institutionName || '').trim();
    const username = String(body?.username || '').trim().toLowerCase();
    const password = String(body?.password || '');
    const phone = String(body?.phone || '').trim() || null;
    const location = String(body?.location || '').trim() || null;
    const logoUrl = String(body?.logoUrl || '').trim() || null;

    if (!institutionName) return reply(400, { success: false, message: 'Institution name is required.' });
    if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)) return reply(400, { success: false, message: 'Username must be 3–32 characters using letters, numbers, dot, underscore, or hyphen.' });
    if (password.length < 8) return reply(400, { success: false, message: 'Password must be at least 8 characters.' });

    const internalEmail = `${username}@users.legacycloud.local`;
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: internalEmail,
      password,
      email_confirm: true,
      user_metadata: { username, full_name: institutionName },
    });
    if (authError || !authData.user) return reply(400, { success: false, message: authError?.message?.includes('registered') ? 'Username already exists.' : (authError?.message || 'Unable to create account.') });

    const authUserId = authData.user.id;
    try {
      const { error: registrationError } = await adminClient.rpc('funeralmis_register_username_institution', {
        p_auth_user_id: authUserId,
        p_institution_name: institutionName,
        p_username: username,
        p_internal_email: internalEmail,
        p_phone: phone,
        p_location: location,
        p_logo_url: logoUrl,
      });
      if (registrationError) throw registrationError;

      return reply(200, { success: true, username, message: 'Institution created successfully. Your 14-day trial is active.' });
    } catch (databaseError) {
      await adminClient.auth.admin.deleteUser(authUserId);
      throw databaseError;
    }
  } catch (error) {
    console.error('register-institution:', error);
    return reply(400, { success: false, message: error?.message?.includes('duplicate') ? 'Username already exists.' : (error.message || 'Unable to register institution.') });
  }
});
