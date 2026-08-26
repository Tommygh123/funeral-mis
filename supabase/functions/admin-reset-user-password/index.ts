import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const response = (status: number, body: Record<string, unknown>) => new Response(
  JSON.stringify(body),
  { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
);

const getRoleName = (roles: unknown) => {
  const relation = Array.isArray(roles) ? roles[0] : roles;
  return String((relation as { name?: string } | null)?.name || '').toUpperCase();
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return response(405, { success: false, message: 'Method not allowed.' });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const authorization = request.headers.get('Authorization');

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return response(500, { success: false, message: 'Server configuration is incomplete.' });
    }
    if (!authorization) return response(401, { success: false, message: 'Authentication required.' });

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !caller) return response(401, { success: false, message: 'Invalid or expired session.' });

    const body = await request.json();
    const targetUserId = String(body?.targetUserId || '');
    const newPassword = String(body?.newPassword || '');

    if (!targetUserId) return response(400, { success: false, message: 'Target user is required.' });
    if (newPassword.length < 8) return response(400, { success: false, message: 'Password must be at least 8 characters.' });
    if (targetUserId === caller.id) return response(403, { success: false, message: 'You cannot reset your own password from User Management.' });

    const { data: callerProfile, error: callerProfileError } = await adminClient
      .from('users')
      .select('id, email, institution_id, status, roles(name)')
      .eq('id', caller.id)
      .single();
    if (callerProfileError || !callerProfile) return response(403, { success: false, message: 'Operator profile not found.' });

    const callerRole = getRoleName(callerProfile.roles);
    if (callerRole !== 'ADMIN' || callerProfile.status !== 'active') {
      return response(403, { success: false, message: 'Only an active institution ADMIN can reset staff passwords.' });
    }

    const { data: target, error: targetError } = await adminClient
      .from('users')
      .select('id, username, email, full_name, institution_id, status, roles(name)')
      .eq('id', targetUserId)
      .single();
    if (targetError || !target) return response(404, { success: false, message: 'Target user not found.' });

    const targetRole = getRoleName(target.roles);
    if (!callerProfile.institution_id || target.institution_id !== callerProfile.institution_id) {
      return response(403, { success: false, message: 'You can reset passwords only within your institution.' });
    }
    if (targetRole === 'ADMIN' || targetRole === 'SUPERADMIN') {
      return response(403, { success: false, message: 'ADMIN and SUPERADMIN passwords cannot be reset here.' });
    }

    const { error: resetError } = await adminClient.auth.admin.updateUserById(targetUserId, {
      password: newPassword,
    });
    if (resetError) throw resetError;

    await adminClient.from('system_audit_logs').insert({
      admin_email: caller.email || callerProfile.email,
      action: 'ADMIN_PASSWORD_RESET',
      target_id: targetUserId,
      details: {
        institution_id: callerProfile.institution_id,
        target_email: target.email,
        target_username: target.username,
        target_name: target.full_name,
        target_role: targetRole,
        actor_user_id: caller.id,
      },
    });

    return response(200, {
      success: true,
      message: `Password reset successfully for ${target.full_name || target.email}.`,
    });
  } catch (error) {
    console.error('admin-reset-user-password:', error);
    return response(500, { success: false, message: error.message || 'Unable to reset password.' });
  }
});
