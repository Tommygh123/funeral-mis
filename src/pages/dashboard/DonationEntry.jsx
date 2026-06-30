import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../supabase';
import { db } from '../../db'; 

// =====================================================
// SMS FUNCTION
// =====================================================
const sendTestSMS = async ({ institution_id, transaction_id, phone, donor_name, amount, currency, institution_name, funeral_full_name, recipient_name }) => {
  const message = `Thank you ${donor_name} for your donation of ${amount} ${currency} to ${recipient_name || institution_name} in memory of the late ${funeral_full_name}. We truly appreciate your support.`;
  try {
    await supabase.functions.invoke('hyper-responder', { body: { phone, message } });
    await supabase.from('sms_logs').insert([{ institution_id, transaction_id, phone, message, status: 'sent', provider: 'hyper-responder', created_at: new Date().toISOString() }]);
  } catch (err) {
    console.error('SMS Error:', err.message);
    await supabase.from('sms_logs').insert([{ institution_id, transaction_id, phone, message, status: 'failed', error: err.message, created_at: new Date().toISOString() }]);
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
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const initialForm = {
    funeral_id: '', donor_name: '', donor_country_code: '+233',
    donor_phone_national: '', recipient_name: '', recipient_relation: '',
    amount: '', currency: 'GHS', payment_method: 'cash'
  };
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    const handleStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleStatus);
    window.addEventListener('offline', handleStatus);
    return () => { window.removeEventListener('online', handleStatus); window.removeEventListener('offline', handleStatus); };
  }, []);

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
    if (!form.funeral_id || !form.donor_name || !form.donor_phone_national || !form.amount) return alert("Please fill all required fields.");
    
    setLoading(true);
    const fullPhone = `${form.donor_country_code}${form.donor_phone_national}`;
    const uniqueRef = `REC-${Date.now()}-${Math.floor(Math.random() * 999)}`;
    
    const transactionData = {
        institution_id: institution.id, user_id: userId, funeral_id: form.funeral_id,
        donor_name: form.donor_name, donor_phone: fullPhone, donor_country_code: form.donor_country_code,
        donor_phone_national: form.donor_phone_national, recipient_name: form.recipient_name,
        recipient_relation: form.recipient_relation, amount: Number(form.amount), amount_base: Number(form.amount),
        currency: form.currency, payment_method: form.payment_method,
        reference: uniqueRef, created_at: new Date().toISOString()
    };

    try {
      const { data, error } = await supabase.from('transactions').insert([transactionData]).select();
      if (error) throw error;
      const transactionRecord = data[0];
      sendTestSMS({ ...transactionRecord, phone: fullPhone, institution_name: institution.name, funeral_full_name: selectedFuneral?.full_name }).catch(console.error);
      setReceipt({ ...transactionRecord, funeral_name: selectedFuneral?.full_name, photo_url: selectedFuneral?.photo_url, inst_name: institution.name, inst_phone: institution.phone, inst_logo: institution.logo_url });
    } catch (err) {
      await db.pendingTransactions.add(transactionData);
      alert("System Offline: Donation saved locally. Will sync when online.");
      setReceipt({ ...transactionData, funeral_name: selectedFuneral?.full_name, photo_url: selectedFuneral?.photo_url, inst_name: institution.name, inst_logo: institution.logo_url });
    } finally {
      setLoading(false);
    }
  };

  if (pageLoading) return <div>Loading...</div>;

  return (
    <div style={styles.container}>
      <div style={{ padding: '5px', textAlign: 'center', background: isOnline ? '#dcfce7' : '#fee2e2', borderRadius: '4px', marginBottom: '10px' }}>
        {isOnline ? '🟢 Online' : '🔴 Offline - Data will sync later'}
      </div>

      <style>{`@media print { .no-print { display: none; } #receipt-print { position: absolute; left: 0; top: 0; width: 80mm; } }`}</style>

      {receipt ? (
        <div id="receipt-print" style={styles.thermalSlip}>
           {/* ... existing receipt render code ... */}
           {receipt.inst_logo && <img src={receipt.inst_logo} alt="Logo" style={styles.brandLogo} />}
           <h2 style={styles.slipBrand}>{receipt.inst_name}</h2>
           <hr style={styles.divider} />
           {receipt.photo_url && <img src={receipt.photo_url} alt="Deceased" style={styles.deceasedPhoto} />}
           <div style={styles.slipHeader}><h3 style={{ margin: '5px 0' }}>{receipt.funeral_name}</h3></div>
           <div style={styles.slipRow}><span>Ref:</span><strong>{receipt.reference}</strong></div>
           <div style={styles.slipRow}><span>Donor:</span><strong>{receipt.donor_name}</strong></div>
           <div style={styles.slipRow}><span>To:</span><strong>{receipt.recipient_name || '-'}</strong></div>
           <div style={styles.slipRow}><span>Amount:</span><strong>{receipt.currency} {Number(receipt.amount).toFixed(2)}</strong></div>
           <button className="no-print" onClick={() => window.print()} style={styles.button}>Print Receipt</button>
           <button className="no-print" onClick={() => { setReceipt(null); setForm(prev => ({ ...initialForm, funeral_id: prev.funeral_id })); }} style={{...styles.button, background: '#6c757d', marginTop: '5px'}}>New Entry</button>
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
          <div style={{ display: 'flex', gap: '5px' }}>
            <select name="donor_country_code" value={form.donor_country_code} onChange={handleChange} style={{ width: '80px', ...styles.input }}>{internationalCodes.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}</select>
            <input name="donor_phone_national" type="tel" value={form.donor_phone_national} onChange={handleChange} style={{ flex: 1, ...styles.input }} />
          </div>

          <label>Recipient / Beneficiary (Optional)</label>
          <input name="recipient_name" value={form.recipient_name} onChange={handleChange} style={styles.input} />
          <input name="recipient_relation" value={form.recipient_relation} onChange={handleChange} style={styles.input} placeholder="Relation (e.g. Spouse, Son)" />

          <label>Amount</label>
          <div style={{ display: 'flex', gap: '5px' }}>
             <input name="amount" type="number" value={form.amount} onChange={handleChange} style={{ flex: 2, ...styles.input }} />
             <select name="currency" value={form.currency} onChange={handleChange} style={{ flex: 1, ...styles.input }}><option value="GHS">GHS</option><option value="USD">USD</option><option value="EUR">EUR</option><option value="GBP">GBP</option></select>
          </div>
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
    image: { width: 80, height: 80, borderRadius: '50%', marginBottom: 5, alignSelf: 'center', objectFit: 'cover' },
    thermalSlip: { width: '80mm', background: '#fff', padding: '20px', margin: '0 auto', border: '1px solid #eee', fontFamily: 'Arial', fontSize: 13, color: '#000' },
    brandLogo: { width: '50px', height: '50px', objectFit: 'contain', display: 'block', margin: '0 auto' },
    deceasedPhoto: { width: '70px', height: '70px', objectFit: 'cover', borderRadius: '50%', display: 'block', margin: '0 auto 10px' },
    slipBrand: { margin: 0, fontSize: 15, textTransform: 'uppercase', textAlign: 'center' },
    slipHeader: { textAlign: 'center', marginBottom: 10 },
    divider: { borderTop: '1px dashed #000', margin: '10px 0' },
    slipRow: { display: 'flex', justifyContent: 'space-between', marginBottom: 5 },
    title: { textAlign: 'center', fontSize: 18 }
};

export default DonationEntry;