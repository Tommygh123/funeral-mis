import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase';

function GetStarted() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: '', email: '', password: '', phone: '', location: '', logo: null
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
      if (!form.name.trim() || !form.email.trim() || form.password.length < 6) 
        return alert('Please fill in all fields (Password min 6 chars)');

      setLoading(true);
      const email = form.email.toLowerCase().trim();
      const phone = normalizePhone(form.phone);

      // Check Duplicate
      const { data: existing } = await supabase.from('institutions').select('id').eq('email', email).maybeSingle();
      if (existing) throw new Error('Institution email already exists');

      // Logo Upload
      let logoUrl = null;
      if (form.logo) {
        const fileName = `${Date.now()}-${form.logo.name}`;
        const { error: uploadErr } = await supabase.storage.from('institution-logos').upload(fileName, form.logo);
        if (!uploadErr) logoUrl = supabase.storage.from('institution-logos').getPublicUrl(fileName).data.publicUrl;
      }

      // Create Auth
      const { data: authData, error: authErr } = await supabase.auth.signUp({ email, password: form.password });
      if (authErr) throw authErr;

      // Calculate Trial Expiry (14 days)
      const now = new Date();
      const expiry = new Date();
      expiry.setDate(now.getDate() + 14);

      // Create Institution
      const { data: institution, error: instErr } = await supabase
        .from('institutions')
        .insert([{
          name: form.name,
          email,
          phone,
          location: form.location,
          logo_url: logoUrl,
          subscription_plan: 'BASIC',
          subscription_status: 'active', // Changed to active
          funeral_limit_per_month: 1,
          subscription_end_date: expiry.toISOString()
        }])
        .select()
        .single();

      if (instErr) throw instErr;

      // Initialize Subscription Record (Including all NON-NULL fields)
      const { error: subErr } = await supabase.from('subscriptions').insert([{
        institution_id: institution.id,
        plan_name: 'free_trial',
        billing_market: 'local',
        amount: 0,
        currency: 'GHS',
        max_funerals: 1, // Added to fix the constraint violation
        status: 'active', // Changed to active
        starts_at: now.toISOString(),
        expires_at: expiry.toISOString()
      }]);
      if (subErr) throw subErr;

      // Set Admin Role
      const { data: role } = await supabase.from('roles').select('id').eq('name', 'ADMIN').single();

      // Create Profile
      await supabase.from('users').insert([{
        id: authData.user.id,
        institution_id: institution.id,
        full_name: form.name,
        email,
        phone,
        role_id: role.id,
        status: 'active'
      }]);

      alert('Institution created successfully.\n\n14-day free trial activated with 1 funeral capacity.');
      navigate('/login');
    } catch (err) {
      alert(err.message);
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

        <label style={label}>Admin Email</label>
        <input type="email" name="email" placeholder="example@email.com" onChange={handleChange} style={input} />

        <label style={label}>Password</label>
        <input type="password" name="password" placeholder="Minimum 6 characters" onChange={handleChange} style={input} />

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