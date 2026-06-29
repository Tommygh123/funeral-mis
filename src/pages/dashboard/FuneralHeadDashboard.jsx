import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabase';

function FuneralHeadDashboard() {
  const [transactions, setTransactions] = useState([]);
  const [funeralInfo, setFuneralInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({ GHS: 0, USD: 0, EUR: 0, GBP: 0 });

  useEffect(() => {
    async function loadDashboard() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: funeral } = await supabase
        .from('funerals')
        .select('id, full_name')
        .eq('manager_id', user.id)
        .single();

      if (funeral) {
        setFuneralInfo(funeral);

        const { data } = await supabase
          .from('transactions')
          .select('id, donor_name, amount, currency, created_at')
          .eq('funeral_id', funeral.id)
          .order('created_at', { ascending: false });

        if (data) {
          setTransactions(data);
          const calculated = { GHS: 0, USD: 0, EUR: 0, GBP: 0 };
          data.forEach(t => {
            const cur = (t.currency || '').toUpperCase();
            if (calculated.hasOwnProperty(cur)) {
              calculated[cur] += Number(t.amount || 0);
            }
          });
          setTotals(calculated);
        }
      }
      setLoading(false);
    }
    loadDashboard();
  }, []);

  if (loading) return <div style={styles.center}>Loading portal...</div>;

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Dashboard</h1>
        <p style={styles.subtitle}>{funeralInfo?.full_name || 'No Funeral Assigned'}</p>
      </header>

      {/* Responsive Grid */}
      <div className="grid-cols-2" style={{ gap: '10px', marginBottom: '20px' }}>
        {Object.entries(totals).map(([cur, val]) => (
          <div key={cur} style={styles.card}>
            <div style={styles.cardLabel}>{cur}</div>
            <div style={styles.cardValue}>{val.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </div>
        ))}
      </div>

      <div style={styles.tableCard}>
        <h3 style={styles.sectionTitle}>Recent Contributions</h3>
        <div className="table-wrapper">
          <table style={styles.table}>
            <thead>
              <tr style={styles.trHead}>
                <th style={styles.th}>Date</th>
                <th style={styles.th}>Donor</th>
                <th style={styles.th}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(t => (
                <tr key={t.id} style={styles.trBody}>
                  <td style={styles.td}>{new Date(t.created_at).toLocaleDateString()}</td>
                  <td style={styles.td}>{t.donor_name}</td>
                  <td style={styles.td}><strong>{t.currency} {Number(t.amount).toLocaleString()}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {transactions.length === 0 && <p style={styles.empty}>No contributions yet.</p>}
      </div>
    </div>
  );
}

const styles = {
  container: { padding: '16px', maxWidth: '600px', margin: '0 auto', fontFamily: 'Inter, sans-serif' },
  header: { marginBottom: '20px' },
  title: { margin: '0', color: '#1e293b', fontSize: '24px' },
  subtitle: { color: '#64748b', fontSize: '14px', marginTop: '4px' },
  // Responsive Grid: 2 columns on small, 4 on larger
  grid: { 
    display: 'grid', 
    gridTemplateColumns: 'repeat(2, 1fr)', 
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
  tableCard: { background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' },
  sectionTitle: { fontSize: '16px', marginBottom: '16px', color: '#1e293b' },
  tableWrapper: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  trHead: { background: '#f8fafc' },
  trBody: { borderBottom: '1px solid #f1f5f9' },
  th: { padding: '10px 8px', textAlign: 'left', color: '#64748b', fontSize: '11px', textTransform: 'uppercase' },
  td: { padding: '12px 8px', fontSize: '13px' },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: '20px', fontSize: '13px' },
  center: { textAlign: 'center', marginTop: '100px', color: '#64748b' }
};

export default FuneralHeadDashboard;