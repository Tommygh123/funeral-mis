import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const roleName = (roles: unknown) => {
  const relation = Array.isArray(roles) ? roles[0] : roles;
  return String((relation as { name?: string } | null)?.name || '').toUpperCase();
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return reply(405, { success: false, message: 'Method not allowed.' });

  let createdAuthUserId: string | null = null;
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const authorization = request.headers.get('Authorization');
    if (!supabaseUrl || !anonKey || !serviceKey) return reply(500, { success: false, message: 'Server configuration is incomplete.' });
    if (!authorization) return reply(401, { success: false, message: 'Authentication required.' });

    const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
    const adminClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return reply(401, { success: false, message: 'Invalid or expired session.' });

    const { data: operator } = await adminClient.from('users').select('id, email, institution_id, status, roles(name)').eq('id', caller.id).single();
    if (!operator || operator.status !== 'active' || roleName(operator.roles) !== 'ADMIN' || !operator.institution_id) {
      return reply(403, { success: false, message: 'Only an active institution ADMIN can create staff users.' });
    }

    const body = await request.json();
    const username = String(body?.username || '').trim().toLowerCase();
    const password = String(body?.password || '');
    const fullName = String(body?.fullName || '').trim();
    const phone = String(body?.phone || '').trim() || null;
    const roleId = String(body?.roleId || '');
    if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)) return reply(400, { success: false, message: 'Username must be 3–32 characters using letters, numbers, dot, underscore, or hyphen.' });
    if (password.length < 8) return reply(400, { success: false, message: 'Password must be at least 8 characters.' });
    if (!fullName || !roleId) return reply(400, { success: false, message: 'Full name and role are required.' });

    const { data: requestedRole } = await adminClient.from('roles').select('id, name').eq('id', roleId).single();
    const requestedRoleName = String(requestedRole?.name || '').toUpperCase();
    if (!requestedRole || ['ADMIN', 'SUPERADMIN'].includes(requestedRoleName)) return reply(403, { success: false, message: 'This role cannot be assigned by an institution ADMIN.' });

    const internalEmail = `${username}@users.legacycloud.local`;
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: internalEmail,
      password,
      email_confirm: true,
      user_metadata: { username, full_name: fullName },
    });
    if (authError || !authData.user) throw authError || new Error('Unable to create Auth user.');
    createdAuthUserId = authData.user.id;

    const { error: profileError } = await adminClient.from('users').insert({
      id: createdAuthUserId,
      institution_id: operator.institution_id,
      full_name: fullName,
      username,
      email: internalEmail,
      phone,
      role_id: roleId,
      status: 'active',
      auth_type: 'password',
    });
    if (profileError) {
      await adminClient.auth.admin.deleteUser(createdAuthUserId);
      createdAuthUserId = null;
      throw profileError;
    }

    await adminClient.from('system_audit_logs').insert({
      admin_email: caller.email || operator.email,
      action: 'ADMIN_CREATED_USERNAME_USER',
      target_id: createdAuthUserId,
      details: { institution_id: operator.institution_id, username, full_name: fullName, role: requestedRoleName, actor_user_id: caller.id },
    });

    return reply(200, { success: true, userId: createdAuthUserId, username, message: `User ${username} created successfully.` });
  } catch (error) {
    console.error('admin-create-user:', error);
    return reply(400, { success: false, message: error?.message?.includes('duplicate') ? 'Username already exists.' : (error.message || 'Unable to create user.') });
  }
});
