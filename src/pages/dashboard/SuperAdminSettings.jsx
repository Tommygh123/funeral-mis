import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabase';

function SuperAdminSettings() {
  const [institutions, setInstitutions] = useState([]);
  const [selectedInstId, setSelectedInstId] = useState('');
  const [funerals, setFunerals] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from('institutions').select('id, name').then(({ data, error }) => {
      if (error) console.error("Error fetching institutions:", error);
      setInstitutions(data || []);
    });
  }, []);

  useEffect(() => {
    if (selectedInstId) fetchFunerals(selectedInstId);
  }, [selectedInstId]);

  const fetchFunerals = async (instId) => {
    setLoading(true);
    // Added burial_date to the select statement
    const { data, error } = await supabase
      .from('funerals')
      .select('id, full_name, status, closed_at, archived_at, burial_date') 
      .eq('institution_id', instId);
    
    if (error) console.error("Fetch Error:", error);
    else setFunerals(data || []);
    setLoading(false);
  };

  const handleStatusChange = async (id, newStatus) => {
    setLoading(true);
    const updatePayload = { status: newStatus };
    
    if (newStatus === 'closed') updatePayload.closed_at = new Date().toISOString();
    if (newStatus === 'archived') updatePayload.archived_at = new Date().toISOString();

    const { error } = await supabase
      .from('funerals')
      .update(updatePayload)
      .eq('id', id);

    if (error) {
      console.error("Update Failed:", error.message);
      alert(`Update failed: ${error.message}`);
    } else {
      await fetchFunerals(selectedInstId);
    }
    setLoading(false);
  };

  const purgeRecord = async (id) => {
    if (!window.confirm("WARNING: This will permanently remove the record and all associated transactions. Proceed?")) return;
    
    setLoading(true);
    await supabase.from('transactions').delete().eq('funeral_id', id);
    const { error } = await supabase.from('funerals').delete().eq('id', id);
    
    if (error) console.error("Purge Error:", error);
    else await fetchFunerals(selectedInstId);
    setLoading(false);
  };

  const purgeAllArchivedData = async () => {
    if (!window.confirm("WARNING: Permanently purge ALL 'archived' funeral data? This cannot be undone.")) return;
    
    setLoading(true);
    const archivedFunerals = funerals.filter(f => f.status === 'archived');
    
    for (const f of archivedFunerals) {
      await supabase.from('transactions').delete().eq('funeral_id', f.id);
      await supabase.from('funerals').delete().eq('id', f.id);
    }
    await fetchFunerals(selectedInstId);
    setLoading(false);
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1000px', fontFamily: 'sans-serif' }}>
      <h2 style={{ fontSize: '20px', marginBottom: '20px' }}>Lifecycle Management Engine</h2>
      
      <select onChange={(e) => setSelectedInstId(e.target.value)} value={selectedInstId} style={styles.select}>
        <option value="">-- Select Institution to View Funerals --</option>
        {institutions.map(inst => <option key={inst.id} value={inst.id}>{inst.name}</option>)}
      </select>

      <div style={styles.warningBox}>
        <div>
          <h4 style={{ margin: 0, color: '#9f1239' }}>Database Maintenance Engine</h4>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#4c0519' }}>
            Purge data for all 'archived' funeral records.
          </p>
        </div>
        <button 
          onClick={purgeAllArchivedData} 
          disabled={loading || funerals.filter(f => f.status === 'archived').length === 0} 
          style={styles.purgeBtn}
        >
          {loading ? "Processing..." : "💥 Purge All Archived Accounts"}
        </button>
      </div>

      <table style={styles.table}>
        <thead>
          <tr style={{ background: '#f8fafc' }}>
            <th style={styles.th}>Full Name</th>
            <th style={styles.th}>Burial Date</th>
            <th style={styles.th}>Status</th>
            <th style={styles.th}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {funerals.map(f => (
            <tr key={f.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={styles.td}>{f.full_name}</td>
              <td style={styles.td}>{f.burial_date || 'N/A'}</td>
              <td style={styles.td}>
                <span style={{ ...styles.badge, background: f.status === 'active' ? '#dcfce7' : '#fee2e2' }}>
                  {f.status}
                </span>
              </td>
              <td style={styles.td}>
                {f.status !== 'closed' && (
                  <button onClick={() => handleStatusChange(f.id, 'closed')} style={styles.btn}>Close</button>
                )}
                {f.status !== 'archived' && (
                  <button onClick={() => handleStatusChange(f.id, 'archived')} style={styles.btn}>Archive</button>
                )}
                <button onClick={() => purgeRecord(f.id)} style={{...styles.btn, color: 'red'}}>Purge</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const styles = {
  select: { width: '100%', padding: '12px', marginBottom: '24px', borderRadius: '8px', border: '1px solid #e2e8f0' },
  warningBox: { background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '12px', padding: '16px 20px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  purgeBtn: { background: '#e11d48', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' },
  table: { width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: '8px', overflow: 'hidden' },
  th: { padding: '12px', textAlign: 'left', fontSize: '12px', textTransform: 'uppercase', color: '#64748b' },
  td: { padding: '12px' },
  btn: { marginRight: '8px', cursor: 'pointer', padding: '4px 8px', background: '#f1f5f9', border: 'none', borderRadius: '4px' },
  badge: { padding: '2px 8px', borderRadius: '12px', fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold' }
};

export default SuperAdminSettings;