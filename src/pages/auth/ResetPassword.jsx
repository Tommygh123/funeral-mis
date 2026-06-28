import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase';

function ResetPassword() {

  const navigate = useNavigate();

  const [form, setForm] = useState({
    password: '',
    confirmPassword: ''
  });

  const [loading, setLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);

  // =========================
  // DETECT RECOVERY SESSION
  // =========================
  useEffect(() => {

    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {

        console.log("AUTH EVENT:", event);

        if (event === 'PASSWORD_RECOVERY') {
          setIsRecovery(true);
        }

        if (session) {
          setIsRecovery(true);
        }
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };

  }, []);

  // =========================
  // HANDLE INPUTS
  // =========================
  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  };

  // =========================
  // RESET PASSWORD
  // =========================
  const handleResetPassword = async () => {

    try {

      setLoading(true);

      console.log("🔥 RESET PASSWORD STARTED");

      // VALIDATION
      if (!form.password || !form.confirmPassword) {
        throw new Error("Please fill all fields");
      }

      if (form.password.length < 6) {
        throw new Error("Password must be at least 6 characters");
      }

      if (form.password !== form.confirmPassword) {
        throw new Error("Passwords do not match");
      }

      // IMPORTANT CHECK
      if (!isRecovery) {
        throw new Error("Invalid or expired reset link. Please request again.");
      }

      // UPDATE PASSWORD
      const { error } = await supabase.auth.updateUser({
        password: form.password
      });

      if (error) throw error;

      console.log("✅ PASSWORD UPDATED");

      alert("Password updated successfully!");

      navigate('/login');

    } catch (err) {

      console.error("❌ RESET ERROR:", err);
      alert(err.message);

    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      background: '#f5f7fb',
      fontFamily: 'Arial'
    }}>

      <div style={{
        width: '420px',
        background: 'white',
        padding: '40px',
        borderRadius: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
      }}>

        <h1>Reset Password</h1>

        {!isRecovery && (
          <p style={{ color: 'red' }}>
            Waiting for secure reset link...
          </p>
        )}

        <input
          type="password"
          name="password"
          placeholder="New Password"
          onChange={handleChange}
          style={{ width: '100%', padding: 12, marginBottom: 15 }}
        />

        <input
          type="password"
          name="confirmPassword"
          placeholder="Confirm Password"
          onChange={handleChange}
          style={{ width: '100%', padding: 12, marginBottom: 20 }}
        />

        <button
          onClick={handleResetPassword}
          disabled={loading}
          style={{
            width: '100%',
            padding: 14,
            background: '#2563eb',
            color: 'white',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          {loading ? 'Updating...' : 'Reset Password'}
        </button>

        <p style={{ marginTop: 15, textAlign: 'center' }}>
          <span
            style={{ color: '#2563eb', cursor: 'pointer' }}
            onClick={() => navigate('/login')}
          >
            Back to Login
          </span>
        </p>

      </div>
    </div>
  );
}

export default ResetPassword;