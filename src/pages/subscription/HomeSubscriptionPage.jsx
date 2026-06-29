import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../supabase';
import { useLocation } from 'react-router-dom';

function HomeSubscriptionPage() {
  const [fetchingRates, setFetchingRates] = useState(true);
  const [prices, setPrices] = useState({});
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isGhana, setIsGhana] = useState(true);

  const location = useLocation();

  const fetchRates = useCallback(async () => {
    try {
      const { data: configRows } = await supabase.from('system_global_configs').select('config_key, config_value');
      if (configRows) {
        const liveRates = {};
        configRows.forEach(row => {
          const parsed = parseFloat(row.config_value);
          if (!isNaN(parsed)) liveRates[row.config_key] = parsed;
        });
        setPrices(liveRates);
      }
    } catch (err) { console.error("Error fetching rates:", err); }
  }, []);

  useEffect(() => {
    // Determine Location: Priority to navigation state, fallback to detected Ghana
    if (location.state?.country_code) {
      setIsGhana(location.state.country_code === 'GH');
    }

    const init = async () => {
      await fetchRates();
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email === 'admin@legacycloud.com') setIsSuperAdmin(true);
      setFetchingRates(false);
    };

    init();

    const channel = supabase.channel('schema-db-changes').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'system_global_configs' }, () => fetchRates()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchRates, location.state]);

  if (fetchingRates) return <div style={styles.center}>Loading LegacyCloud Plan Information...</div>;

  const usdRate = (prices.usd_to_ghs_rate && prices.usd_to_ghs_rate > 0) ? prices.usd_to_ghs_rate : 15;

  return (
    <div style={styles.page}>
      <h1 style={styles.mainTitle}>Subscription Plan Information</h1>
      <p style={styles.subtitle}>Explore our transparent regional tiers designed for your institutional needs.</p>
      
      {(isGhana || isSuperAdmin) && (
        <div style={styles.marketSection}>
          <div style={{...styles.sectionHeader, color: '#2563eb'}}>📍 LOCAL MARKET (GHS)</div>
          <div style={styles.grid}>
            <InfoCard title="Local Basic" price={prices.price_local_base || 0} currency="GHS" features={["1 Funeral Record", "SMS Notifications"]} />
            <InfoCard title="Business Volume" price={prices.price_business_volume || 0} currency="GHS" features={["5 Funeral Records", "Bulk Management"]} />
          </div>
        </div>
      )}

      {(!isGhana || isSuperAdmin) && (
        <div style={styles.marketSection}>
          <div style={{...styles.sectionHeader, color: '#f59e0b'}}>🌎 DIASPORA PREMIUM (GHS Equivalent)</div>
          <div style={styles.grid}>
            <InfoCard title="Diaspora Standard" price={prices.price_diaspora_base || 0} usdEquivalent={(prices.price_diaspora_base / usdRate).toFixed(2)} currency="GHS" features={["1 Funeral Record", "Intl. SMS Relay"]} />
            <InfoCard title="Diaspora 5-Funeral" price={prices.price_diaspora_5_funeral || 0} usdEquivalent={(prices.price_diaspora_5_funeral / usdRate).toFixed(2)} currency="GHS" features={["5 Funeral Records", "Registry Sync"]} />
          </div>
        </div>
      )}
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