import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const reply = (status: number, body: Record<string, unknown>) => new Response(
  JSON.stringify(body),
  { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
);

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return reply(405, { success: false, message: 'Method not allowed.' });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !anonKey || !serviceRoleKey) return reply(500, { success: false, message: 'Server configuration is incomplete.' });

    const body = await request.json();
    const username = String(body?.username || '').trim().toLowerCase();
    const password = String(body?.password || '');
    if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username) || !password) {
      return reply(401, { success: false, message: 'Invalid username or password.' });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: profile } = await adminClient
      .from('users')
      .select('id, email, status')
      .eq('username', username)
      .maybeSingle();

    // Keep the same response for missing, inactive, and invalid accounts.
    if (!profile?.email || profile.status !== 'active') {
      return reply(401, { success: false, message: 'Invalid username or password.' });
    }

    const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await authClient.auth.signInWithPassword({ email: profile.email, password });
    if (error || !data.session) return reply(401, { success: false, message: 'Invalid username or password.' });

    await adminClient.from('users').update({ last_login: new Date().toISOString() }).eq('id', profile.id);

    return reply(200, {
      success: true,
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
  } catch (error) {
    console.error('username-login:', error);
    return reply(500, { success: false, message: 'Unable to complete login.' });
  }
});

