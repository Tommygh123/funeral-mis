import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase';
import { useToast } from '../../components/ui/ToastProvider';

function GetStarted() {
  const navigate = useNavigate();
  const notifications = useToast();
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: '', username: '', password: '', phone: '', location: '', logo: null
  });

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const handleLogo = (e) => setForm({ ...form, logo: e.target.files[0] });

  const normalizePhone = (value) => {
    if (!value) return '';
    let v = value.replace(/\s/g, '');
    if (v.startsWith('0') && v.length === 10) v = '+233' + v.substring(1);
    if (!v.startsWith('+')) v = '+' + v;
    return v;
  };

  const handleSubmit = async () => {
    try {
      if (!form.name.trim() || !form.username.trim() || form.password.length < 8)
        return notifications.warning('Institution name, username, and a password of at least 8 characters are required.');

      setLoading(true);
      const phone = normalizePhone(form.phone);

      // Logo Upload
      let logoUrl = null;
      if (form.logo) {
        const fileName = `${Date.now()}-${form.logo.name}`;
        const { error: uploadErr } = await supabase.storage.from('institution-logos').upload(fileName, form.logo);
        if (!uploadErr) logoUrl = supabase.storage.from('institution-logos').getPublicUrl(fileName).data.publicUrl;
      }

      const { data, error } = await supabase.functions.invoke('register-institution', {
        body: {
          institutionName: form.name.trim(),
          username: form.username.trim().toLowerCase(),
          password: form.password,
          phone,
          location: form.location.trim(),
          logoUrl,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.message || 'Unable to create institution.');

      notifications.success(data.message);
      navigate('/login');
    } catch (err) {
      notifications.error(err.message || 'Unable to create institution.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page" style={{ background: 'linear-gradient(135deg, #eef2ff 0%, #f8fafc 100%)' }}>
      <div className="auth-card" style={{ maxWidth: 540, borderRadius: 20, padding: 40, boxShadow: '0 20px 40px rgba(0,0,0,0.08)' }}>
        <div style={header}>
          <h1 style={title}>LegacyCloud</h1>
          <p style={subtitle}>Create your funeral institution account</p>
        </div>

        {/* PLAN BANNER */}
        <div style={trialBanner}>
          🎉 14-Day Free Trial Included
          <div style={trialText}>1 Active Funeral Slot • Dashboard Access</div>
        </div>

        <label style={label}>Institution Name</label>
        <input name="name" placeholder="Enter institution name" onChange={handleChange} style={input} />

        <label style={label}>Admin Username</label>
        <input name="username" autoComplete="username" placeholder="Choose a globally unique username" onChange={handleChange} style={input} />

        <label style={label}>Password</label>
        <input type="password" name="password" autoComplete="new-password" placeholder="Minimum 8 characters" onChange={handleChange} style={input} />

        <label style={label}>Phone Number</label>
        <input name="phone" placeholder="+233xxxxxxxxx" onChange={handleChange} style={input} />

        <label style={label}>Location</label>
        <input name="location" placeholder="Kumasi, Ghana" onChange={handleChange} style={input} />

        <label style={label}>Institution Logo</label>
        <input type="file" accept="image/*" onChange={handleLogo} style={fileInput} />

        <button onClick={handleSubmit} disabled={loading} style={{...button, opacity: loading ? 0.7 : 1}}>
          {loading ? 'Creating Account...' : 'Create Institution'}
        </button>

        <p style={loginText}>
          Already registered? <span style={loginLink} onClick={() => navigate('/login')}>Login</span>
        </p>
      </div>
    </div>
  );
}

const page = { minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'linear-gradient(135deg, #eef2ff 0%, #f8fafc 100%)', padding: 20 };
const card = { width: '100%', maxWidth: 540, background: '#fff', borderRadius: 20, padding: 40, boxShadow: '0 20px 40px rgba(0,0,0,0.08)' };
const header = { marginBottom: 20, textAlign: 'center' };
const title = { margin: 0, color: '#0b1f3a', fontSize: 'clamp(24px, 5vw, 36px)', fontWeight: 700 };
const subtitle = { color: '#64748b', marginTop: 10, fontSize: 16 };
const trialBanner = { background: '#eff6ff', border: '1px solid #bfdbfe', padding: 16, borderRadius: 12, marginBottom: 25, color: '#1d4ed8', fontWeight: 700, fontSize: 16, textAlign: 'center' };
const trialText = { marginTop: 6, fontWeight: 500, fontSize: 14, color: '#475569' };
const label = { display: 'block', marginBottom: 8, marginTop: 16, fontWeight: 600, color: '#111827', fontSize: 15 };
const input = { width: '100%', padding: 15, borderRadius: 12, border: '1px solid #d1d5db', fontSize: 16, outline: 'none', background: '#fff', transition: '0.2s' };
const fileInput = { width: '100%', padding: 12, fontSize: 15, marginTop: 4 };
const button = { width: '100%', marginTop: 28, padding: 16, border: 'none', borderRadius: 12, background: '#2563eb', color: '#fff', fontSize: 17, fontWeight: 700, cursor: 'pointer', boxShadow: '0 10px 20px rgba(37,99,235,0.25)' };
const loginText = { marginTop: 24, textAlign: 'center', color: '#64748b', fontSize: 15 };
const loginLink = { marginLeft: 8, color: '#2563eb', fontWeight: 700, cursor: 'pointer' };

export default GetStarted;
