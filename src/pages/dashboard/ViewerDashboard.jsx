import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabase';

function ViewerDashboard() {
  const [stats, setStats] = useState({ 
    totalGHS: 0, 
    totalUSD: 0, 
    totalGBP: 0, 
    activeFunerals: 0 
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadGlobalMetrics() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from('users')
          .select('institution_id')
          .eq('id', user.id)
          .single();
        
        // 1. Fetch Active Funerals Count for the specific institution
        const { count } = await supabase
          .from('funerals')
          .select('*', { count: 'exact', head: true })
          .eq('institution_id', profile.institution_id);
        
        // 2. Fetch cumulative calculations for the institution
        const { data: txns } = await supabase
          .from('transactions')
          .select('amount, currency')
          .eq('institution_id', profile.institution_id);
        
        let ghs = 0, usd = 0, gbp = 0;
        txns?.forEach(t => {
          if (t.currency === 'GHS') ghs += Number(t.amount || 0);
          if (t.currency === 'USD') usd += Number(t.amount || 0);
          if (t.currency === 'GBP') gbp += Number(t.amount || 0);
        });

        setStats({ 
          totalGHS: ghs, 
          totalUSD: usd, 
          totalGBP: gbp, 
          activeFunerals: count || 0 
        });
      } catch (err) {
        console.error("Dashboard Load Error:", err);
      } finally {
        setLoading(false);
      }
    }
    loadGlobalMetrics();
  }, []);

  if (loading) return <div style={styles.loadingState}>Loading Analytics Ledger...</div>;

  return (
    <div style={styles.pageContainer}>
      <div style={styles.header}>
        <h1 style={styles.title}>Executive Oversight Panel</h1>
        <p style={styles.subtitle}>Read-only real-time institutional cash reserves overview context.</p>
      </div>

      <div style={styles.grid}>
        <div style={styles.card}>
          <span style={styles.label}>Tracked Funerals</span>
          <div style={styles.val}>{stats.activeFunerals} Active</div>
        </div>
        <div style={styles.card}>
          <span style={styles.label}>Total GHS Value</span>
          <div style={{ ...styles.val, color: '#16a34a' }}>₵{stats.totalGHS.toLocaleString()}</div>
        </div>
        <div style={styles.card}>
          <span style={styles.label}>Total USD Value</span>
          <div style={{ ...styles.val, color: '#2563eb' }}>${stats.totalUSD.toLocaleString()}</div>
        </div>
        <div style={styles.card}>
          <span style={styles.label}>Total GBP Value</span>
          <div style={{ ...styles.val, color: '#9333ea' }}>£{stats.totalGBP.toLocaleString()}</div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  pageContainer: { fontFamily: 'system-ui, sans-serif', padding: '20px' },
  header: { marginBottom: '24px' },
  title: { margin: 0, fontSize: '1.75rem', color: '#0f172a' },
  subtitle: { color: '#64748b', margin: '4px 0 0 0' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' },
  card: { background: '#fff', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' },
  label: { fontSize: '0.875rem', color: '#64748b', fontWeight: '500' },
  val: { fontSize: '1.75rem', fontWeight: '700', marginTop: '8px', color: '#0f172a' },
  loadingState: { padding: '40px', textAlign: 'center', color: '#64748b' }
};

export default ViewerDashboard;