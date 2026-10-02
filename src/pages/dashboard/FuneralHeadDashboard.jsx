import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../supabase';

function FuneralHeadDashboard() {
  const [transactions, setTransactions] = useState([]);
  const [funeralInfo, setFuneralInfo] = useState(null);
  const [error,setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({ GHS: 0, USD: 0, EUR: 0, GBP: 0 });

  const loadDashboard=useCallback(async()=>{
    try {
      const {data,error:queryError}=await supabase.rpc('legacycloud_funeralhead_contributions');
      if(queryError) throw new Error('Unable to load valid contributions: '+queryError.message);
      const rows=data?.transactions || [];
      setFuneralInfo(data?.funeral || null);setTransactions(rows);setError('');
      const calculated={GHS:0,USD:0,EUR:0,GBP:0};
      rows.forEach(row=>{
        const currency=String(row.currency || '').toUpperCase();
        const amount=Number(row.amount);
        if(Object.prototype.hasOwnProperty.call(calculated,currency)&&Number.isFinite(amount)) calculated[currency]+=amount;
      });
      setTotals(calculated);
    } catch(err) {
      setError(err.message);setTransactions([]);setTotals({GHS:0,USD:0,EUR:0,GBP:0});
    } finally {setLoading(false);}
  },[]);
  useEffect(()=>{
    loadDashboard();
    const onFocus=()=>loadDashboard();
    window.addEventListener('focus',onFocus);
    const timer=setInterval(loadDashboard,30000);
    return ()=>{window.removeEventListener('focus',onFocus);clearInterval(timer);};
  },[loadDashboard]);

  if (loading) return <div style={styles.center}>Loading portal...</div>;

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Dashboard</h1>
        <p style={styles.subtitle}>{funeralInfo?.full_name || 'No Funeral Assigned'}</p>
        <small style={{color:'#cbd5e1'}}>Valid contributions only • Voided receipts excluded</small>
      </header>

      {error&&<div role="alert" style={{background:'#fef2f2',color:'#991b1b',border:'1px solid #fecaca',padding:16,borderRadius:12,marginBottom:16}}>{error}<button type="button" onClick={loadDashboard} style={{marginLeft:12,padding:'8px 14px',background:'#991b1b',color:'#fff',border:0,borderRadius:7,cursor:'pointer'}}>Retry</button></div>}
      {/* Responsive Grid */}
      <div className="grid-cols-2" style={styles.grid}>
        {Object.entries(totals).map(([cur, val]) => (
          <div key={cur} style={{...styles.card,...currencyColours[cur]}}>
            <div style={styles.cardLabel}>{cur}</div>
            <div style={styles.cardValue}>{error?'—':val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
        ))}
      </div>

      <div style={styles.tableCard}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}><h3 style={styles.sectionTitle}>Recent Contributions</h3><button type="button" onClick={loadDashboard} style={{background:'#e0f2fe',color:'#075985',border:'1px solid #bae6fd',padding:'8px 14px',borderRadius:8,cursor:'pointer',fontWeight:600}}>Refresh</button></div>
        <div className="table-wrapper" style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.trHead}>
                <th style={styles.th}>Date</th>
                <th style={styles.th}>Donor</th>
                <th style={styles.th}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t,index) => (
                <tr key={t.id} style={{...styles.trBody,background:index%2?'#f0f9ff':'#fff'}}>
                  <td style={styles.td}>{new Date(t.created_at).toLocaleDateString()}</td>
                  <td style={styles.td}>{t.donor_name}</td>
                  <td style={{...styles.td,color:'#0f766e'}}><strong>{t.currency} {Number(t.amount).toLocaleString()}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!error&&transactions.length === 0 && <p style={styles.empty}>{funeralInfo?'No valid contributions yet.':'No funeral has been assigned to this account.'}</p>}
        {!error&&<p style={{fontSize:12,color:'#64748b',marginBottom:0}}>{transactions.length} valid contributions • Updates every 30 seconds</p>}
      </div>
    </div>
  );
}

const currencyColours={
 GHS:{background:'linear-gradient(135deg,#0f766e,#115e59)',borderLeftColor:'#5eead4'},
 USD:{background:'linear-gradient(135deg,#1d4ed8,#1e3a8a)',borderLeftColor:'#93c5fd'},
 EUR:{background:'linear-gradient(135deg,#7c3aed,#4c1d95)',borderLeftColor:'#c4b5fd'},
 GBP:{background:'linear-gradient(135deg,#b45309,#78350f)',borderLeftColor:'#fcd34d'}
};
const styles = {
  container: { padding: '16px', maxWidth: '900px', margin: '0 auto', fontFamily: 'Inter, Arial, sans-serif', background:'#f1f5f9', borderRadius:'16px' },
  header: { marginBottom: '20px',background:'linear-gradient(135deg,#173f70,#0f172a)',padding:'22px',borderRadius:'14px' },
  title: { margin: '0', color: '#fff', fontSize: '24px' },
  subtitle: { color: '#bfdbfe', fontSize: '14px', marginTop: '4px' },
  // Responsive Grid: 2 columns on small, 4 on larger
  grid: { 
    display: 'grid', 
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
    gap: '10px', 
    marginBottom: '20px' 
  },
  card: { 
    background: '#0f172a', // Dark theme for cards
    padding: '16px', 
    borderRadius: '12px', 
    color: '#fff',
    borderLeft: '4px solid #3b82f6' // Blue accent
  },
  cardLabel: { fontSize: '10px', fontWeight: '800', opacity: 0.7, textTransform: 'uppercase' },
  cardValue: { fontSize: '18px', fontWeight: '700', marginTop: '4px' },
  tableCard: { background: '#fff', padding: '20px', borderRadius: '14px', border: '1px solid #dbe5ef',boxShadow:'0 4px 16px rgba(15,23,42,.05)' },
  sectionTitle: { fontSize: '16px', marginBottom: '16px', color: '#1e293b' },
  tableWrapper: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  trHead: { background: '#173f70' },
  trBody: { borderBottom: '1px solid #f1f5f9' },
  th: { padding: '12px 10px', textAlign: 'left', color: '#fff', fontSize: '11px', textTransform: 'uppercase' },
  td: { padding: '12px 8px', fontSize: '13px' },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: '20px', fontSize: '13px' },
  center: { textAlign: 'center', marginTop: '100px', color: '#64748b' }
};

export default FuneralHeadDashboard;