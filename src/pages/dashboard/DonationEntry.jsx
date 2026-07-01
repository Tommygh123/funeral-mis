import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../supabase';

// =====================================================
// SMS FUNCTION
// =====================================================
const sendTestSMS = async ({ institution_id, transaction_id, phone, donor_name, amount, currency, institution_name, funeral_full_name, recipient_name }) => {
  const message = `Thank you ${donor_name} for your donation of ${amount} ${currency} to ${recipient_name || institution_name} in memory of the late ${funeral_full_name}. We truly appreciate your support.`;
  
  try {
    // 1. Send the SMS via Edge Function
    await supabase.functions.invoke('hyper-responder', { body: { phone, message } });
    
    // 2. Log success to Database
    await supabase.from('sms_logs').insert([{
      institution_id,
      transaction_id,
      phone,
      message,
      status: 'sent',
      provider: 'hyper-responder',
      created_at: new Date().toISOString()
    }]);
  } catch (err) {
    console.error('SMS Error:', err.message);
    // 3. Log failure to Database
    await supabase.from('sms_logs').insert([{
      institution_id,
      transaction_id,
      phone,
      message,
      status: 'failed',
      error: err.message,
      created_at: new Date().toISOString()
    }]);
  }
};

const internationalCodes = [
  { code: '+233', label: '🇬🇭 Ghana (+233)' }, { code: '+1', label: '🇺🇸 USA/CAN (+1)' },
  { code: '+44', label: '🇬🇧 UK (+44)' }, { code: '+49', label: '🇩🇪 Germany (+49)' },
  { code: '+31', label: '🇳🇱 Netherlands (+31)' }, { code: '+33', label: '🇫🇷 France (+33)' },
  { code: '+34', label: '🇪🇸 Spain (+34)' }, { code: '+351', label: '🇵🇹 Portugal (+351)' },
  { code: '+39', label: '🇮🇹 Italy (+39)' }, { code: '+32', label: '🇧🇪 Belgium (+32)' },
  { code: '+61', label: '🇦🇺 Australia (+61)' }, { code: '+234', label: '🇳🇬 Nigeria (+234)' },
  { code: '+27', label: '🇿🇦 South Africa (+27)' },
];

