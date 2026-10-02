import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase';
import { useToast } from '../../components/ui/ToastProvider';
import PasswordInput from '../../components/ui/PasswordInput';

function Login() {
  const navigate = useNavigate();
  const notifications = useToast();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleLogin = async (event) => {
    event.preventDefault();
    const email = form.email.trim().toLowerCase();
    if (!email || !form.password) return notifications.warning('Please enter email and password.');

    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password: form.password,
      });
      if (authError || !authData?.user) throw authError || new Error('Invalid email or password.');

      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('status, roles(name)')
        .eq('id', authData.user.id)
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
      notifications.error(error?.message || 'Invalid email or password, or account access is disabled.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page" style={{ background: '#f5f7fb', fontFamily: 'Arial, sans-serif' }}>
      <form className="auth-card" onSubmit={handleLogin}>
        <h2 style={{ textAlign: 'center', margin: '0 0 24px', color: '#0f172a' }}>LegacyCloud Login</h2>
        <input name="email" type="email" autoComplete="email" placeholder="Email address" value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })} style={inputStyle} />
        <PasswordInput name="password" autoComplete="current-password" placeholder="Password" value={form.password}
          onChange={(event) => setForm({ ...form, password: event.target.value })} style={inputStyle} wrapperStyle={{ marginBottom: 15 }} />
        <button type="submit" disabled={loading} style={buttonStyle}>{loading ? 'Logging in...' : 'Login'}</button>
        <button type="button" onClick={() => navigate('/forgot-password')} style={linkButton}>Forgot password?</button>
        <p style={{ marginTop: 14, textAlign: 'center', color: '#64748b', fontSize: 13 }}>
          New institution? <span onClick={() => navigate('/get-started')} style={{ color: '#2563eb', cursor: 'pointer', fontWeight: 600 }}>Get Started</span>
        </p>
      </form>
    </div>
  );
}

const inputStyle = { width: '100%', padding: 12, marginBottom: 15, boxSizing: 'border-box', borderRadius: 6, border: '1px solid #cbd5e1' };
const linkButton = { display: 'block', width: '100%', border: 0, background: 'transparent', color: '#2563eb', cursor: 'pointer', fontWeight: 600, textAlign: 'center' };
const buttonStyle = { width: '100%', padding: 14, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 15 };

export default Login;
