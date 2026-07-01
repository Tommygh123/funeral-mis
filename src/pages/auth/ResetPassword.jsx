import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase';

function ResetPassword() {
  const navigate = useNavigate();

  // State for Requesting Reset
  const [email, setEmail] = useState('');
  
  // State for Updating Password
  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);

  // =========================
  // DETECT RECOVERY SESSION
  // =========================
  useEffect(() => {
    // Check if we are in recovery mode (user clicked email link)
    const { data: sessionData } = supabase.auth.getSession();
    
    // Check if the URL contains the access_token/hash for recovery
    if (window.location.hash.includes('type=recovery') || window.location.hash.includes('access_token')) {
      setIsRecovery(true);
    }

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // =========================
  // REQUEST RESET EMAIL
  // =========================
  const handleRequestReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      alert("Check your email for the reset link!");
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // UPDATE PASSWORD
  // =========================
  const handleUpdatePassword = async () => {
    try {
      setLoading(true);
      if (form.password !== form.confirmPassword) throw new Error("Passwords do not match");
      if (form.password.length < 6) throw new Error("Password must be at least 6 characters");

      const { error } = await supabase.auth.updateUser({ password: form.password });
      if (error) throw error;

      alert("Password updated successfully!");
      navigate('/login');
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page" style={{ background: '#f5f7fb', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="auth-card" style={{ width: '100%', maxWidth: 420, padding: 20, background: '#fff', borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
        
        <h1>{isRecovery ? 'Set New Password' : 'Reset Password'}</h1>

        {!isRecovery ? (
          /* FORM TO REQUEST EMAIL */
          <form onSubmit={handleRequestReset}>
            <p>Enter your email to receive a reset link.</p>
            <input
              type="email"
              placeholder="Email address"
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ width: '100%', padding: 12, marginBottom: 15, boxSizing: 'border-box' }}
            />
            <button disabled={loading} style={{ width: '100%', padding: 14, background: '#2563eb', color: 'white', border: 'none', cursor: 'pointer' }}>
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        ) : (
          /* FORM TO UPDATE PASSWORD */
          <div>
            <input
              type="password"
              placeholder="New Password"
              onChange={(e) => setForm({...form, password: e.target.value})}
              style={{ width: '100%', padding: 12, marginBottom: 15, boxSizing: 'border-box' }}
            />
            <input
              type="password"
              placeholder="Confirm Password"
              onChange={(e) => setForm({...form, confirmPassword: e.target.value})}
              style={{ width: '100%', padding: 12, marginBottom: 20, boxSizing: 'border-box' }}
            />
            <button onClick={handleUpdatePassword} disabled={loading} style={{ width: '100%', padding: 14, background: '#2563eb', color: 'white', border: 'none', cursor: 'pointer' }}>
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        )}

        <p style={{ marginTop: 15, textAlign: 'center' }}>
          <span style={{ color: '#2563eb', cursor: 'pointer' }} onClick={() => navigate('/login')}>
            Back to Login
          </span>
        </p>
      </div>
    </div>
  );
}

export default ResetPassword;