function DonationEntry() {
  const [institution, setInstitution] = useState({});
  const [funerals, setFunerals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [receipt, setReceipt] = useState(null);

  const initialForm = {
    funeral_id: '', donor_name: '', donor_country_code: '+233',
    donor_phone_national: '', recipient_name: '', recipient_relation: '',
    amount: '', currency: 'GHS', payment_method: 'cash'
  };
  const [form, setForm] = useState(initialForm);

  const loadData = useCallback(async () => {
    try {
      setPageLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data: profile } = await supabase.from('users').select('institution_id').eq('id', user.id).single();
      const { data: inst } = await supabase.from('institutions').select('*').eq('id', profile?.institution_id).single();
      setInstitution(inst || {});
      const { data: fData } = await supabase.from('funerals').select('id, full_name, photo_url').eq('institution_id', profile?.institution_id).eq('status', 'active');
      setFunerals(fData || []);
      if (fData?.length > 0) setForm(prev => ({ ...prev, funeral_id: fData[0].id }));
    } catch (err) { console.error(err); } finally { setPageLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const selectedFuneral = funerals.find(f => f.id === form.funeral_id);

  const handleSubmit = async () => {
    if (!form.funeral_id) return alert("Please select a funeral.");
    if (!form.donor_name) return alert("Please enter donor name.");
    if (!form.donor_phone_national) return alert("Please enter phone number.");
    if (!form.amount || Number(form.amount) <= 0) return alert("Please enter a valid amount.");
    
    setLoading(true);
    const fullPhone = `${form.donor_country_code}${form.donor_phone_national}`;
    const amountNumeric = Number(form.amount);
    
    const d = new Date();
    const dateStr = `${String(d.getFullYear()).slice(-2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const uniqueRef = `REC-${dateStr}-${Math.floor(Math.random() * 9999).toString().padStart(4, '0')}`;
    
    const transaction = {
        institution_id: institution.id, user_id: userId, funeral_id: form.funeral_id,
        donor_name: form.donor_name, donor_phone: fullPhone, donor_country_code: form.donor_country_code,
        donor_phone_national: form.donor_phone_national, recipient_name: form.recipient_name,
        recipient_relation: form.recipient_relation, amount: amountNumeric, amount_base: amountNumeric,
        currency: form.currency, payment_method: form.payment_method,
        reference: uniqueRef
    };

    try {
      const { data, error } = await supabase.from('transactions').insert([transaction]).select();
      if (error) throw error;
      
      const transactionRecord = data[0];
      
      // Fire-and-forget SMS
      sendTestSMS({ 
        institution_id: institution.id,
        transaction_id: transactionRecord.id,
        phone: fullPhone, 
        donor_name: form.donor_name, 
        amount: form.amount, 
        currency: form.currency,
        institution_name: institution.name, 
        funeral_full_name: selectedFuneral?.full_name,
        recipient_name: form.recipient_name
      }).catch(err => console.error("SMS Background Error:", err));
      
      setReceipt({ 
        ...transactionRecord, 
        funeral_name: selectedFuneral?.full_name, 
        photo_url: selectedFuneral?.photo_url, 
        inst_name: institution.name,
        inst_phone: institution.phone,
        inst_logo: institution.logo_url
      });
      setLoading(false);
    } catch (err) { alert(err.message); setLoading(false); }
  };

  if (pageLoading) return <div>Loading...</div>;

  return (
    <div style={styles.container}>
      <style>{`@media print { body * { visibility: hidden; } #receipt-print, #receipt-print * { visibility: visible; } #receipt-print { position: absolute; left: 0; top: 0; width: 80mm; } }`}</style>

      {receipt ? (
        <div id="receipt-print" style={styles.thermalSlip}>
          <div style={styles.instHeader}>
            {receipt.inst_logo && <img src={receipt.inst_logo} alt="Logo" style={styles.brandLogo} />}
            <h2 style={styles.slipBrand}>{receipt.inst_name}</h2>
            <p style={styles.slipSub}>{receipt.inst_phone}</p>
          </div>
          <hr style={styles.divider} />
          {receipt.photo_url && <img src={receipt.photo_url} alt="Deceased" style={styles.deceasedPhoto} />}
          <div style={styles.slipHeader}>
            <p style={styles.slipSub}>IN MEMORY OF</p>
            <h3 style={{ margin: '5px 0', fontSize: '14px', textTransform: 'uppercase' }}>{receipt.funeral_name}</h3>
            <p style={{ ...styles.slipSub, marginTop: '10px' }}>DONATION RECEIPT</p>
          </div>
          <hr style={styles.divider} />
          <div style={styles.slipRow}><span>Ref:</span><strong>{receipt.reference || 'N/A'}</strong></div>
          <div style={styles.slipRow}><span>Donor:</span><strong>{receipt.donor_name}</strong></div>
          <div style={styles.slipRow}><span>Donated To:</span><strong>{receipt.recipient_name || '-'}</strong></div>
          <div style={styles.slipRow}><span>Paid:</span><strong>{receipt.currency} {Number(receipt.amount).toFixed(2)}</strong></div>
          <hr style={styles.divider} />
          <div style={styles.slipFooter}>
            <p>Powered by LegacyCloud</p>
            <p>+233244228546</p>
          </div>
          <button className="no-print" onClick={() => window.print()} style={styles.button}>Print Receipt</button>
          <button className="no-print" onClick={() => { 
             setReceipt(null); 
             setForm(prev => ({ ...initialForm, funeral_id: prev.funeral_id })); 
          }} style={{...styles.button, background: '#6c757d', marginTop: '5px'}}>New Entry</button>
        </div>
      ) : (
        <>
          <h2 style={styles.title}>Donation Entry</h2>
          {selectedFuneral?.photo_url && <img src={selectedFuneral.photo_url} alt="Deceased" style={styles.image} />}
          <label>Active Funeral</label>
          <select name="funeral_id" value={form.funeral_id} onChange={handleChange} style={styles.input}>{funerals.map(f => <option key={f.id} value={f.id}>{f.full_name}</option>)}</select>
          <label>Donor Name</label>
          <input name="donor_name" value={form.donor_name} onChange={handleChange} style={styles.input} />
          <label>Donor Phone</label>
          <div className="phone-input-row">
            <select name="donor_country_code" value={form.donor_country_code} onChange={handleChange} style={{ width: '100px', ...styles.input }}>{internationalCodes.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}</select>
            <input name="donor_phone_national" type="tel" value={form.donor_phone_national} onChange={handleChange} style={{ flex: 1, ...styles.input }} />
          </div>
          <label>Donated To</label>
          <input name="recipient_name" value={form.recipient_name} onChange={handleChange} style={styles.input} />
          <input name="recipient_relation" value={form.recipient_relation} onChange={handleChange} style={styles.input} placeholder="Relation" />
          <label>Amount</label>
          <div className="amount-input-row">
            <input name="amount" type="number" value={form.amount} onChange={handleChange} style={{ flex: 2, ...styles.input }} />
            <select name="currency" value={form.currency} onChange={handleChange} style={{ flex: 1, ...styles.input }}><option value="GHS">GHS</option><option value="USD">USD</option><option value="EUR">EUR</option><option value="GBP">GBP</option></select>
          </div>
          <label>Payment Method</label>
          <select name="payment_method" value={form.payment_method} onChange={handleChange} style={styles.input}><option value="cash">Cash</option><option value="momo">Mobile Money</option><option value="card">Card</option><option value="bank">Bank Transfer</option></select>
          <button onClick={handleSubmit} disabled={loading} style={styles.button}>{loading ? "Saving..." : "Save & Print"}</button>
        </>
      )}
    </div>
  );
}

const styles = {
  container: { padding: 15, maxWidth: 400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 8 },
  input: { padding: 8, border: '1px solid #ccc', borderRadius: 4 },
  button: { padding: 10, background: '#007bff', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', width: '100%' },
  image: { width: 80, height: 80, borderRadius: '50%', marginBottom: 5, alignSelf: 'center' },
  title: { textAlign: 'center', fontSize: 18 },
  thermalSlip: { width: '80mm', background: '#fff', padding: '20px', margin: '0 auto', border: '1px solid #eee', fontFamily: 'Arial', fontSize: 13, color: '#000' },
  instHeader: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', marginBottom: '10px' },
  brandLogo: { width: '50px', height: '50px', objectFit: 'contain' },
  deceasedPhoto: { width: '70px', height: '70px', objectFit: 'cover', borderRadius: '50%', display: 'block', margin: '0 auto 10px' },
  slipBrand: { margin: 0, fontSize: 15, textTransform: 'uppercase' },
  slipSub: { margin: 0, fontSize: 12, fontWeight: 'bold' },
  slipHeader: { textAlign: 'center', marginBottom: 10 },
  divider: { borderTop: '1px dashed #000', margin: '10px 0' },
  slipRow: { display: 'flex', justifyContent: 'space-between', marginBottom: 5 },
  slipFooter: { textAlign: 'center', marginTop: 15, fontSize: 11 }
};

export default DonationEntry;

