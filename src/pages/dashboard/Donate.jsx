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
    recipientName: '' 
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
        const { data, error } = await supabase.from('funerals').select('*').eq('id', funeralId).single();
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
    if (!form.amount || !form.name || !form.phoneNational || !form.recipientName) {
      return alert("All fields are required.");
    }

    try {
      const { data, error } = await supabase.functions.invoke('paystack-initialize', {
        body: { 
          amount: Number(form.amount) * 100,
          metadata: { 
            funeral_id: funeralId, 
            user_id: user?.id || null,
            donor_name: form.name,
            donor_phone: `${form.countryCode}${form.phoneNational}`,
            donor_country_code: form.countryCode,
            donor_phone_national: form.phoneNational,
            recipient_name: form.recipientName 
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
    <div style={{ padding: '20px', maxWidth: '450px', margin: '40px auto', fontFamily: 'sans-serif' }}>
      {loading ? <p>Loading...</p> : error ? <p style={{ color: 'red' }}>{error}</p> : funeral ? (
        <form onSubmit={handlePayment} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h1 style={{ textAlign: 'center' }}>Donation Portal</h1>
          <div style={{ backgroundColor: '#f9f9f9', padding: '20px', borderRadius: '10px', border: '1px solid #eee' }}>
            <p style={{ margin: '0 0 5px 0', fontSize: '0.9rem', color: '#666' }}>Supportive Event:</p>
            <strong style={{ fontSize: '1.2rem', color: '#333' }}>{funeral.full_name}</strong>
          </div>

          <input type="number" placeholder="Amount (GHS)" required style={inputStyle} onChange={(e) => setForm({...form, amount: e.target.value})} />
          <input type="text" placeholder="Your Full Name" required style={inputStyle} onChange={(e) => setForm({...form, name: e.target.value})} />
          <input type="text" placeholder="Recipient Name" required style={inputStyle} onChange={(e) => setForm({...form, recipientName: e.target.value})} />
          
          <div style={{ display: 'flex', gap: '10px' }}>
            <select style={{ ...inputStyle, width: '120px' }} onChange={(e) => setForm({...form, countryCode: e.target.value})}>
              {internationalCodes.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
            <input type="text" placeholder="Phone Number" required style={inputStyle} onChange={(e) => setForm({...form, phoneNational: e.target.value})} />
          </div>

          <button type="submit" style={{ padding: '16px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '8px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }}>
            Complete Payment
          </button>
        </form>
      ) : <p>Funeral not found.</p>}
    </div>
  );
};

export default Donate;