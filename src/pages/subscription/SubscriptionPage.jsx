import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../supabase';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePaystackPayment } from 'react-paystack';

function SubscriptionPage() {
  const [institutionId, setInstitutionId] = useState(null);
  const [userEmail, setUserEmail] = useState("");
  const [fetchingRates, setFetchingRates] = useState(true);
  const [prices, setPrices] = useState({});
  const [isSuperAdmin, setIsSuperAdmin] = useState(true);
  const [isGhana, setIsGhana] = useState(true);

  const navigate = useNavigate();
  const location = useLocation();
  const PUBLIC_KEY = 'pk_live_50a719cc2fe52c445af64eb7273d85b1dbf36dde';

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
    // 1. Determine Location from Navigation State
    if (location.state?.country_code) {
      setIsGhana(location.state.country_code === 'GH');
    }

    // 2. Init Auth and Data
    const init = async () => {
      await fetchRates();
      
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email);
        // Strict SuperAdmin Check
        if (user.email === 'admin@legacycloud.com') setIsSuperAdmin(true);
        
        const { data } = await supabase.from('users').select('institution_id').eq('id', user.id).single();
        setInstitutionId(data?.institution_id);
      }
      setFetchingRates(false);
    };

    init();

    const channel = supabase.channel('schema-db-changes').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'system_global_configs' }, () => fetchRates()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchRates, location.state]);

  const handlePaymentSuccess = async (reference, planData) => {
    try {
      const { data, error } = await supabase.functions.invoke('verify-payment', {
        body: { reference: reference.reference, planData: { institution_id: institutionId, ...planData, status: 'active' } }
      });
      if (error || !data?.success) throw new Error("Payment verification failed.");
      alert('🎉 Subscription activated successfully.');
      navigate('/admin');
    } catch (err) { alert(err.message); }
  };

  if (fetchingRates) return <div style={styles.center}>Synchronizing Registry...</div>;

  const usdRate = (prices.usd_to_ghs_rate && prices.usd_to_ghs_rate > 0) ? prices.usd_to_ghs_rate : 15;

  return (
    <div style={styles.page}>
      <h1 style={styles.mainTitle}>Account Subscription Hub</h1>
      <p style={styles.subtitle}>{isSuperAdmin ? "SuperAdmin Access: Managing All Platform Plans" : "Choose your professional tier."}</p>
      
      {/* LOCAL MARKET - Show if in GH or if Admin */}
      {(isGhana || isSuperAdmin) && (
        <div style={styles.marketSection}>
          <div style={{...styles.sectionHeader, color: '#2563eb'}}>📍 LOCAL MARKET (GHS)</div>
          <div style={styles.grid}>
            <PlanCard title="Local Basic" price={prices.price_local_base || 0} currency="GHS" features={["1 Funeral Record", "SMS Notifications"]} onPay={(ref) => handlePaymentSuccess(ref, { plan_name: 'local_basic', amount: prices.price_local_base, currency: 'GHS', max_funerals: 1 })} userEmail={userEmail} publicKey={PUBLIC_KEY} />
            <PlanCard title="Business Volume" price={prices.price_business_volume || 0} currency="GHS" features={["5 Funeral Records", "Bulk Management"]} onPay={(ref) => handlePaymentSuccess(ref, { plan_name: 'business', amount: prices.price_business_volume, currency: 'GHS', max_funerals: 5 })} userEmail={userEmail} publicKey={PUBLIC_KEY} />
          </div>
        </div>
      )}

      {/* DIASPORA MARKET - Show if NOT in GH or if Admin */}
      {(!isGhana || isSuperAdmin) && (
        <div style={styles.marketSection}>
          <div style={{...styles.sectionHeader, color: '#f59e0b'}}>🌎 DIASPORA PREMIUM (GHS Equivalent)</div>
          <div style={styles.grid}>
            <PlanCard title="Diaspora Standard" price={prices.price_diaspora_base || 0} usdEquivalent={(prices.price_diaspora_base / usdRate).toFixed(2)} currency="GHS" features={["1 Funeral Record", "Intl. SMS Relay"]} onPay={(ref) => handlePaymentSuccess(ref, { plan_name: 'diaspora_std', amount: prices.price_diaspora_base, currency: 'GHS', max_funerals: 1 })} userEmail={userEmail} publicKey={PUBLIC_KEY} />
            <PlanCard title="Diaspora 5-Funeral" price={prices.price_diaspora_5_funeral || 0} usdEquivalent={(prices.price_diaspora_5_funeral / usdRate).toFixed(2)} currency="GHS" features={["5 Funeral Records", "Registry Sync"]} onPay={(ref) => handlePaymentSuccess(ref, { plan_name: 'diaspora_5', amount: prices.price_diaspora_5_funeral, currency: 'GHS', max_funerals: 5 })} userEmail={userEmail} publicKey={PUBLIC_KEY} />
          </div>
        </div>
      )}
    </div>
  );
}

function PlanCard({ title, price, usdEquivalent, currency, features, userEmail, onPay, publicKey }) {
  const initializePayment = usePaystackPayment({ 
    reference: `sub_${Date.now()}`, 
    email: userEmail, 
    amount: price * 100, 
    publicKey: publicKey,
    currency: currency 
  });
  
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
      <button style={{...styles.btn, backgroundColor: borderColor}} onClick={() => initializePayment({ onSuccess: onPay })}>Select Plan</button>
    </div>
  );
}

const styles = {
  page: { padding: '40px', maxWidth: '1000px', margin: '0 auto', fontFamily: 'Inter' },
  mainTitle: { textAlign: 'center' },
  subtitle: { textAlign: 'center', color: '#666', marginBottom: '40px' },
  marketSection: { marginBottom: '40px' },
  sectionHeader: { fontSize: '18px', fontWeight: 'bold', marginBottom: '20px', borderBottom: '2px solid #eee' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' },
  card: { padding: '25px', borderRadius: '15px', border: '1px solid #e5e7eb', background: '#fff', borderTop: '6px solid' },
  cardTitle: { marginBottom: '10px' },
  priceContainer: { marginBottom: '20px' },
  amount: { fontSize: '28px', fontWeight: 'bold' },
  cycle: { fontSize: '14px', color: '#666', marginLeft: '5px' },
  list: { listStyle: 'none', padding: 0, marginBottom: '20px' },
  btn: { padding: '12px', width: '100%', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' },
  center: { textAlign: 'center', marginTop: '100px' }
};

export default SubscriptionPage;