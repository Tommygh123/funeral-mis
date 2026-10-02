import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

const internationalCodes = [
  { code: '+233', label: '🇬🇭 Ghana (+233)' }, { code: '+1', label: '🇺🇸 USA/CAN (+1)' },
  { code: '+44', label: '🇬🇧 UK (+44)' }, { code: '+49', label: '🇩🇪 Germany (+49)' },
  { code: '+31', label: '🇳🇱 Netherlands (+31)' }, { code: '+33', label: '🇫🇷 France (+33)' },
  { code: '+34', label: '🇪🇸 Spain (+34)' }, { code: '+351', label: '🇵🇹 Portugal (+351)' },
  { code: '+39', label: '🇮🇹 Italy (+39)' }, { code: '+32', label: '🇧🇪 Belgium (+32)' },
  { code: '+61', label: '🇦🇺 Australia (+61)' }, { code: '+234', label: '🇳🇬 Nigeria (+234)' },
  { code: '+27', label: '🇿🇦 South Africa (+27)' },
];

const Donate = () => {
  const { funeralId } = useParams();
  const [funeral, setFuneral] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  
  const [form, setForm] = useState({ 
    amount: '', 
    name: '', 
    countryCode: '+233', 
    phoneNational: '',
    recipientName: '',
    recipientRelation: '' 
  });

  const inputStyle = {
    padding: '14px',
    fontSize: '16px',
    borderRadius: '8px',
    border: '1px solid #ccc',
    width: '100%',
    boxSizing: 'border-box'
  };

  // SMS Helper Function
  const sendSMS = async (phone, message, institution_id, transaction_id) => {
    try {
      await supabase.functions.invoke('hyper-responder', { body: { phone, message } });
      await supabase.from('sms_logs').insert([{
        institution_id, transaction_id, phone, message,
        status: 'sent', provider: 'hyper-responder', created_at: new Date().toISOString()
      }]);
    } catch (err) {
      console.error('SMS Error:', err.message);
      await supabase.from('sms_logs').insert([{
        institution_id, transaction_id, phone, message,
        status: 'failed', error: err.message, created_at: new Date().toISOString()
      }]);
    }
  };

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    checkUser();

    const fetchFuneral = async () => {
      if (!funeralId) {
        setError("No Funeral ID found in URL.");
        setLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase.rpc('legacycloud_public_funeral', { p_funeral_id: funeralId }).single();
        if (error) throw error;
        setFuneral(data);
      } catch (err) {
        setError("Could not load funeral details.");
      } finally {
        setLoading(false);
      }
    };
    fetchFuneral();
  }, [funeralId]);

  const handlePayment = async (e) => {
    e.preventDefault();
    if (!form.amount || Number(form.amount) <= 0 || !form.name || !form.recipientName) {
      return alert("Please enter your name, who the donation is for, and a valid amount.");
    }

    try {
      const { data, error } = await supabase.functions.invoke('paystack-initialize', {
        body: { 
          amount: Number(form.amount) * 100,
          metadata: { 
            funeral_id: funeralId, 
            user_id: user?.id || null,
            donor_name: form.name,
            donor_phone: form.phoneNational ? `${form.countryCode}${form.phoneNational}` : null,
            donor_country_code: form.countryCode,
            donor_phone_national: form.phoneNational || null,
            recipient_name: form.recipientName,
            recipient_relation: form.recipientRelation 
          }
        }
      });
      if (error) throw error;
      if (data?.authorization_url) window.location.href = data.authorization_url;
    } catch (err) {
      alert("Failed to initialize payment.");
    }
  };

  return (
    <div className="form-page" style={styles.page}>
      <style>{`
        input[type="number"]::-webkit-outer-spin-button, input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        input[type="number"] { -moz-appearance: textfield; appearance: textfield; }
      `}</style>
      {loading ? <p>Loading...</p> : error ? <p style={{ color: 'red' }}>{error}</p> : funeral ? (
        <form onSubmit={handlePayment} style={styles.card}>
          {funeral.photo_url && <img src={funeral.photo_url} alt="Deceased" style={styles.photo} />}
          <div style={{ textAlign: 'center' }}>
            <div style={styles.eyebrow}>DONATION PORTAL</div>
            <h1 style={styles.heading}>{funeral.full_name}</h1>
            <p style={styles.subheading}>Make a secure contribution in memory of the deceased.</p>
          </div>

          <label style={styles.label}>Your Full Name <span style={styles.required}>*</span></label>
          <input type="text" placeholder="Enter your full name" required style={{ ...inputStyle, ...styles.greenField }} value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} />

          <label style={styles.label}>Phone Number <span style={styles.optional}>(Optional)</span></label>
          <div className="phone-input-row" style={styles.row}>
            <select style={{ ...inputStyle, width: '132px', ...styles.neutralField }} value={form.countryCode} onChange={(e) => setForm({...form, countryCode: e.target.value})}>
              {internationalCodes.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
            <input type="tel" placeholder="Phone number (optional)" style={inputStyle} value={form.phoneNational} onChange={(e) => setForm({...form, phoneNational: e.target.value})} />
          </div>

          <label style={styles.label}>Donated To <span style={styles.required}>*</span></label>
          <input type="text" placeholder="e.g. Family, Church, Mosque, etc." required style={{ ...inputStyle, ...styles.blueField }} value={form.recipientName} onChange={(e) => setForm({...form, recipientName: e.target.value})} />
          <input type="text" placeholder="Relation (e.g. Brother, Friend, etc.)" style={inputStyle} value={form.recipientRelation} onChange={(e) => setForm({...form, recipientRelation: e.target.value})} />

          <label style={styles.label}>Amount <span style={styles.required}>*</span></label>
          <div style={styles.row}>
            <input type="number" inputMode="decimal" min="0" step="0.01" placeholder="Enter amount" required style={{ ...inputStyle, ...styles.goldField, flex: 2 }} value={form.amount} onChange={(e) => setForm({...form, amount: e.target.value})} />
            <div style={styles.currency}>GHS</div>
          </div>

          <div style={styles.paymentInfo}>Secure online payment</div>
          <button type="submit" style={styles.button}>Complete Payment</button>
          <p style={styles.footer}>Powered by LegacyCloud</p>
        </form>
      ) : <p>Funeral not found.</p>}
    </div>
  );
};


