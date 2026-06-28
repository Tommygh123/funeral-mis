import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase';

function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleLogin = async () => {
    if (!form.email || !form.password) {
      alert("Please enter email and password");
      return;
    }

    setLoading(true);

    try {
      // 1. AUTH LOGIN
      const { data, error } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password
      });

      if (error) throw error;

      const userId = data.user.id;

      // 2. GET USER PROFILE (ROLE ID, INSTITUTION, AND STATUS)
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('role_id, institution_id, status')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;

      // 3. STATUS GUARD: Deny access if account is inactive
      if (profile.status !== 'active') {
        await supabase.auth.signOut();
        alert("Access Denied: This account has been deactivated. Please contact your administrator.");
        return;
      }

      // 4. GET ROLE NAME
      const { data: role, error: roleError } = await supabase
        .from('roles')
        .select('name')
        .eq('id', profile.role_id)
        .single();

      if (roleError) throw roleError;

      // 5. DYNAMIC REDIRECT MATRIX
      const activeRole = String(role.name).toUpperCase();

      switch (activeRole) {
        case 'SUPERADMIN':
          navigate('/superadmin');
          break;
        case 'ADMIN':
          navigate('/admin');
          break;
        case 'SUPERVISOR':
          navigate('/supervisor');
          break;
        case 'CASHIER':
          navigate('/cashier');
          break;
        case 'VIEWER':
          navigate('/viewer');
          break;
        case 'FUNERALHEAD':
          navigate('/funeralhead');
          break;
        default:
          navigate('/');
          break;
      }

    } catch (err) {
      console.error("❌ LOGIN ERROR:", err.message);
      alert("Invalid login credentials or system access denied.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!form.email) {
      alert("Enter your email first");
      return;
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(form.email, {
        redirectTo: 'http://localhost:3000/reset-password'
      });
      if (error) throw error;
      alert("Password reset email sent");
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#f5f7fb', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ background: 'white', padding: '40px', borderRadius: '10px', width: '350px', boxShadow: '0 0 10px rgba(0,0,0,0.1)' }}>
        <h2 style={{ textAlign: 'center', margin: '0 0 24px 0', color: '#0f172a' }}>LegacyCloud Login</h2>
        
        <input name="email" type="email" placeholder="Email" value={form.email} onChange={handleChange} style={inputStyle} />
        <input name="password" type="password" placeholder="Password" value={form.password} onChange={handleChange} style={inputStyle} />

        <button onClick={handleLogin} disabled={loading} style={buttonStyle}>
          {loading ? 'Logging in...' : 'Login'}
        </button>

        <p onClick={handleForgotPassword} style={linkStyle}>Forgot Password?</p>
      </div>
    </div>
  );
}

const inputStyle = { width: '100%', padding: '12px', marginBottom: '15px', boxSizing: 'border-box', borderRadius: '6px', border: '1px solid #cbd5e1' };
const buttonStyle = { width: '100%', padding: '14px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '15px' };
const linkStyle = { marginTop: '15px', textAlign: 'center', color: '#2563eb', cursor: 'pointer', fontSize: '14px' };

export default Login;