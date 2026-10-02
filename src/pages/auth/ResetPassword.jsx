import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase';
import { useToast } from '../../components/ui/ToastProvider';
import PasswordInput from '../../components/ui/PasswordInput';

function ResetPassword() {
  const navigate = useNavigate();
  const notifications = useToast();

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
  // UPDATE PASSWORD
  // =========================
  const handleUpdatePassword = async () => {
    try {
      setLoading(true);
      if (form.password !== form.confirmPassword) throw new Error("Passwords do not match");
      if (form.password.length < 6) throw new Error("Password must be at least 6 characters");

      const { error } = await supabase.auth.updateUser({ password: form.password });
      if (error) throw error;

      notifications.success('Password updated successfully. You can now log in.');
      navigate('/login');
    } catch (err) {
      notifications.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page" style={{ background: '#f5f7fb', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="auth-card" style={{ width: '100%', maxWidth: 420, padding: 20, background: '#fff', borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
        
        <h1>{isRecovery ? 'Set New Password' : 'Reset Password'}</h1>

        {!isRecovery ? (
          <div>
            <p>This reset link is missing, invalid, or expired.</p>
            <button onClick={() => navigate('/forgot-password')} style={{ width: '100%', padding: 14, background: '#2563eb', color: 'white', border: 'none', cursor: 'pointer' }}>Request a New Reset Link</button>
          </div>
        ) : (
          /* FORM TO UPDATE PASSWORD */
          <div>
            <PasswordInput
              placeholder="New Password"
              onChange={(e) => setForm({...form, password: e.target.value})}
              style={{ width: '100%', padding: 12, marginBottom: 15, boxSizing: 'border-box' }}
            />
            <PasswordInput
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