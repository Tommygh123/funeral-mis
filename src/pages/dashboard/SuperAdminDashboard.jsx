import React, { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../../supabase';
import AuditLog from './AuditLog';

function SuperAdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [metrics, setMetrics] = useState({ subGHS: 0, subUSD: 0, subEUR: 0, subGBP: 0 });
  const [subscriptions, setSubscriptions] = useState([]);
  const [activeFunerals, setActiveFunerals] = useState([]); // New state for global funerals
  const [searchTerm, setSearchTerm] = useState('');
  
  const [systemSettings, setSystemSettings] = useState({
    price_local_base: 500,
    price_local_stream: 300,
    price_business_volume: 1500,
    price_diaspora_base: 100,
    price_diaspora_5_funeral: 150,
    price_diaspora_stream: 75
  });
  
  const [updating, setUpdating] = useState(false);
  const isMounted = useRef(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [ { data: configs }, { data: subData }, { data: funeralData } ] = await Promise.all([
        supabase.from('system_global_configs').select('config_key, config_value'),
        supabase.from('subscriptions').select(`amount, currency, status, plan_name, institutions (name)`),
        supabase.from('funerals').select(`full_name, location, burial_date, status, institutions (name)`).eq('status', 'active')
      ]);

      if (!isMounted.current) return;

      if (configs) {
        let newSettings = {};
        configs.forEach(row => { if (row.config_key in systemSettings) newSettings[row.config_key] = Number(row.config_value); });
        setSystemSettings(prev => ({ ...prev, ...newSettings }));
      }

      const sTotals = { GHS: 0, USD: 0, EUR: 0, GBP: 0 };
      (subData || []).forEach(s => {
        if (s.currency && sTotals.hasOwnProperty(s.currency)) sTotals[s.currency] += (s.amount || 0);
      });

      setSubscriptions(subData || []);
      setActiveFunerals(funeralData || []);
      setMetrics({ subGHS: sTotals.GHS, subUSD: sTotals.USD, subEUR: sTotals.EUR, subGBP: sTotals.GBP });
    } catch (err) { console.error("Load Error:", err); } 
    finally { if (isMounted.current) setLoading(false); }
  }, []);

  useEffect(() => { 
    isMounted.current = true;
    loadData(); 
    return () => { isMounted.current = false; };
  }, [loadData]);

  const saveSettings = async (e) => {
    e.preventDefault();
    setUpdating(true);
    const updates = Object.entries(systemSettings).map(([key, val]) => ({ config_key: key, config_value: val }));
    const { error } = await supabase.from('system_global_configs').upsert(updates, { onConflict: 'config_key' });
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('system_audit_logs').insert({ admin_email: user?.email, action: 'UPDATE_CONFIG', details: systemSettings });
      alert("Registry Updated Successfully");
    }
    setUpdating(false);
  };

  const filteredSubs = subscriptions.filter(s => 
    s.institutions?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>🚀 Platform Controller HQ</h1>
      
      <div style={styles.tabContainer}>
        {['dashboard', 'audit'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{...styles.tab, borderBottom: activeTab === tab ? '2px solid #2563eb' : 'none'}}>
            {tab === 'dashboard' ? '📊 Overview' : '📜 Audit Logs'}
          </button>
        ))}
      </div>

      {activeTab === 'dashboard' ? (
        <>
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>💰 Subscription Earnings</h2>
            <div style={styles.kpiGrid}>
               {[ { c: 'GHS', color: '#2563eb' }, { c: 'USD', color: '#059669' }, { c: 'EUR', color: '#7c3aed' }, { c: 'GBP', color: '#db2777' } ].map(item => (
                 <div key={item.c} style={{...styles.card, borderLeft: `6px solid ${item.color}`}}>
                   <h3 style={{...styles.kpiLabel, color: item.color}}>{item.c} Revenue</h3>
                   <p style={styles.stat}>{metrics[`sub${item.c}`]?.toLocaleString() || 0}</p>
                 </div>
               ))}
            </div>
          </div>

          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>📅 Active Global Funerals</h2>
            <table style={styles.table}>
              <thead><tr style={styles.th}><th>Institution</th><th>Deceased</th><th>Location</th><th>Burial Date</th></tr></thead>
              <tbody>
                {activeFunerals.map((f, i) => (
                  <tr key={i} style={styles.tr}>
                    <td style={styles.td}>{f.institutions?.name || 'External'}</td>
                    <td style={{...styles.td, fontWeight: '600'}}>{f.full_name}</td>
                    <td style={styles.td}>{f.location}</td>
                    <td style={styles.td}>{f.burial_date ? new Date(f.burial_date).toLocaleDateString() : 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={styles.section}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={styles.sectionTitle}>📋 Subscription Records</h2>
              <input placeholder="Search Institution..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={styles.search} />
            </div>
            <table style={styles.table}>
              <thead><tr style={styles.th}><th>Institution</th><th>Plan</th><th>Status</th><th>Amount</th></tr></thead>
              <tbody>
                {filteredSubs.map((s, i) => (
                  <tr key={i} style={styles.tr}>
                    <td style={{...styles.td, fontWeight: '600'}}>{s.institutions?.name || 'N/A'}</td>
                    <td style={styles.td}>{s.plan_name}</td>
                    <td style={styles.td}><span style={styles.badge}>{s.status}</span></td>
                    <td style={{...styles.td, color: '#059669', fontWeight: 'bold'}}>{s.amount?.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={styles.configSection}>
            <h2 style={styles.configTitle}>⚙️ Global Configuration Registry</h2>
            <form onSubmit={saveSettings}>
              <h4 style={styles.planHeading}>📍 Local Market Settings (GHS)</h4>
              <div style={styles.formGrid}>
                {['price_local_base', 'price_local_stream', 'price_business_volume'].map(key => (
                  <div key={key}>
                    <label style={styles.label}>{key.replace(/_/g, ' ').toUpperCase()}</label>
                    <input type="number" value={systemSettings[key]} onChange={(e) => setSystemSettings(prev => ({...prev, [key]: Number(e.target.value)}))} style={{...styles.input, borderLeft: '4px solid #3b82f6'}} />
                  </div>
                ))}
              </div>
              <h4 style={{...styles.planHeading, marginTop: '20px'}}>🌎 Diaspora Market Settings ($)</h4>
              <div style={styles.formGrid}>
                {['price_diaspora_base', 'price_diaspora_5_funeral', 'price_diaspora_stream'].map(key => (
                  <div key={key}>
                    <label style={styles.label}>{key.replace(/_/g, ' ').toUpperCase()}</label>
                    <input type="number" value={systemSettings[key]} onChange={(e) => setSystemSettings(prev => ({...prev, [key]: Number(e.target.value)}))} style={{...styles.input, borderLeft: '4px solid #f59e0b'}} />
                  </div>
                ))}
              </div>
              <button type="submit" disabled={updating} style={styles.button}>{updating ? "Saving..." : "💾 Commit Changes"}</button>
            </form>
          </div>
        </>
      ) : <AuditLog />}
    </div>
  );
}

const styles = {
  page: { padding: '30px', background: '#f1f5f9', minHeight: '100vh', fontFamily: 'Inter' },
  title: { color: '#1e293b', marginBottom: '30px' },
  tabContainer: { display: 'flex', gap: '20px', marginBottom: '20px' },
  tab: { padding: '10px', cursor: 'pointer', background: 'none', border: 'none', fontWeight: '600', color: '#475569' },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '20px' },
  card: { background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' },
  kpiLabel: { fontSize: '12px', fontWeight: '800', textTransform: 'uppercase', marginBottom: '5px' },
  stat: { fontSize: '24px', fontWeight: '800', margin: 0, color: '#1e293b' },
  section: { background: '#fff', padding: '25px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', marginBottom: '30px' },
  sectionTitle: { fontSize: '18px', marginBottom: '20px', color: '#1e293b' },
  badge: { padding: '4px 8px', borderRadius: '6px', background: '#e0e7ff', color: '#4338ca', fontSize: '11px', fontWeight: '700' },
  configSection: { background: '#1e293b', padding: '30px', borderRadius: '12px', color: '#fff', marginBottom: '30px' },
  configTitle: { fontSize: '22px', marginBottom: '20px', color: '#fff', borderBottom: '1px solid #334155', paddingBottom: '10px' },
  planHeading: { fontSize: '14px', color: '#94a3b8', marginBottom: '15px', textTransform: 'uppercase', letterSpacing: '1px' },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '10px' },
  label: { fontSize: '10px', fontWeight: '800', color: '#cbd5e1', display: 'block', marginBottom: '8px' },
  input: { width: '100%', padding: '12px', borderRadius: '8px', border: 'none', background: '#334155', color: '#fff', fontSize: '16px' },
  search: { padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' },
  button: { marginTop: '20px', padding: '12px 30px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' },
  table: { width: '100%', borderCollapse: 'separate', borderSpacing: '0 8px' },
  th: { padding: '12px', textAlign: 'left', fontSize: '12px', color: '#64748b', textTransform: 'uppercase' },
  tr: { transition: '0.2s' },
  td: { padding: '16px 12px', borderBottom: '1px solid #f1f5f9' }
};

export default SuperAdminDashboard;