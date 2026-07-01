import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';

// Expanded list of international codes
const internationalCodes = [
  { code: '+233', label: '🇬🇭 Ghana (+233)' }, { code: '+234', label: '🇳🇬 Nigeria (+234)' },
  { code: '+27', label: '🇿🇦 South Africa (+27)' }, { code: '+254', label: '🇰🇪 Kenya (+254)' },
  { code: '+1', label: '🇺🇸 USA/CAN (+1)' }, { code: '+44', label: '🇬🇧 UK (+44)' },
  { code: '+49', label: '🇩🇪 Germany (+49)' }, { code: '+31', label: '🇳🇱 Netherlands (+31)' },
  { code: '+33', label: '🇫🇷 France (+33)' }, { code: '+34', label: '🇪🇸 Spain (+34)' },
  { code: '+351', label: '🇵🇹 Portugal (+351)' }, { code: '+39', label: '🇮🇹 Italy (+39)' },
  { code: '+32', label: '🇧🇪 Belgium (+32)' }, { code: '+61', label: '🇦🇺 Australia (+61)' },
  { code: '+41', label: '🇨🇭 Switzerland (+41)' }, { code: '+46', label: '🇸🇪 Sweden (+46)' },
  { code: '+47', label: '🇳🇴 Norway (+47)' }, { code: '+971', label: '🇦🇪 UAE (+971)' },
  { code: '+852', label: '🇭🇰 Hong Kong (+852)' }
];

