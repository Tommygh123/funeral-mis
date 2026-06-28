import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

function CashierDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [institution, setInstitution] = useState({ name: '', logo_url: '' });
  const [funerals, setFunerals] = useState([]);
  const [selectedFuneral, setSelectedFuneral] = useState(null);
  
  // Initialize with all currencies as 0
  const [stats, setStats] = useState({ 
    transactions: 0, 
    totals: { GHS: 0, USD: 0, GBP: 0, EUR: 0 } 
  });

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return navigate('/login');
      const { data: profile } = await supabase.from('users').select('institution_id').eq('id', user.id).single();
      if (!profile?.institution_id) return;
      const { data: inst } = await supabase.from('institutions').select('name, logo_url').eq('id', profile.institution_id).single();
      setInstitution(inst || {});
      const { data: funeralData } = await supabase.from('funerals').select('*').eq('institution_id', profile.institution_id).eq('status', 'active');
      setFunerals(funeralData || []);
      setSelectedFuneral(funeralData?.[0] || null);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [navigate]);

  const loadTransactions = useCallback(async (funeralId) => {
    if (!funeralId) return;
    
    const { data: validTxns } = await supabase
      .from('valid_transactions')
      .select('amount, currency')
      .eq('funeral_id', funeralId);

    const txns = validTxns || [];
    let totals = { GHS: 0, USD: 0, GBP: 0, EUR: 0 };
    
    txns.forEach(t => { 
      const amt = Number(t.amount || 0); 
      if (totals.hasOwnProperty(t.currency)) totals[t.currency] += amt; 
    });

    setStats({ 
      transactions: txns.length, 
      totals: totals 
    });
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);
  useEffect(() => { if (selectedFuneral?.id) loadTransactions(selectedFuneral.id); }, [selectedFuneral, loadTransactions]);

  const chartData = useMemo(() => Object.entries(stats.totals).map(([curr, val]) => ({ name: curr, value: val })), [stats.totals]);

  if (loading) return <div style={loadingBox}>Loading Cashier Panel...</div>;

  return (
    <div style={pageContent}>
      <div style={header}>
        {institution.logo_url && <img src={institution.logo_url} alt="Logo" style={logoStyle} />}
        <div>
          <h1 style={{ margin: '0 0 5px 0', fontSize: '1.75rem', color: '#1e293b' }}>{institution.name}</h1>
          <p style={{ margin: 0, color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Cashier Dashboard</p>
        </div>
      </div>

      {funerals.length > 0 && (
        <div style={funeralBar}>
          {funerals.map(f => (
            <button key={f.id} onClick={() => setSelectedFuneral(f)} style={{...funeralBtn, background: selectedFuneral?.id === f.id ? '#2563eb' : '#fff', color: selectedFuneral?.id === f.id ? '#fff' : '#1e293b', borderColor: selectedFuneral?.id === f.id ? '#2563eb' : '#cbd5e1' }}>
              {f.full_name}
            </button>
          ))}
        </div>
      )}

      {/* Stats Grid: Always shows 4 currencies */}
      <div style={statsGrid}>
        <div style={card}><span style={statLabel}>Valid Transactions</span><div style={statVal}>{stats.transactions}</div></div>
        <div style={card}><span style={statLabel}>GHS Total</span><div style={{ ...statVal, color: '#16a34a' }}>₵{stats.totals.GHS.toLocaleString()}</div></div>
        <div style={card}><span style={statLabel}>USD Total</span><div style={{ ...statVal, color: '#2563eb' }}>${stats.totals.USD.toLocaleString()}</div></div>
        <div style={card}><span style={statLabel}>GBP Total</span><div style={{ ...statVal, color: '#9333ea' }}>£{stats.totals.GBP.toLocaleString()}</div></div>
        <div style={card}><span style={statLabel}>EUR Total</span><div style={{ ...statVal, color: '#eab308' }}>€{stats.totals.EUR.toLocaleString()}</div></div>
      </div>

      <div style={{...card, height: '300px', marginTop: '20px'}}>
        <h3 style={{ marginTop: 0, color: '#1e293b' }}>Collection Overview</h3>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" fill="#2563eb" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Styles remain identical
const pageContent = { display: 'flex', flexDirection: 'column', gap: '20px', fontFamily: 'system-ui, sans-serif', padding: '20px' };
const header = { background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '20px' };
const logoStyle = { width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover' };
const funeralBar = { display: 'flex', gap: '10px', flexWrap: 'wrap' };
const funeralBtn = { padding: '10px 16px', border: '1px solid', borderRadius: '8px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600' };
const statsGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' };
const card = { background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' };
const statLabel = { fontSize: '0.875rem', color: '#64748b', fontWeight: '500' };
const statVal = { fontSize: '1.5rem', fontWeight: '700', color: '#0f172a' };
const loadingBox = { padding: '80px', textAlign: 'center', color: '#64748b' };

export default CashierDashboard;