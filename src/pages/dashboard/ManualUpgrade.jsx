import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';

function ManualUpgrade() {
  const [view, setView] = useState('form');
  const [institutions, setInstitutions] = useState([]);
  const [payments, setPayments] = useState([]);
  const [totals, setTotals] = useState({ GHS: 0, USD: 0 }); // Added totals state
  const [manual, setManual] = useState({ 
    inst_id: '', plan: 'LOCAL_BASIC', amount: 500, max_funerals: 1, ref: '', market: 'local' 
  });
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [systemSettings, setSystemSettings] = useState({
    price_local_base: 500, price_local_stream: 300, price_business_volume: 1500
  });

  async function fetchData() {
    const { data: instData } = await supabase.from('institutions').select('id, name');
    const { data: configs } = await supabase.from('system_global_configs').select('config_key, config_value');
    const { data: payData } = await supabase.from('offline_payments').select('amount, currency, plan_name, momo_ref, created_at, institutions(name)').order('created_at', { ascending: false });
    
    if (instData) setInstitutions(instData);
    if (payData) {
      setPayments(payData);
      // Calculate totals dynamically
      const newTotals = { GHS: 0, USD: 0 };
      payData.forEach(p => {
        if (newTotals.hasOwnProperty(p.currency)) newTotals[p.currency] += Number(p.amount);
      });
      setTotals(newTotals);
    }
    if (configs) {
      const newSettings = {};
      configs.forEach(row => { if (row.config_key in systemSettings) newSettings[row.config_key] = Number(row.config_value); });
      setSystemSettings(prev => ({ ...prev, ...newSettings }));
    }
  }

  useEffect(() => { fetchData(); }, []);

  const handleManualUpgrade = async (e) => {
    e.preventDefault();
    if (!manual.inst_id) return alert("Please select an institution");
    setIsUpgrading(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase.rpc('manual_admin_upgrade', {
      p_target_id: manual.inst_id,
      p_plan_name: manual.plan,
      p_amount: Number(manual.amount),
      p_currency: manual.market === 'local' ? 'GHS' : 'USD',
      p_max_funerals: Number(manual.max_funerals),
      p_billing_market: manual.market,
      p_momo_ref: manual.ref,
      p_admin_user_id: user?.id,
      p_livestream_enabled: manual.plan === 'LOCAL_STREAM' || manual.plan === 'BUSINESS'
    });

    if (error) {
      alert("Upgrade Error: " + error.message);
    } else { 
      alert("Manual Upgrade Successful!"); 
      setManual({ inst_id: '', plan: 'LOCAL_BASIC', amount: 500, max_funerals: 1, ref: '', market: 'local' }); 
      fetchData(); 
    }
    setIsUpgrading(false);
  };

  return (
    <div style={{ padding: '30px', fontFamily: 'Inter' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>{view === 'form' ? '⚡ Manual Offline Upgrade' : '💳 Payment History'}</h1>
        <button onClick={() => setView(view === 'form' ? 'history' : 'form')} style={buttonStyle}>
          {view === 'form' ? 'View Payment History' : 'Back to Upgrade Form'}
        </button>
      </div>

      {view === 'form' ? (
        <form onSubmit={handleManualUpgrade} style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '400px', marginTop: '20px' }}>
          {/* ... (Existing form inputs remain exactly same) ... */}
          <select onChange={(e) => setManual({...manual, inst_id: e.target.value})} style={{ padding: '10px' }} value={manual.inst_id}>
            <option value="">Select Institution</option>
            {institutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
          <select onChange={(e) => setManual({...manual, market: e.target.value})} style={{ padding: '10px' }} value={manual.market}>
            <option value="local">Local Market (GHS)</option>
            <option value="diaspora">Diaspora Market (USD)</option>
          </select>
          <select onChange={(e) => {
            const val = e.target.value;
            const configMap = { 'LOCAL_BASIC': systemSettings.price_local_base, 'LOCAL_STREAM': systemSettings.price_local_stream, 'BUSINESS': systemSettings.price_business_volume };
            setManual({...manual, plan: val, amount: configMap[val] || 0, max_funerals: val === 'BUSINESS' ? 5 : 1 });
          }} style={{ padding: '10px' }} value={manual.plan}>
            <option value="LOCAL_BASIC">Local Basic</option>
            <option value="LOCAL_STREAM">Local Stream</option>
            <option value="BUSINESS">Business Volume</option>
          </select>
          <input type="text" placeholder="Transaction Reference" value={manual.ref} onChange={(e) => setManual({...manual, ref: e.target.value})} style={{ padding: '10px' }} />
          <button type="submit" disabled={isUpgrading} style={buttonStyle}>{isUpgrading ? "Processing..." : `Confirm Upgrade`}</button>
        </form>
      ) : (
        <div style={{ marginTop: '20px' }}>
          <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
            <div style={statCard}><h3>Total GHS</h3><p style={statVal}>₵{totals.GHS.toLocaleString()}</p></div>
            <div style={statCard}><h3>Total USD</h3><p style={statVal}>${totals.USD.toLocaleString()}</p></div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ textAlign: 'left', borderBottom: '2px solid #ddd' }}><th>Date</th><th>Institution</th><th>Plan</th><th>Amount</th><th>Ref</th></tr></thead>
            <tbody>
              {payments.map((p, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '10px' }}>{new Date(p.created_at).toLocaleDateString()}</td>
                  <td>{p.institutions?.name}</td><td>{p.plan_name}</td>
                  <td>{p.currency} {p.amount}</td><td>{p.momo_ref}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const buttonStyle = { padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' };
const statCard = { background: '#f8fafc', padding: '15px', borderRadius: '8px', minWidth: '150px', border: '1px solid #e2e8f0' };
const statVal = { fontSize: '20px', fontWeight: 'bold', margin: '5px 0 0 0' };

export default ManualUpgrade;