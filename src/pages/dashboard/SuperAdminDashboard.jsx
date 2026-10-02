import { parsePlanSettings } from '../../utils/subscriptionConfig';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../../supabase';
import AuditLog from './AuditLog';

function SuperAdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [metrics, setMetrics] = useState({ subGHS: 0, subUSD: 0, subEUR: 0, subGBP: 0 });
  const [subscriptions, setSubscriptions] = useState([]);
  const [institutions,setInstitutions] = useState([]);
  const [directoryError,setDirectoryError] = useState('');
  const [recordView,setRecordView] = useState('institutions');
  const [activeFuneralCount,setActiveFuneralCount] = useState(0);
  const [activeFunerals, setActiveFunerals] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [systemSettings, setSystemSettings] = useState({
    price_local_base: 500,
    price_local_stream: 300,
    price_business_volume: 1500,
    price_diaspora_base: 100,
    price_diaspora_5_funeral: 150,
    price_diaspora_stream: 75,
    usd_to_ghs_rate: 15
  });
  
  const [rateStatus,setRateStatus] = useState('Checking automatic currency update status...');
  const [checkingRate,setCheckingRate] = useState(false);
  const [updating, setUpdating] = useState(false);
  const isMounted = useRef(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [configResult,directoryResult] = await Promise.all([
        supabase.from('system_global_configs').select('config_key, config_value'),
        supabase.rpc('legacycloud_superadmin_directory')
      ]);
      if (!isMounted.current) return;
      if(configResult.error) throw new Error('Unable to read Global Configuration: '+configResult.error.message);
      if(configResult.data) setSystemSettings(prev=>({...prev,...parsePlanSettings(configResult.data)}));
      if(directoryResult.error) throw new Error('Unable to load institutions: '+directoryResult.error.message);
      const directory=directoryResult.data || {};
      const subData=directory.subscriptions || [];
      setInstitutions(directory.institutions || []); setSubscriptions(subData);
      setActiveFuneralCount(Number(directory.active_funeral_count || 0)); setDirectoryError('');
      const totals={GHS:0,USD:0,EUR:0,GBP:0};
      subData.forEach(row=>{if(Object.prototype.hasOwnProperty.call(totals,row.currency)) totals[row.currency]+=Number(row.amount)||0;});
      setMetrics({subGHS:totals.GHS,subUSD:totals.USD,subEUR:totals.EUR,subGBP:totals.GBP});

    } catch (err) { if(isMounted.current) setDirectoryError(err.message); } 
    finally { if (isMounted.current) setLoading(false); }
  }, []);

  const refreshRate = useCallback(async () => {
    setCheckingRate(true);
    try {
      const {data:current,error} = await supabase.rpc('legacycloud_fx_status');
      if(error) throw new Error('Unable to read automatic update status: '+error.message);
      if(!current?.scheduled) throw new Error('Automatic update job is not installed or is disabled.');
      if(isMounted.current) {
        if(Number(current.rate)>0) setSystemSettings(prev=>({...prev,usd_to_ghs_rate:Number(current.rate)}));
        const published=current.published_at ? new Date(current.published_at).toLocaleString() : 'awaiting first check';
        setRateStatus(`Automatic hourly checks • Published ${published}${current.pending?' • Checking provider...':''}${current.last_error?' • '+current.last_error+'; last saved rate retained.':''}`);
      }

    } catch(err) {if(isMounted.current) setRateStatus(`${err.message} Keeping the last saved rate.`);}
    finally {if(isMounted.current) setCheckingRate(false);}
  }, []);
  useEffect(() => {
    isMounted.current=true;
    loadData().then(()=>{if(isMounted.current) refreshRate();});
    const timer=setInterval(refreshRate,60000);
    return ()=>{isMounted.current=false;clearInterval(timer);};
  },[loadData,refreshRate]);

  const saveSettings = async (e) => {
    e.preventDefault();
    if(Object.values(systemSettings).some(value=>!Number.isFinite(value)||value<=0)) {alert('Enter a valid positive value for every plan and rate.');return;}
    setUpdating(true);
    const updates = Object.entries(systemSettings).filter(([key])=>key!=='usd_to_ghs_rate').map(([key, val]) => ({ config_key: key, config_value: val.toString() }));
    const { error } = await supabase.from('system_global_configs').upsert(updates, { onConflict: 'config_key' });
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('system_audit_logs').insert({ admin_email: user?.email, action: 'UPDATE_CONFIG', details: systemSettings });
      alert("Registry Updated Successfully");
    }
    if(error) alert('Registry could not be saved: '+error.message);
    setUpdating(false);
  };

  const records=recordView==='institutions' ? institutions : subscriptions;
  const filteredSubs=records.filter(row=>`${row.institution_name || ''} ${row.plan_name || ''} ${row.status || ''}`.toLowerCase().includes(searchTerm.trim().toLowerCase()));
  const badgeColor=status=>['active','paid','completed'].includes(String(status).toLowerCase())
    ? {background:'#dcfce7',color:'#166534'} : ['expired','cancelled','suspended'].includes(String(status).toLowerCase())
    ? {background:'#fee2e2',color:'#991b1b'} : {background:'#e2e8f0',color:'#475569'};

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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '20px', marginBottom: '20px' }}>
               {[ { c: 'GHS', color: '#2563eb' }, { c: 'USD', color: '#059669' }, { c: 'EUR', color: '#7c3aed' }, { c: 'GBP', color: '#db2777' } ].map(item => (
                 <div key={item.c} style={{...styles.card, borderLeft: `6px solid ${item.color}`}}>
                   <h3 style={{...styles.kpiLabel, color: item.color}}>{item.c} Revenue</h3>
                   <p style={styles.stat}>{metrics[`sub${item.c}`]?.toLocaleString() || 0}</p>
                 </div>
               ))}
            </div>
          </div>

          <div style={styles.section}>
            <div style={{display:'flex',flexWrap:'wrap',justifyContent:'space-between',alignItems:'center',gap:12}}>
              <div><h2 style={{...styles.sectionTitle,marginBottom:6}}>Institutions & Subscriptions</h2>
                <p style={{color:'#64748b',fontSize:13,margin:0}}>{institutions.length} institutions • {subscriptions.length} subscription records • {activeFuneralCount} active funerals</p>
              </div>
              <button type="button" onClick={loadData} disabled={loading} style={{...styles.button,marginTop:0,padding:'10px 18px'}}>{loading?'Loading...':'Refresh records'}</button>
            </div>
            <div style={{display:'flex',flexWrap:'wrap',alignItems:'center',gap:12,marginTop:20}}>
              <select aria-label="Record view" value={recordView} onChange={e=>setRecordView(e.target.value)} style={{...styles.search,width:'auto'}}>
                <option value="institutions">All institutions</option><option value="subscriptions">Subscription history</option>
              </select>
              <input aria-label="Search institutions" placeholder="Search institution, plan or status..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} style={{...styles.search,flex:'1 1 240px',width:'auto'}} />
              {searchTerm&&<button type="button" onClick={()=>setSearchTerm('')} style={{border:'1px solid #cbd5e1',background:'#fff',borderRadius:8,padding:'10px 14px',cursor:'pointer'}}>Clear search</button>}
            </div>
            {directoryError&&<p role="alert" style={{background:'#fef2f2',color:'#991b1b',padding:14,borderRadius:8}}>{directoryError}</p>}
            <div style={{overflow:'auto',maxHeight:480,marginTop:16,border:'1px solid #e2e8f0',borderRadius:10}}>
              <table style={{...styles.table,borderCollapse:'collapse',minWidth:700}}>
                <thead><tr>{['Institution','Plan','Status','Amount','Expiry'].map(label=><th key={label} style={{...styles.th,background:'#eff6ff',color:'#173f70',fontWeight:700,position:'sticky',top:0}}>{label}</th>)}</tr></thead>
                <tbody>
                  {loading?<tr><td colSpan={5} style={{...styles.td,textAlign:'center'}}>Loading institutions...</td></tr>:directoryError?null:filteredSubs.length?filteredSubs.map((row,index)=>(
                    <tr key={row.id || row.institution_id || index} style={{...styles.tr,background:index%2?'#f8fafc':'#fff'}}>
                      <td style={{...styles.td,fontWeight:600,color:'#1e293b'}}>{row.institution_name || 'Institution unavailable'}</td>
                      <td style={styles.td}>{String(row.plan_name || 'No subscription').replace(/_/g,' ')}</td>
                      <td style={styles.td}><span style={{...styles.badge,...badgeColor(row.status)}}>{row.status || 'No subscription'}</span></td>
                      <td style={{...styles.td,color:'#166534',fontWeight:600}}>{row.amount==null?'—':`${row.currency || 'GHS'} ${Number(row.amount).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`}</td>
                      <td style={styles.td}>{row.expires_at?new Date(row.expires_at).toLocaleDateString():'—'}</td>
                    </tr>
                  )):<tr><td colSpan={5} style={{...styles.td,textAlign:'center',color:'#64748b',padding:30}}>{searchTerm?'No records match your search. Clear the search to see all records.':recordView==='institutions'?'No institutions have been registered yet.':'No subscription records yet. Switch to All institutions to see registered institutions.'}</td></tr>}
                </tbody>
              </table>
            </div>
            {!loading&&!directoryError&&<p style={{fontSize:12,color:'#64748b',marginBottom:0}}>{filteredSubs.length} of {records.length} records shown</p>}
          </div>

          <div style={styles.configSection}>
            <h2 style={styles.configTitle}>⚙️ Global Configuration Registry</h2>
            <form onSubmit={saveSettings}>
              <h4 style={styles.planHeading}>💱 Currency Conversion</h4>
              <div style={{ marginBottom: '20px', maxWidth: '300px' }}>
                <label style={styles.label}>USD TO GHS RATE</label>
                <input type="number" step="any" readOnly value={systemSettings.usd_to_ghs_rate} style={styles.input} />
                <small style={{display:'block',marginTop:8}}>{rateStatus}</small>
                <button type="button" disabled={checkingRate} onClick={refreshRate} style={{...styles.button,padding:'8px 12px',marginTop:10}}>{checkingRate?'Checking...':'Refresh rate status'}</button>
                <small style={{display:'block',marginTop:8}}><a href="https://www.exchangerate-api.com" target="_blank" rel="noreferrer" style={{color:'#cbd5e1'}}>Rates by ExchangeRate-API</a> • Daily reference rate</small>
              </div>

              <h4 style={styles.planHeading}>📍 Local Market Settings (GHS)</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '20px', marginBottom: '20px' }}>
                {['price_local_base', 'price_local_stream', 'price_business_volume'].map(key => (
                  <div key={key}>
                    <label style={styles.label}>{key.replace(/_/g, ' ').toUpperCase()}</label>
                    <input type="number" value={systemSettings[key]} onChange={(e) => setSystemSettings(prev => ({...prev, [key]: Number(e.target.value)}))} style={styles.input} />
                  </div>
                ))}
              </div>
              <h4 style={styles.planHeading}>🌎 Diaspora Market Settings (GHS Equivalent)</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '20px', marginBottom: '10px' }}>
                {['price_diaspora_base', 'price_diaspora_5_funeral', 'price_diaspora_stream'].map(key => (
                  <div key={key}>
                    <label style={styles.label}>{key.replace(/_/g, ' ').toUpperCase()}</label>
                    <input type="number" value={systemSettings[key]} onChange={(e) => setSystemSettings(prev => ({...prev, [key]: Number(e.target.value)}))} style={styles.input} />
                  </div>
                ))}
              </div>
              <button type="submit" disabled={updating || checkingRate || loading} style={styles.button}>{updating ? "Saving..." : "💾 Commit Changes"}</button>
            </form>
          </div>
        </>
      ) : <AuditLog />}
    </div>
  );
}

