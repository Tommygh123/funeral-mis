import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabase';

function FuneralList({ institutionId }) {
  const [funerals, setFunerals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (institutionId) {
      fetchFunerals();
    } else {
      console.warn("FuneralList: No institutionId provided");
      setLoading(false);
    }
  }, [institutionId]);

  const fetchFunerals = async () => {
    setLoading(true);
    setError(null);
    
    // Debug: Check what ID we are actually filtering by
    console.log("Fetching funerals for Institution ID:", institutionId);

    const { data, error: fetchError } = await supabase
      .from('funerals')
      .select('*')
      .eq('institution_id', institutionId)
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error("Supabase Fetch Error:", fetchError);
      setError(fetchError.message);
    } else {
      console.log("Records found:", data);
      setFunerals(data || []);
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this funeral record?")) return;

    const { error } = await supabase.from('funerals').delete().eq('id', id);
    if (!error) fetchFunerals();
    else alert("Delete failed: " + error.message);
  };

  const handleCloseFuneral = async (id) => {
    const { error } = await supabase
      .from('funerals')
      .update({ status: 'closed' })
      .eq('id', id);

    if (!error) fetchFunerals();
    else alert("Update failed: " + error.message);
  };

  if (loading) return <div>Loading funerals...</div>;
  if (error) return <div style={{ color: 'red' }}>Error loading funerals: {error}</div>;

  return (
    <div>
      <h2 style={{ marginBottom: 20 }}>Registered Funerals ({funerals.length})</h2>

      {funerals.length === 0 ? (
        <p>No funeral records found for this institution.</p>
      ) : (
        <div style={grid}>
          {funerals.map(funeral => (
            <div key={funeral.id} style={card}>
              <img
                src={funeral.photo_url || 'https://via.placeholder.com/300x250'}
                alt={funeral.full_name}
                style={photo}
              />
              <div style={{ padding: 15 }}>
                <h3 style={{ marginBottom: 10 }}>{funeral.full_name}</h3>
                <p style={text}>Burial: <b>{funeral.burial_date || 'N/A'}</b></p>
                <p style={text}>Contact: <b>{funeral.family_contact_phone || 'N/A'}</b></p>
                <p style={text}>Location: <b>{funeral.location || 'N/A'}</b></p>

                <div style={{ marginTop: 10 }}>
                  <span style={{
                    ...statusBadge,
                    background: funeral.status === 'closed' ? '#fee2e2' : '#dcfce7',
                    color: funeral.status === 'closed' ? '#b91c1c' : '#166534'
                  }}>
                    {funeral.status}
                  </span>
                </div>

                <div style={actions}>
                  {funeral.status === 'active' && (
                    <button style={closeBtn} onClick={() => handleCloseFuneral(funeral.id)}>
                      Close File
                    </button>
                  )}
                  <button style={deleteBtn} onClick={() => handleDelete(funeral.id)}>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Styles
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 20 };
const card = { background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.08)' };
const photo = { width: '100%', height: 240, objectFit: 'cover' };
const text = { marginBottom: 8, color: '#555' };
const statusBadge = { padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 'bold', textTransform: 'capitalize' };
const actions = { display: 'flex', gap: 10, marginTop: 20 };
const closeBtn = { flex: 1, padding: 10, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' };
const deleteBtn = { flex: 1, padding: 10, background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' };

export default FuneralList;