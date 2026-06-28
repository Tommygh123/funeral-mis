import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabase';

function PurgeUtility() {
  const [institutions, setInstitutions] = useState([]);
  const [funerals, setFunerals] = useState([]);
  const [selectedInst, setSelectedInst] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [{ data: inst }, { data: fun }] = await Promise.all([
      supabase.from('institutions').select('id, name'),
      supabase.from('funerals').select('id, deceased_name, institution_id, burial_date, status')
    ]);
    setInstitutions(inst || []);
    setFunerals(fun || []);
    setLoading(false);
  }

  const handleDelete = async (id) => {
    if (!window.confirm("WARNING: This will permanently remove the record and all associated transactions. Proceed?")) return;
    
    setLoading(true);
    
    // 1. Delete associated transactions first to maintain referential integrity
    const { error: tError } = await supabase.from('transactions').delete().eq('funeral_id', id);
    
    if (tError) {
      console.error("Transaction deletion error:", tError);
      alert("Failed to delete associated transactions. Check database constraints.");
    } else {
      // 2. Delete the funeral record
      const { error: fError } = await supabase.from('funerals').delete().eq('id', id);
      if (fError) {
        console.error("Funeral deletion error:", fError);
        alert("Failed to delete funeral record.");
      } else {
        setFunerals(funerals.filter(f => f.id !== id));
      }
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: '24px', maxWidth: '800px', fontFamily: 'sans-serif' }}>
      <h1>System Purge Utility</h1>
      
      <select 
        onChange={(e) => setSelectedInst(e.target.value)} 
        style={{ width: '100%', padding: '12px', marginBottom: '20px', borderRadius: '8px' }}
      >
        <option value="">Select Institution to Audit...</option>
        {institutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
      </select>

      {selectedInst && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #eee' }}>
              <th style={{ padding: '8px' }}>Deceased Name</th>
              <th style={{ padding: '8px' }}>Burial Date</th>
              <th style={{ padding: '8px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {funerals
              .filter(f => f.institution_id === selectedInst)
              .map(f => (
                <tr key={f.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '8px' }}>{f.deceased_name}</td>
                  <td style={{ padding: '8px' }}>{f.burial_date || 'N/A'}</td>
                  <td style={{ padding: '8px' }}>
                    <button 
                      onClick={() => handleDelete(f.id)} 
                      disabled={loading}
                      style={{ color: 'white', background: 'red', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      {loading ? "Deleting..." : "Delete"}
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default PurgeUtility;