function ReceiptSearch() {
  const [searchType, setSearchType] = useState('donor_name'); 
  const [searchQuery, setSearchQuery] = useState('');
  const [countryCode, setCountryCode] = useState('+233');
  
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [instId, setInstId] = useState(null);

  useEffect(() => {
    const fetchUserInst = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from('users').select('institution_id').eq('id', user.id).single();
      if (profile) setInstId(profile.institution_id);
    };
    fetchUserInst();
  }, []);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!instId) return;

    const finalQuery = searchType === 'donor_phone' 
      ? `${countryCode}${searchQuery.trim()}` 
      : searchQuery.trim();

    if (!finalQuery) return;

    try {
      setLoading(true);
      setSelectedReceipt(null);

      // 1. Fetch transactions
      let query = supabase
        .from('transactions')
        .select(`*, funerals ( full_name, photo_url, institutions ( name, phone, logo_url ) )`)
        .eq('institution_id', instId);

      if (searchType === 'donor_name') query = query.ilike('donor_name', `%${finalQuery}%`);
      else if (searchType === 'donor_phone') query = query.eq('donor_phone', finalQuery);
      else if (searchType === 'reference') query = query.eq('reference', finalQuery);

      const { data: txData, error: txError } = await query.order('created_at', { ascending: false });
      if (txError) throw txError;

      // 2. Fetch voided references
      const { data: voidedData, error: voidedError } = await supabase.from('voided_transactions').select('reference');
      if (voidedError) throw voidedError;

      const voidedRefs = new Set(voidedData.map(v => v.reference));

      // 3. Filter out voided
      const filtered = (txData || []).filter(tx => !voidedRefs.has(tx.reference));

      if (filtered.length === 0) alert("No valid transactions found.");
      setTransactions(filtered);
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVoidEntry = async () => {
    if (!selectedReceipt) return;
    const confirmVoid = window.confirm("Are you sure you want to mark this entry as VOID?");
    if (!confirmVoid) return;

    try {
      const { error } = await supabase
        .from('voided_transactions')
        .insert([{ reference: selectedReceipt.reference, reason: 'Cashier override via search' }]);

      if (error) throw error;
      alert("Receipt has been marked as void.");
      setSelectedReceipt(null);
      setTransactions([]);
    } catch (err) {
      alert("Error marking as void: " + err.message);
    }
  };

  const groupedTransactions = transactions.reduce((acc, tx) => {
    const key = tx.funerals?.full_name || 'Unassigned/General';
    if (!acc[key]) acc[key] = [];
    acc[key].push(tx);
    return acc;
  }, {});

  return (
    <div style={container}>
      <div className="no-print" style={searchSection}>
        <h3 style={title}>🔍 Search & Reprint</h3>
        <form onSubmit={handleSearch} style={searchForm}>
          <div style={radioGroup}>
            <label style={radioLabel}><input type="radio" name="st" checked={searchType === 'donor_name'} onChange={() => setSearchType('donor_name')} /> Name</label>
            <label style={radioLabel}><input type="radio" name="st" checked={searchType === 'donor_phone'} onChange={() => setSearchType('donor_phone')} /> Phone</label>
            <label style={radioLabel}><input type="radio" name="st" checked={searchType === 'reference'} onChange={() => setSearchType('reference')} /> Reference</label>
          </div>

          <div style={inputRow}>
            {searchType === 'donor_phone' && (
              <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)} style={selectField}>
                {internationalCodes.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
            )}
            <input type="text" placeholder={`Enter ${searchType.replace('_', ' ')}...`} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={inputField} />
            <button type="submit" style={searchBtn}>{loading ? 'Searching...' : 'Search'}</button>
          </div>
        </form>

        {transactions.length > 0 && (
          <div style={resultsBox}>
            {Object.entries(groupedTransactions).map(([funeralName, txList]) => (
              <div key={funeralName} style={{ marginBottom: '20px' }}>
                <h4 style={{ margin: '15px 0 5px 0', color: '#1f2937', borderBottom: '2px solid #e5e7eb', paddingBottom: '5px' }}>
                  {funeralName}
                </h4>
                <table style={table}>
                  <thead><tr><th style={th}>Ref</th><th style={th}>Donor</th><th style={th}>Amount</th><th style={th}>Action</th></tr></thead>
                  <tbody>
                    {txList.map((tx) => (
                      <tr key={tx.id}>
                        <td style={td}>{tx.reference}</td>
                        <td style={td}>{tx.donor_name}</td>
                        <td style={td}>{tx.currency} {Number(tx.amount).toFixed(2)}</td>
                        <td style={td}><button onClick={() => setSelectedReceipt(tx)} style={viewBtn}>View</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedReceipt && (
        <div style={receiptCanvas}>
           <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px', justifyContent: 'center' }}>
             <button onClick={() => window.print()} style={printActionBtn}>🖨️ Print</button>
             <button onClick={handleVoidEntry} style={voidActionBtn}>❌ Mark as Void</button>
             <button onClick={() => { setSelectedReceipt(null); setTransactions([]); }} style={newSearchBtn}>🔄 New Search</button>
           </div>
           
           <div style={thermalSlip} className="print-area">
              <div style={instHeaderWrapper}>
                {selectedReceipt.funerals?.institutions?.logo_url && <img src={selectedReceipt.funerals.institutions.logo_url} alt="Logo" style={brandLogoStyle} />}
                <h2 style={slipBrand}>{selectedReceipt.funerals?.institutions?.name}</h2>
                <p style={slipSub}>{selectedReceipt.funerals?.institutions?.phone}</p>
              </div>
              <hr style={divider} />
              {selectedReceipt.funerals?.photo_url && <div style={{textAlign:'center', marginBottom:10}}><img src={selectedReceipt.funerals.photo_url} alt="Deceased" style={deceasedPhotoStyle} /></div>}
              <div style={slipHeader}>
                <p style={slipSub}>IN MEMORY OF</p>
                <h3 style={{ margin: '5px 0', fontSize: '14px', textTransform: 'uppercase' }}>{selectedReceipt.funerals?.full_name}</h3>
              </div>
              <hr style={divider} />
              <div style={slipRow}><span>Ref:</span><strong>{selectedReceipt.reference}</strong></div>
              <div style={slipRow}><span>Donor:</span><strong>{selectedReceipt.donor_name}</strong></div>
              <div style={slipRow}><span>Donated To:</span><strong>{selectedReceipt.recipient_name || '-'}</strong></div>
              {selectedReceipt.recipient_relation && (
                <div style={slipRow}><span>Relation:</span><strong>{selectedReceipt.recipient_relation}</strong></div>
              )}
              <div style={slipRow}><span>Paid:</span><strong>{selectedReceipt.currency} {Number(selectedReceipt.amount).toFixed(2)}</strong></div>
              <div style={slipFooter}><p>Powered by LegacyCloud</p></div>
           </div>
        </div>
      )}
    </div>
  );
}

const container = { padding: '20px', maxWidth: '500px', margin: '0 auto' };
const searchSection = { background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' };
const title = { margin: '0 0 16px 0', fontSize: '20px', color: '#1f2937' };
const searchForm = { display: 'flex', flexDirection: 'column', gap: '15px' };
const radioGroup = { display: 'flex', gap: '15px', marginBottom: '5px' };
const radioLabel = { display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '14px' };
const inputRow = { display: 'flex', gap: '8px' };
const selectField = { padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#f9fafb' };
const inputField = { flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db' };
const searchBtn = { padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 };
const resultsBox = { marginTop: '20px', borderTop: '1px solid #e5e7eb', paddingTop: '15px' };
const table = { width: '100%', borderCollapse: 'collapse' };
const th = { textAlign: 'left', padding: '8px', color: '#6b7280', fontSize: '12px' };
const td = { padding: '8px', borderBottom: '1px solid #f3f4f6', fontSize: '14px' };
const viewBtn = { padding: '4px 10px', background: '#e5e7eb', border: 'none', borderRadius: '4px', cursor: 'pointer' };
const receiptCanvas = { marginTop: '30px', display: 'flex', flexDirection: 'column', alignItems: 'center' };
const printActionBtn = { padding: '10px 20px', background: '#059669', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' };
const voidActionBtn = { padding: '10px 20px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' };
const newSearchBtn = { padding: '10px 20px', background: '#64748b', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' };
const thermalSlip = { width: '80mm', background: '#fff', padding: '20px', border: '1px solid #ccc', fontFamily: 'Arial' };
const instHeaderWrapper = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' };
const brandLogoStyle = { width: '50px', height: '50px', objectFit: 'contain' };
const deceasedPhotoStyle = { width: '70px', height: '70px', objectFit: 'cover', borderRadius: '50%' };
const slipHeader = { textAlign: 'center' };
const slipBrand = { margin: 0, fontSize: 15, textTransform: 'uppercase' };
const slipSub = { margin: 0, fontSize: 12, fontWeight: 'bold' };
const slipRow = { display: 'flex', justifyContent: 'space-between', marginBottom: '5px' };
const divider = { borderTop: '1px dashed #000', margin: '10px 0' };
const slipFooter = { textAlign: 'center', marginTop: '15px', fontSize: '11px' };

export default ReceiptSearch;