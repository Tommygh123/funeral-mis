import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const reply = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const roleName = (roles: unknown) => { const r = Array.isArray(roles) ? roles[0] : roles; return String((r as { name?: string } | null)?.name || '').toUpperCase(); };

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return reply(405, { success: false, message: 'Method not allowed.' });
  try {
    const url = Deno.env.get('SUPABASE_URL'); const anon = Deno.env.get('SUPABASE_ANON_KEY'); const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'); const authorization = request.headers.get('Authorization');
    if (!url || !anon || !service) return reply(500, { success: false, message: 'Server configuration is incomplete.' });
    if (!authorization) return reply(401, { success: false, message: 'Authentication required.' });
    const callerClient = createClient(url, anon, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return reply(401, { success: false, message: 'Invalid or expired session.' });
    const { data: operator } = await admin.from('users').select('id,email,institution_id,status,roles(name)').eq('id', caller.id).single();
    if (!operator || operator.status !== 'active' || roleName(operator.roles) !== 'ADMIN' || !operator.institution_id) return reply(403, { success: false, message: 'Only an active institution ADMIN can manage staff users.' });

    const body = await request.json(); const action = String(body?.action || ''); const targetUserId = String(body?.targetUserId || '');
    if (!targetUserId) return reply(400, { success: false, message: 'Target user is required.' });
    if (targetUserId === caller.id) return reply(403, { success: false, message: 'Use account settings to manage your own administrator account.' });
    const { data: target } = await admin.from('users').select('id,email,full_name,institution_id,status,role_id,roles(name)').eq('id', targetUserId).single();
    if (!target) return reply(404, { success: false, message: 'User not found.' });
    if (target.institution_id !== operator.institution_id) return reply(403, { success: false, message: 'You can manage only users in your institution.' });
    if (['ADMIN','SUPERADMIN'].includes(roleName(target.roles))) return reply(403, { success: false, message: 'Administrator accounts are protected.' });

    if (action === 'delete') {
      const { error: profileError } = await admin.from('users').delete().eq('id', targetUserId).eq('institution_id', operator.institution_id);
      if (profileError) throw profileError;
      const { error: authError } = await admin.auth.admin.deleteUser(targetUserId);
      if (authError) throw authError;
      await admin.from('system_audit_logs').insert({ admin_email: caller.email || operator.email, action: 'ADMIN_DELETED_USER', target_id: targetUserId, details: { institution_id: operator.institution_id, target_email: target.email, target_name: target.full_name, actor_user_id: caller.id } });
      return reply(200, { success: true, message: `${target.full_name || target.email} deleted successfully.` });
    }

    if (action === 'status') {
      const status = String(body?.status || ''); if (!['active','inactive'].includes(status)) return reply(400, { success: false, message: 'Invalid status.' });
      const { error } = await admin.from('users').update({ status }).eq('id', targetUserId).eq('institution_id', operator.institution_id); if (error) throw error;
      return reply(200, { success: true, message: 'User status updated.' });
    }

    if (action === 'update') {
      const fullName = String(body?.fullName || '').trim(); const email = String(body?.email || '').trim().toLowerCase(); const phone = String(body?.phone || '').trim() || null; const roleId = String(body?.roleId || ''); const status = String(body?.status || 'active');
      if (!fullName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !roleId) return reply(400, { success: false, message: 'Full name, valid email and role are required.' });
      if (!['active','inactive'].includes(status)) return reply(400, { success: false, message: 'Invalid status.' });
      const { data: requestedRole } = await admin.from('roles').select('id,name').eq('id', roleId).single();
      if (!requestedRole || ['ADMIN','SUPERADMIN'].includes(String(requestedRole.name).toUpperCase())) return reply(403, { success: false, message: 'This role cannot be assigned here.' });
      if (email !== String(target.email || '').toLowerCase()) { const { error } = await admin.auth.admin.updateUserById(targetUserId, { email, email_confirm: true }); if (error) throw error; }
      const { error } = await admin.from('users').update({ full_name: fullName, email, phone, role_id: roleId, status }).eq('id', targetUserId).eq('institution_id', operator.institution_id); if (error) throw error;
      await admin.from('system_audit_logs').insert({ admin_email: caller.email || operator.email, action: 'ADMIN_UPDATED_USER', target_id: targetUserId, details: { institution_id: operator.institution_id, email, full_name: fullName, role: requestedRole.name, status, actor_user_id: caller.id } });
      return reply(200, { success: true, message: 'User updated successfully.' });
    }
    return reply(400, { success: false, message: 'Unsupported user-management action.' });
  } catch (error) { console.error('admin-manage-user:', error); return reply(400, { success: false, message: error?.message || 'Unable to manage user.' }); }
});
