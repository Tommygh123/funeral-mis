import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase';
import { useToast } from '../../components/ui/ToastProvider';

function Login() {
  const navigate = useNavigate();
  const notifications = useToast();
  const [form, setForm] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleLogin = async (event) => {
    event.preventDefault();
    const username = form.username.trim().toLowerCase();
    if (!username || !form.password) return notifications.warning('Please enter username and password.');

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('username-login', {
        body: { username, password: form.password },
      });
      if (error) throw error;
      if (!data?.success || !data.access_token || !data.refresh_token) throw new Error(data?.message || 'Invalid username or password.');

      const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      if (sessionError || !sessionData.user) throw sessionError || new Error('Unable to start session.');

      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('status, roles(name)')
        .eq('id', sessionData.user.id)
        .single();
      if (profileError) throw profileError;
      if (profile.status !== 'active') {
        await supabase.auth.signOut();
        throw new Error('Account access is disabled. Contact your institution administrator.');
      }

      const roleRelation = Array.isArray(profile.roles) ? profile.roles[0] : profile.roles;
      const role = String(roleRelation?.name || '').toUpperCase();
      const routes = {
        SUPERADMIN: '/superadmin', ADMIN: '/admin', SUPERVISOR: '/supervisor',
        CASHIER: '/cashier', VIEWER: '/viewer', FUNERALHEAD: '/funeralhead', FAMILYHEAD: '/funeralhead',
      };
      navigate(routes[role] || '/', { replace: true });
    } catch (error) {
      console.error('LOGIN ERROR:', error);
      notifications.error('Invalid username or password, or account access is disabled.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page" style={{ background: '#f5f7fb', fontFamily: 'Arial, sans-serif' }}>
      <form className="auth-card" onSubmit={handleLogin}>
        <h2 style={{ textAlign: 'center', margin: '0 0 24px', color: '#0f172a' }}>LegacyCloud Login</h2>
        <input name="username" type="text" autoComplete="username" placeholder="Username" value={form.username}
          onChange={(event) => setForm({ ...form, username: event.target.value })} style={inputStyle} />
        <input name="password" type="password" autoComplete="current-password" placeholder="Password" value={form.password}
          onChange={(event) => setForm({ ...form, password: event.target.value })} style={inputStyle} />
        <button type="submit" disabled={loading} style={buttonStyle}>{loading ? 'Logging in...' : 'Login'}</button>
        <p style={{ marginTop: 15, textAlign: 'center', color: '#64748b', fontSize: 13 }}>
          Contact your institution administrator if your password must be reset.
        </p>
      </form>
    </div>
  );
}

const inputStyle = { width: '100%', padding: 12, marginBottom: 15, boxSizing: 'border-box', borderRadius: 6, border: '1px solid #cbd5e1' };
const buttonStyle = { width: '100%', padding: 14, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 15 };

export default Login;
