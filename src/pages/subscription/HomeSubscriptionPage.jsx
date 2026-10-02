import { loadPlanSettings, resolvePlanAudience } from '../../utils/subscriptionConfig';
import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../supabase';
import { useLocation } from 'react-router-dom';

function HomeSubscriptionPage() {
  const [fetchingRates, setFetchingRates] = useState(true);
  const [audienceReady,setAudienceReady] = useState(false);
  const [prices, setPrices] = useState({});
  const [loadError, setLoadError] = useState('');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isGhana, setIsGhana] = useState(true);

  const location = useLocation();

  const fetchRates = useCallback(async () => {
    try { setPrices(await loadPlanSettings()); setLoadError(''); }
    catch (err) { setLoadError(err.message); }
  }, []);

  useEffect(() => {
    let alive = true;
    const init = async () => {
      setFetchingRates(true);
      try {
        const [settings,audience] = await Promise.all([loadPlanSettings(),resolvePlanAudience(location.state?.country_code)]);
        if (!alive) return;
        setPrices(settings); setIsGhana(audience.isGhana); setIsSuperAdmin(audience.isSuperAdmin); setAudienceReady(true);
        
        setLoadError('');
      } catch(err) { if(alive) setLoadError(err.message); }
      finally { if(alive) setFetchingRates(false); }
    };
    init();
    const channel = supabase.channel('plans-'+Math.random()).on('postgres_changes',{event:'*',schema:'public',table:'system_global_configs'},fetchRates).subscribe();
    const onFocus = () => fetchRates(); window.addEventListener('focus',onFocus);
    return () => { alive=false; supabase.removeChannel(channel); window.removeEventListener('focus',onFocus); };
  }, [fetchRates, location.state]);

  if (fetchingRates) return <div style={styles.center}>Loading LegacyCloud Plan Information...</div>;

  if (loadError || !audienceReady) return <div style={styles.center}><p role="alert">{loadError || 'Unable to identify your account market. Please retry.'}</p><button onClick={()=>window.location.reload()}>Retry</button></div>;

  const usdRate = prices.usd_to_ghs_rate;

  return (
    <div style={styles.page}>
      <h1 style={styles.mainTitle}>Subscription Plan Information</h1>
      <p style={styles.subtitle}>Explore our transparent regional tiers designed for your institutional needs.</p>
      
      {(isGhana || isSuperAdmin) && (
        <div style={styles.marketSection}>
          <div style={{...styles.sectionHeader, color: '#2563eb'}}>📍 LOCAL MARKET (GHS)</div>
          <div style={styles.grid}>
            <InfoCard title="Local Basic" price={prices.price_local_base} currency="GHS" features={["1 Funeral Record", "SMS Notifications"]} />
            <InfoCard title="Business Volume" price={prices.price_business_volume} currency="GHS" features={["5 Funeral Records", "Bulk Management"]} />
          </div>
        </div>
      )}

      {(!isGhana || isSuperAdmin) && (
        <div style={styles.marketSection}>
          <div style={{...styles.sectionHeader, color: '#f59e0b'}}>🌎 DIASPORA PREMIUM (GHS Equivalent)</div>
          <div style={styles.grid}>
            <InfoCard title="Diaspora Standard" price={prices.price_diaspora_base} usdEquivalent={(prices.price_diaspora_base / usdRate).toFixed(2)} currency="GHS" features={["1 Funeral Record", "Intl. SMS Relay"]} />
            <InfoCard title="Diaspora 5-Funeral" price={prices.price_diaspora_5_funeral} usdEquivalent={(prices.price_diaspora_5_funeral / usdRate).toFixed(2)} currency="GHS" features={["5 Funeral Records", "Registry Sync"]} />
          </div>
        </div>
      )}
      {(!isGhana || isSuperAdmin) && <p style={{fontSize:12,color:'#64748b'}}><a href="https://www.exchangerate-api.com" target="_blank" rel="noreferrer">Rates by ExchangeRate-API</a> • USD equivalents use the saved daily reference rate.</p>}
    </div>
  );
}

function InfoCard({ title, price, usdEquivalent, currency, features }) {
  const isDiaspora = !!usdEquivalent;
  const borderColor = isDiaspora ? '#f59e0b' : '#2563eb';

  return (
    <div style={{...styles.card, borderColor: borderColor, borderTopWidth: '6px'}}>
      <h3 style={styles.cardTitle}>{title}</h3>
      <div style={styles.priceContainer}>
        <span style={styles.amount}>{currency} {price.toLocaleString()}</span>
        {isDiaspora && <div style={{ fontSize: '14px', color: '#555' }}>(≈ ${usdEquivalent} USD)</div>}
        <span style={styles.cycle}>/ Cycle</span>
      </div>
      <ul style={styles.list}>{features.map((f, i) => <li key={i}>✓ {f}</li>)}</ul>
    </div>
  );
}

const styles = {
  page: { padding: '40px', maxWidth: '1000px', margin: '0 auto', fontFamily: 'Inter' },
  mainTitle: { textAlign: 'center', color: '#1e293b' },
  subtitle: { textAlign: 'center', color: '#64748b', marginBottom: '40px' },
  marketSection: { marginBottom: '40px' },
  sectionHeader: { fontSize: '18px', fontWeight: 'bold', marginBottom: '20px', borderBottom: '2px solid #e2e8f0', paddingBottom: '10px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' },
  card: { padding: '25px', borderRadius: '15px', border: '1px solid #e5e7eb', background: '#fff', borderTop: '6px solid' },
  cardTitle: { marginBottom: '10px', color: '#1e293b' },
  priceContainer: { marginBottom: '20px' },
  amount: { fontSize: '28px', fontWeight: 'bold', color: '#1e293b' },
  cycle: { fontSize: '14px', color: '#64748b', marginLeft: '5px' },
  list: { listStyle: 'none', padding: 0, marginBottom: '20px', color: '#475569' },
  center: { textAlign: 'center', marginTop: '100px' }
};

export default HomeSubscriptionPage;