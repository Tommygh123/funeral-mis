import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabase';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function Reports() {
  const [funerals, setFunerals] = useState([]);
  const [selectedFuneral, setSelectedFuneral] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { init(); }, []);

  const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from('users').select('institution_id').eq('id', user.id).single();
    const { data: funeralData } = await supabase
      .from('funerals')
      .select('id, full_name, status')
      .eq('institution_id', profile?.institution_id)
      .eq('status', 'active');
    setFunerals(funeralData || []);
    if (funeralData?.length > 0) {
      setSelectedFuneral(funeralData[0].id);
      loadTransactions(funeralData[0].id);
    }
  };

  const loadTransactions = async (funeralId) => {
    setLoading(true);
    const { data: txns } = await supabase.from('transactions').select('*').eq('funeral_id', funeralId);
    const { data: voids } = await supabase.from('voided_transactions').select('reference');
    const voidRefs = new Set(voids?.map(v => v.reference) || []);
    setTransactions((txns || []).filter(t => !voidRefs.has(t.reference)));
    setLoading(false);
  };

  // Totals for Stats Cards
  const totals = { GHS: 0, USD: 0, EUR: 0, GBP: 0 };
  transactions.forEach(t => { totals[(t.currency || 'GHS').toUpperCase()] += Number(t.amount || 0); });

  const grouped = transactions.reduce((acc, t) => {
    const method = (t.payment_method || 'UNSPECIFIED').toUpperCase();
    if (!acc[method]) acc[method] = [];
    acc[method].push(t);
    return acc;
  }, {});

  const exportExcel = () => {
    const excelData = transactions.map(t => ({ Donor: t.donor_name, Phone: t.donor_phone, Recipient: t.recipient_name, Currency: t.currency, Amount: t.amount, Method: t.payment_method, Date: formatDate(t.created_at) }));
    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    XLSX.writeFile(wb, `Funeral_Report.xlsx`);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    const funeral = funerals.find(f => f.id === selectedFuneral);
    doc.setFontSize(18); doc.text(`Report: ${funeral?.full_name || 'Funeral'}`, 14, 20);
    doc.setFontSize(10); doc.text(`Generated: ${formatDate(new Date())}`, 14, 26);
    
    let currentY = 40;
    Object.keys(grouped).forEach(method => {
      const modeTotal = grouped[method].reduce((sum, t) => sum + Number(t.amount), 0);
      doc.setFontSize(12); doc.setFillColor(240, 240, 240); doc.rect(14, currentY, 180, 8, 'F');
      doc.text(`Payment Mode: ${method}`, 16, currentY + 6);
      
      autoTable(doc, { 
        startY: currentY + 10, 
        head: [['DONOR', 'RECIPIENT', 'PHONE', 'AMOUNT', 'DATE']], 
        body: [...grouped[method].map(t => [t.donor_name, t.recipient_name, t.donor_phone, `${t.currency} ${t.amount}`, formatDate(t.created_at)]), 
               ['', '', '', `TOTAL: ${modeTotal.toFixed(2)}`, '']] 
      });
      currentY = doc.lastAutoTable.finalY + 10;
    });

    doc.setFontSize(10); doc.text('DECLARATION: Verified and Reconciled.', 14, currentY + 10);
    doc.line(14, currentY + 30, 80, currentY + 30); doc.text('Institution Rep', 14, currentY + 36);
    doc.line(120, currentY + 30, 190, currentY + 30); doc.text('Family Head', 120, currentY + 36);
    doc.save(`${funeral?.full_name || 'Funeral'}_Report.pdf`);
  };

  return (
    <div style={{ padding: 25, background: '#f8fafc', minHeight: '100vh' }}>
      <div className="flex-between-wrap" style={{ marginBottom: 20 }}>
        <h1>Funeral Reports</h1>
        <div className="flex-row-wrap">
          <button onClick={exportExcel} style={{ background: '#16a34a', color: '#fff', padding: '10px 20px', borderRadius: 8, border: 0, marginRight: 10, cursor: 'pointer' }}>Excel</button>
          <button onClick={exportPDF} style={{ background: '#dc2626', color: '#fff', padding: '10px 20px', borderRadius: 8, border: 0, cursor: 'pointer' }}>PDF</button>
        </div>
      </div>

      {/* Colored Stats Cards */}
      <div className="grid-cols-4" style={{ gap: 15, marginBottom: 25 }}>
        {[['GHS', '#dcfce7', '#166534'], ['USD', '#dbeafe', '#1e40af'], ['EUR', '#fef3c7', '#92400e'], ['GBP', '#f3e8ff', '#6b21a8']].map(([cur, bg, text]) => (
          <div key={cur} style={{ background: bg, color: text, padding: 20, borderRadius: 10, borderLeft: `6px solid ${text}` }}>
            <p style={{ margin: 0, fontWeight: 'bold' }}>Total {cur}</p>
            <h2 style={{ margin: '5px 0 0' }}>{totals[cur].toFixed(2)}</h2>
          </div>
        ))}
      </div>

      <select value={selectedFuneral} onChange={(e) => { setSelectedFuneral(e.target.value); loadTransactions(e.target.value); }} style={{ width: '100%', padding: 15, borderRadius: 8, marginBottom: 20 }}>
        {funerals.map(f => <option key={f.id} value={f.id}>{f.full_name}</option>)}
      </select>

      {Object.keys(grouped).map(method => {
        const modeTotal = grouped[method].reduce((sum, t) => sum + Number(t.amount), 0);
        return (
          <div key={method} style={{ background: '#fff', borderRadius: 10, marginBottom: 25, overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <h3 style={{ background: '#0b1f3a', color: '#fff', margin: 0, padding: 15 }}>Payment Mode: {method}</h3>
            <div className="table-wrapper">
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead><tr style={{ background: '#f1f5f9' }}><th style={{ padding: 12 }}>Donor</th><th style={{ padding: 12 }}>Recipient</th><th style={{ padding: 12 }}>Phone</th><th style={{ padding: 12 }}>Amount</th><th style={{ padding: 12 }}>Date</th></tr></thead>
              <tbody>{grouped[method].map(t => <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}><td style={{ padding: 12 }}>{t.donor_name}</td><td style={{ padding: 12 }}>{t.recipient_name}</td><td style={{ padding: 12 }}>{t.donor_phone}</td><td style={{ padding: 12 }}>{t.currency} {Number(t.amount).toFixed(2)}</td><td style={{ padding: 12 }}>{formatDate(t.created_at)}</td></tr>)}</tbody>
              <tfoot><tr style={{ background: '#f8fafc', fontWeight: 'bold' }}><td colSpan="3" style={{ padding: 12 }}>SUB-TOTAL ({method})</td><td colSpan="2" style={{ padding: 12 }}>{modeTotal.toFixed(2)}</td></tr></tfoot>
            </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default Reports;