import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabase';
import { usePaystackPayment } from 'react-paystack';

function UpgradePlans() {
  const [institutionId, setInstitutionId] = useState(null);
  const [userEmail, setUserEmail] = useState('');
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [fetching, setFetching] = useState(true);
  const [isGhana, setIsGhana] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [prices, setPrices] = useState({
    price_local_base: 500,
    price_business_volume: 1500,
    price_diaspora_base: 100,
    price_diaspora_5_funeral: 150,
    usd_to_ghs_rate: 15
  });

  const loadData = useCallback(async () => {
    try {
      setFetching(true);
      
      // 1. Detect Location
      try {
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        setIsGhana(data.country_code === 'GH');
      } catch (err) { setIsGhana(true); }

      // 2. Fetch Config & User
      const { data: configRows } = await supabase.from('system_global_configs').select('config_key, config_value');
      if (configRows) {
        const liveRates = {};
        configRows.forEach(row => { if (row.config_key) liveRates[row.config_key.trim()] = parseFloat(row.config_value); });
        setPrices(prev => ({ ...prev, ...liveRates }));
      }
      
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email);
        if (user.email === 'admin@legacycloud.com') setIsSuperAdmin(true);
        const { data: profile } = await supabase.from('users').select('institution_id').eq('id', user.id).single();
        if (profile) setInstitutionId(profile.institution_id);
      }
    } catch (err) { console.error("Initialization Error:", err.message); }
    finally { setFetching(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  if (fetching) return <div style={styles.center}>Synchronizing Registry...</div>;

  const rate = prices.usd_to_ghs_rate || 15;

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Professional Subscription Hub</h1>
      
      {/* LOCAL MARKET */}
      <h3 style={styles.sectionHeader}>📍 Local Market</h3>
      <div style={styles.grid}>
        <PaymentPlan title="Local Basic" price={prices.price_local_base} currency="GHS" capacity="1 Funeral Record" maxFunerals={1} billingMarket="local" userEmail={userEmail} institutionId={institutionId} color="#2563eb" setLoading={setLoadingPlan} loading={loadingPlan === 'local_basic'} planKey="local_basic" />
        <PaymentPlan title="Business Volume" price={prices.price_business_volume} currency="GHS" capacity="5 Funeral Records" maxFunerals={5} billingMarket="local" userEmail={userEmail} institutionId={institutionId} color="#2563eb" setLoading={setLoadingPlan} loading={loadingPlan === 'business'} planKey="business" />
      </div>

      {/* DIASPORA MARKET */}
      {(!isGhana || isSuperAdmin) && (
        <>
          <h3 style={{...styles.sectionHeader, marginTop: '40px'}}>🌎 Diaspora Market</h3>
          <div style={styles.grid}>
            <PaymentPlan title="Diaspora Standard" price={prices.price_diaspora_base} currency="USD" capacity="1 Funeral Record" ghsEquivalent={prices.price_diaspora_base * rate} maxFunerals={1} billingMarket="diaspora" userEmail={userEmail} institutionId={institutionId} color="#f59e0b" setLoading={setLoadingPlan} loading={loadingPlan === 'diaspora_std'} planKey="diaspora_std" />
            <PaymentPlan title="Diaspora 5-Funeral" price={prices.price_diaspora_5_funeral} currency="USD" capacity="5 Funeral Records" ghsEquivalent={prices.price_diaspora_5_funeral * rate} maxFunerals={5} billingMarket="diaspora" userEmail={userEmail} institutionId={institutionId} color="#f59e0b" setLoading={setLoadingPlan} loading={loadingPlan === 'diaspora_5'} planKey="diaspora_5" />
          </div>
        </>
      )}
    </div>
  );
}

function PaymentPlan({ title, price, currency, capacity, ghsEquivalent, maxFunerals, billingMarket, userEmail, institutionId, color, setLoading, loading, planKey }) {
  const amountToCharge = billingMarket === 'diaspora' ? ghsEquivalent : price;

  const initializePayment = usePaystackPayment({
    reference: `sub_${Date.now()}`,
    email: userEmail,
    amount: amountToCharge * 100, 
    publicKey: 'pk_live_50a719cc2fe52c445af64eb7273d85b1dbf36dde',
    currency: 'GHS', 
  });

  const onSuccess = async (response) => {
    setLoading(planKey);
    const { data, error } = await supabase.functions.invoke('verify-payment', {
      body: { reference: response.reference, planData: { institution_id: institutionId, plan_name: planKey, amount: price, currency, max_funerals: maxFunerals, billing_market: billingMarket } }
    });
    if (error || !data?.success) alert("Verification Error: " + (error?.message || "Failed"));
    else { alert("Payment successful!"); window.location.reload(); }
    setLoading(null);
  };

  return (
    <div style={{ ...cardStyle, borderColor: color }}>
      <h2 style={cardTitleStyle}>{title}</h2>
      <div style={capacityStyle}>{capacity}</div>
      <div style={cardPriceStyle}>{currency} {price.toLocaleString()}</div>
      {ghsEquivalent && (
        <div style={subPriceStyle}>
          Payable: GHS {ghsEquivalent.toLocaleString()}
        </div>
      )}
      <button style={{ ...btnStyle, backgroundColor: color }} onClick={() => initializePayment({ onSuccess, onClose: () => {} })} disabled={loading}>
        {loading ? 'Processing...' : 'Select Plan'}
      </button>
    </div>
  );
}

const styles = {
  page: { padding: '40px', fontFamily: 'Inter, sans-serif', background: '#f8fafc', minHeight: '100vh', maxWidth: 1000, margin: '0 auto' },
  title: { textAlign: 'center', marginBottom: '40px' },
  sectionHeader: { textAlign: 'center', color: '#475569', marginBottom: '20px', textTransform: 'uppercase', letterSpacing: '1px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' },
  center: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }
};
const cardStyle = { background: '#fff', padding: '24px', borderRadius: '16px', border: '2px solid', display: 'flex', flexDirection: 'column' };
const cardTitleStyle = { fontSize: '20px', fontWeight: '700', marginBottom: '5px' };
const capacityStyle = { fontSize: '15px', color: '#64748b', marginBottom: '15px' };
const cardPriceStyle = { fontSize: '24px', fontWeight: '800', marginBottom: '5px' };
const subPriceStyle = { fontSize: '14px', color: '#334155', marginBottom: '15px', fontWeight: '600' };
const btnStyle = { width: '100%', padding: '12px', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' };

export default UpgradePlans;