import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase';
import { useToast } from '../../components/ui/ToastProvider';

function ForgotPassword() {
  const navigate = useNavigate();
  const notifications = useToast();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = async (event) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return notifications.warning('Enter your email address.');

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      notifications.success('Password reset link sent. Check your email inbox and spam folder.');
    } catch (error) {
      notifications.error(error.message || 'Unable to send password reset email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page" style={{ background: '#f5f7fb' }}>
      <form className="auth-card" onSubmit={handleReset} style={{ maxWidth: 420 }}>
        <h2 style={{ textAlign: 'center', margin: '0 0 10px', color: '#0f172a' }}>Forgot Password</h2>
        <p style={{ textAlign: 'center', color: '#64748b', marginBottom: 22 }}>Enter the email used for your account. We will send you a secure reset link.</p>
        <input type="email" autoComplete="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} required style={inputStyle} />
        <button type="submit" disabled={loading} style={buttonStyle}>{loading ? 'Sending...' : 'Send Reset Link'}</button>
        <button type="button" onClick={() => navigate('/login')} style={linkButton}>Back to Login</button>
      </form>
    </div>
  );
}

const inputStyle = { width: '100%', padding: 12, marginBottom: 15, boxSizing: 'border-box', borderRadius: 6, border: '1px solid #cbd5e1' };
const buttonStyle = { width: '100%', padding: 14, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 };
const linkButton = { display: 'block', width: '100%', marginTop: 14, border: 0, background: 'transparent', color: '#2563eb', cursor: 'pointer', fontWeight: 600 };

export default ForgotPassword;
