import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabase';

function FuneralHeadReports() {
  const [transactions, setTransactions] = useState([]);
  const [funeral, setFuneral] = useState(null);
  const [loading, setLoading] = useState(true);
  const [groupedData, setGroupedData] = useState({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: funeralData } = await supabase
        .from('funerals')
        .select('*')
        .eq('manager_id', user.id)
        .single();

      if (!funeralData) throw new Error("No funeral linked to this account.");
      setFuneral(funeralData);

      // Fetch transactions: filter out 'void' status
      const { data: txns } = await supabase
        .from('transactions')
        .select('*')
        .eq('funeral_id', funeralData.id)
        .neq('status', 'void') // Filter out voided records
        .order('created_at', { ascending: false });

      const validTxns = txns || [];
      setTransactions(validTxns);

      // Group by Payment Method
      const groups = validTxns.reduce((acc, t) => {
        const method = t.payment_method || 'Uncategorized';
        if (!acc[method]) acc[method] = { total: 0, currency: t.currency };
        acc[method].total += Number(t.amount || 0);
        return acc;
      }, {});
      
      setGroupedData(groups);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={styles.center}>Loading Report...</div>;

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>{funeral?.full_name}</h1>
        <p style={styles.subtitle}>Reconciliation Report (Excluding Voided Entries)</p>
      </header>

      {/* Grouped Stats Cards */}
      <div style={styles.grid}>
        {Object.entries(groupedData).map(([method, data]) => (
          <div key={method} style={styles.card}>
            <span style={styles.cardLabel}>{method.toUpperCase()}</span>
            <h2 style={styles.cardValue}>
              {data.currency} {data.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </h2>
          </div>
        ))}
      </div>

      <div className="table-wrapper" style={styles.tableCard}>
        <table style={styles.table}>
          <thead>
            <tr style={styles.thead}>
              <th style={styles.th}>Donor</th>
              <th style={styles.th}>Amount</th>
              <th style={styles.th}>Method</th>
              <th style={styles.th}>Date</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map(t => (
              <tr key={t.id} style={styles.tr}>
                <td style={styles.td}>{t.donor_name}</td>
                <td style={styles.td}><strong>{t.currency} {Number(t.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></td>
                <td style={styles.td}>{t.payment_method}</td>
                <td style={styles.td}>{new Date(t.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const styles = {
  container: { padding: '20px', fontFamily: 'Inter, sans-serif', background: '#f8fafc', minHeight: '100vh' },
  header: { marginBottom: '30px' },
  title: { margin: 0, color: '#1e293b' },
  subtitle: { color: '#64748b' },
  grid: { display: 'flex', gap: '20px', marginBottom: '30px', flexWrap: 'wrap' },
  // Updated Stats Card Color (Slate/Blue theme)
  card: { 
    background: '#1e293b', // Deep Slate background
    padding: '20px', 
    borderRadius: '12px', 
    minWidth: '200px',
    color: '#fff'
  },
  cardLabel: { fontSize: '11px', color: '#94a3b8', fontWeight: 'bold', letterSpacing: '0.05em' },
  cardValue: { margin: '8px 0 0 0', fontSize: '22px' },
  tableCard: { background: '#fff', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
  table: { width: '100%', borderCollapse: 'collapse' },
  thead: { background: '#f1f5f9', borderBottom: '1px solid #e2e8f0' },
  th: { padding: '16px', textAlign: 'left', color: '#475569', fontSize: '12px', textTransform: 'uppercase' },
  td: { padding: '16px', borderBottom: '1px solid #f1f5f9', color: '#334155' },
  center: { display: 'flex', height: '50vh', alignItems: 'center', justifyContent: 'center' }
};

export default FuneralHeadReports;