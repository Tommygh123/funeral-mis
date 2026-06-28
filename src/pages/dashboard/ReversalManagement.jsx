import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';

function ReversalManagement() {
  const [searchMode, setSearchMode] = useState('reference');
  const [searchTerm, setSearchTerm] = useState('');
  const [transaction, setTransaction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [institutionId, setInstitutionId] = useState(null);

  useEffect(() => {
    const getSession = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('users').select('institution_id').eq('id', user.id).single();
        if (data) setInstitutionId(data.institution_id);
      }
    };
    getSession();
  }, []);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchTerm.trim() || !institutionId) return;
    
    setLoading(true);
    setMessage({ type: '', text: '' });
    setTransaction(null);
    
    try {
      let query = supabase.from('transactions').select('*').eq('institution_id', institutionId);
      
      if (searchMode === 'reference') {
        const { data, error } = await query.eq('reference', searchTerm.trim()).maybeSingle();
        if (error || !data) {
          setMessage({ type: 'error', text: 'No record found for this reference.' });
        } else {
          setTransaction(data);
        }
      } else {
        const normalizedPhone = searchTerm.trim().replace(/^0+/, '');
        const { data, error } = await query.ilike('donor_phone', `%${normalizedPhone}%`);
        
        if (error || !data || data.length === 0) {
          setMessage({ type: 'error', text: 'No records found for this phone number.' });
        } else if (data.length > 1) {
          setTransaction(data[0]);
          setMessage({ type: 'success', text: `Found ${data.length} records. Showing the most recent one.` });
        } else {
          setTransaction(data[0]);
        }
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'An unexpected error occurred.' });
    } finally {
      setLoading(false);
    }
  };

  const handleReverse = async () => {
    if (!transaction) return;
    const confirmAction = window.confirm(`PERMANENTLY DELETE this transaction of ${transaction.amount} ${transaction.currency} from ${transaction.donor_name}? This action cannot be undone.`);
    if (!confirmAction) return;

    setLoading(true);
    try {
      // Hard delete from transactions table
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', transaction.id)
        .eq('institution_id', institutionId);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Transaction entry successfully deleted.' });
      setTransaction(null);
      setSearchTerm('');
    } catch (err) {
      setMessage({ type: 'error', text: 'Delete Error: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: '800px', padding: '20px' }}>
      <h2>Supervisor Entry Reversal Desk</h2>
      
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button onClick={() => { setSearchMode('reference'); setTransaction(null); }} style={modeButtonStyle(searchMode === 'reference')}>Search by Reference</button>
        <button onClick={() => { setSearchMode('phone'); setTransaction(null); }} style={modeButtonStyle(searchMode === 'phone')}>Search by Phone</button>
      </div>

      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        <input 
          type="text"
          placeholder={searchMode === 'reference' ? "e.g., REC-260610-0011" : "e.g., 244228546"}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
        />
        <button type="submit" disabled={loading} style={searchButtonStyle}>
          {loading ? 'Searching...' : 'Locate Entry'}
        </button>
      </form>

      {message.text && (
        <div style={{ padding: '14px', borderRadius: '8px', marginBottom: '20px', background: message.type === 'error' ? '#fef2f2' : '#f0fdf4', color: message.type === 'error' ? '#991b1b' : '#166534' }}>
          {message.text}
        </div>
      )}

      {transaction && (
        <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <h3>Record Found</h3>
          <p><strong>Donor:</strong> {transaction.donor_name}</p>
          <p><strong>Amount:</strong> {transaction.amount} {transaction.currency}</p>
          <p><strong>Reference:</strong> {transaction.reference}</p>
          <button onClick={handleReverse} style={reverseButtonStyle}>Permanently Delete Entry</button>
        </div>
      )}
    </div>
  );
}

const modeButtonStyle = (active) => ({
  padding: '8px 16px',
  borderRadius: '20px',
  border: 'none',
  background: active ? '#0f172a' : '#e2e8f0',
  color: active ? '#fff' : '#475569',
  cursor: 'pointer',
  fontWeight: '600'
});

const searchButtonStyle = { padding: '12px 24px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' };
const reverseButtonStyle = { width: '100%', padding: '14px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '700' };

export default ReversalManagement;