const styles = {
  page: { maxWidth: 500, margin: '28px auto', padding: '0 14px', fontFamily: 'Inter, Arial, sans-serif' },
  card: { display: 'flex', flexDirection: 'column', gap: 11, padding: 24, background: '#fff', border: '1px solid #e7edf5', borderRadius: 18, boxShadow: '0 12px 36px rgba(15, 23, 42, 0.10)' },
  photo: { width: 92, height: 92, objectFit: 'cover', borderRadius: '50%', alignSelf: 'center', border: '4px solid #f1f5f9' },
  eyebrow: { fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', color: '#2563eb', marginTop: 2 },
  heading: { margin: '5px 0 3px', fontSize: 23, color: '#172554' },
  subheading: { margin: 0, color: '#64748b', fontSize: 14 },
  label: { fontWeight: 700, color: '#172554', marginTop: 5 },
  required: { color: '#dc2626' },
  optional: { color: '#64748b', fontWeight: 500, fontSize: 13 },
  row: { display: 'flex', gap: 8, width: '100%' },
  greenField: { background: '#f0fdf4', borderColor: '#86efac' },
  blueField: { background: '#eff6ff', borderColor: '#93c5fd' },
  goldField: { background: '#fffbeb', borderColor: '#fcd34d' },
  neutralField: { background: '#f8fafc' },
  currency: { flex: 1, minWidth: 86, padding: '14px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#f8fafc', boxSizing: 'border-box', fontWeight: 700, display: 'flex', alignItems: 'center' },
  paymentInfo: { padding: '12px 14px', borderRadius: 8, background: '#faf5ff', border: '1px solid #d8b4fe', color: '#5b21b6', fontWeight: 650, marginTop: 2 },
  button: { padding: 15, background: '#087cf0', color: '#fff', border: 'none', borderRadius: 9, fontSize: 16, fontWeight: 800, cursor: 'pointer', marginTop: 3 },
  footer: { textAlign: 'center', color: '#94a3b8', fontSize: 12, margin: '2px 0 0' }
};

export default Donate;