const styles = {
  page: { padding: '30px', background: '#f1f5f9', minHeight: '100vh', fontFamily: 'Inter, Arial, sans-serif' },
  title: { color: '#1e293b', marginBottom: '30px' },
  tabContainer: { display: 'flex', gap: '20px', marginBottom: '20px' },
  tab: { padding: '10px', cursor: 'pointer', background: 'none', border: 'none', fontWeight: '600', color: '#475569' },
  card: { background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' },
  kpiLabel: { fontSize: '12px', fontWeight: '800', textTransform: 'uppercase', marginBottom: '5px' },
  stat: { fontSize: '24px', fontWeight: '800', margin: 0, color: '#1e293b' },
  section: { background: '#fff', padding: '25px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', marginBottom: '30px' },
  sectionTitle: { fontSize: '18px', marginBottom: '20px', color: '#1e293b' },
  badge: { padding: '4px 8px', borderRadius: '6px', background: '#e0e7ff', color: '#4338ca', fontSize: '11px', fontWeight: '700' },
  configSection: { background: '#1e293b', padding: '30px', borderRadius: '12px', color: '#fff', marginBottom: '30px' },
  configTitle: { fontSize: '22px', marginBottom: '20px', color: '#fff', borderBottom: '1px solid #334155', paddingBottom: '10px' },
  planHeading: { fontSize: '14px', color: '#94a3b8', marginBottom: '15px', textTransform: 'uppercase', letterSpacing: '1px' },
  label: { fontSize: '10px', fontWeight: '800', color: '#cbd5e1', display: 'block', marginBottom: '8px' },
  input: { width: '100%', padding: '12px', borderRadius: '8px', border: 'none', background: '#475569', color: '#fff', fontSize: '16px' },
  search: { padding: '10px', width: '300px', borderRadius: '8px', border: '1px solid #e2e8f0' },
  button: { marginTop: '20px', padding: '12px 30px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' },
  table: { width: '100%', borderCollapse: 'separate', borderSpacing: '0 8px' },
  th: { padding: '12px', textAlign: 'left', fontSize: '12px', color: '#64748b', textTransform: 'uppercase' },
  tr: { transition: '0.2s', background: '#fff' },
  td: { padding: '16px 12px', borderBottom: '1px solid #f1f5f9' }
};

export default SuperAdminDashboard;