import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../supabase';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

function AdminReports() {
  const [institutions, setInstitutions] = useState([]);
  const [funerals, setFunerals] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [filter, setFilter] = useState({ inst_id: '', status: 'active', funeral_id: '' });

  // 1. Calculate Totals dynamically based on filtered transactions
  const totals = useMemo(() => {
    return transactions.reduce((acc, t) => {
      const cur = t.currency || 'GHS';
      acc[cur] = (acc[cur] || 0) + Number(t.amount || 0);
      return acc;
    }, {});
  }, [transactions]);

  useEffect(() => {
    supabase.from('institutions').select('id, name').then(({ data }) => setInstitutions(data || []));
  }, []);

  useEffect(() => {
    if (!filter.inst_id) { setFunerals([]); return; }
    let query = supabase.from('funerals').select('id, full_name').eq('institution_id', filter.inst_id);
    if (filter.status !== 'all') query = query.eq('status', filter.status.toLowerCase());
    query.then(({ data }) => setFunerals(data || []));
  }, [filter.inst_id, filter.status]);

  // 2. Fetch transactions and filter out voided references
  useEffect(() => {
    if (!filter.funeral_id) { setTransactions([]); return; }
    
    const fetchReports = async () => {
      // Fetch valid transactions
      const { data: txData } = await supabase
        .from('transactions')
        .select('reference, donor_name, donor_phone, amount, currency, payment_method, created_at, funerals(full_name)')
        .eq('funeral_id', filter.funeral_id);

      // Fetch voided references
      const { data: voidData } = await supabase
        .from('voided_transactions')
        .select('reference');

      const voidRefs = new Set(voidData?.map(v => v.reference) || []);
      
      // Filter out voided transactions
      const validTransactions = (txData || []).filter(t => !voidRefs.has(t.reference));
      setTransactions(validTransactions);
    };

    fetchReports();
  }, [filter.funeral_id]);

  const exportPDF = () => {
    const doc = new jsPDF();
    const name = transactions.length > 0 ? transactions[0].funerals.full_name : "Report";
    doc.setFontSize(18);
    doc.setTextColor(41, 128, 185);
    doc.text(`Funeral Report: ${name}`, 14, 20);
    
    const summaryText = Object.entries(totals).map(([cur, amt]) => `${cur}: ${amt.toLocaleString()}`).join(' | ');
    doc.setFontSize(12);
    doc.text(`Summary: ${summaryText}`, 14, 28);

    doc.autoTable({
      startY: 35,
      head: [['Donor', 'Phone', 'Amount', 'Currency', 'Method', 'Date']],
      body: transactions.map(t => [t.donor_name, t.donor_phone, t.amount, t.currency, t.payment_method, new Date(t.created_at).toLocaleDateString()]),
      headStyles: { fillColor: [52, 73, 94] }
    });
    doc.save(`${name.replace(/\s+/g, '_')}_Report.pdf`);
  };

  return (
    <div style={{ padding: '24px', background: '#f8fafc', minHeight: '100vh' }}>
      <h2 style={{ color: '#1e293b' }}>📊 Transaction Analytics & Totals</h2>
      
      <div style={styles.filterBar}>
        <select onChange={(e) => setFilter({ ...filter, inst_id: e.target.value, funeral_id: '' })} style={styles.input}>
          <option value="">-- Select Institution --</option>
          {institutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
        <select onChange={(e) => setFilter({ ...filter, funeral_id: e.target.value })} style={styles.input}>
          <option value="">-- Select Funeral --</option>
          {funerals.map(f => <option key={f.id} value={f.id}>{f.full_name}</option>)}
        </select>
        <button onClick={exportPDF} style={styles.btn}>Export Colorful PDF</button>
      </div>

      {Object.keys(totals).length > 0 && (
        <div style={styles.summaryGrid}>
          {Object.entries(totals).map(([cur, amt]) => (
            <div key={cur} style={styles.card}>
              <div style={styles.cardLabel}>{cur} TOTAL</div>
              <div style={styles.cardValue}>{amt.toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}

      <table style={styles.table}>
        <thead>
          <tr style={{ background: '#34495e', color: '#fff' }}>
            <th style={styles.th}>Donor</th><th style={styles.th}>Phone</th><th style={styles.th}>Amount</th><th style={styles.th}>Currency</th><th style={styles.th}>Method</th><th style={styles.th}>Date</th>
          </tr>
        </thead>
        <tbody>
          {transactions.length > 0 ? transactions.map((t, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={styles.td}>{t.donor_name}</td>
              <td style={styles.td}>{t.donor_phone}</td>
              <td style={styles.td}>{t.amount?.toLocaleString()}</td>
              <td style={styles.td}>{t.currency}</td>
              <td style={styles.td}>{t.payment_method}</td>
              <td style={styles.td}>{new Date(t.created_at).toLocaleDateString()}</td>
            </tr>
          )) : (
            <tr><td colSpan="6" style={{ padding: '30px', textAlign: 'center' }}>No valid transactions found.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const styles = {
  filterBar: { display: 'flex', gap: '15px', marginBottom: '20px', background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
  input: { padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', flex: 1 },
  btn: { padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' },
  summaryGrid: { display: 'flex', gap: '15px', marginBottom: '20px' },
  card: { background: '#2563eb', padding: '20px', borderRadius: '8px', color: '#fff', minWidth: '150px' },
  cardLabel: { fontSize: '12px', opacity: 0.8 },
  cardValue: { fontSize: '24px', fontWeight: 'bold' },
  table: { width: '100%', background: '#fff', borderRadius: '8px', borderCollapse: 'collapse', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' },
  th: { padding: '15px', textAlign: 'left' },
  td: { padding: '15px' }
};

export default AdminReports;