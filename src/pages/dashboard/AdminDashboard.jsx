import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase';

function AdminDashboard() {
  const [funerals, setFunerals] = useState([]);
  const [institution, setInstitution] = useState(null);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const loadDashboard = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user logged in.");

      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('institution_id')
        .eq('id', user.id)
        .single();
      if (profileError) throw new Error("Profile Fetch Error: " + profileError.message);

      const { data: inst, error: instError } = await supabase
        .from('institutions')
        .select('*')
        .eq('id', profile.institution_id)
        .single();
      if (instError) throw new Error("Institution Fetch Error: " + instError.message);

      // Corrected: Selecting 'burial_date' instead of 'funeral_date'
      const { data: fList, error: fError } = await supabase
        .from('funerals')
        .select('id, full_name, status, location, burial_date')
        .eq('institution_id', profile.institution_id)
        .order('burial_date', { ascending: true });
        
      if (fError) throw new Error("Funerals Fetch Error: " + fError.message);

      setInstitution(inst);
      setFunerals(fList || []);
      setError(null);
    } catch (err) {
      console.error("Dashboard Load Error:", err.message);
      setError(err.message);
      setInstitution(null);
    }
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const getDaysLeft = () => {
    if (!institution?.subscription_end_date) return 0;
    const end = new Date(institution.subscription_end_date);
    const now = new Date();
    const diff = end - now;
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  if (error) return <div style={{ padding: '30px', color: 'red' }}><strong>System Error:</strong> {error}.</div>;
  if (!institution) return <div style={{ padding: '30px' }}>Loading Dashboard...</div>;

  return (
    <div className="page-padding" style={{ fontFamily: 'system-ui, sans-serif' }}>
      <div className="flex-between-start" style={{ marginBottom: '30px' }}>
        <div className="flex-row-wrap" style={{ alignItems: 'center', gap: '20px' }}>
          {institution.logo_url && (
            <img src={institution.logo_url} alt="Logo" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #e2e8f0' }} />
          )}
          <h1>{institution.name} Dashboard</h1>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: '0 0 10px 0', fontWeight: 'bold', color: '#dc2626', fontSize: '18px' }}>
            Days left until expiry: {getDaysLeft()}
          </p>
          <button onClick={() => navigate('/admin/upgrade')} style={{ padding: '8px 16px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
            Renew / Upgrade Plan
          </button>
        </div>
      </div>

      <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', marginBottom: '30px' }}>
        <h3 style={{ margin: 0 }}>Usage: {institution.total_funerals_registered || 0} / {institution.funeral_limit_per_month || 1} Funerals Registered</h3>
      </div>

      <h2 style={{ marginBottom: '20px' }}>Funeral Schedule</h2>
      <div className="table-wrapper">
      <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: '8px', overflow: 'hidden' }}>
        <thead>
          <tr style={{ textAlign: 'left', background: '#f1f5f9' }}>
            <th style={{ padding: '15px' }}>Deceased Name</th>
            <th style={{ padding: '15px' }}>Location</th>
            <th style={{ padding: '15px' }}>Burial Date</th>
            <th style={{ padding: '15px' }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {funerals.map(f => (
            <tr key={f.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '15px', fontWeight: '600' }}>{f.full_name}</td>
              <td style={{ padding: '15px' }}>{f.location || 'N/A'}</td>
              <td style={{ padding: '15px' }}>{f.burial_date ? new Date(f.burial_date).toLocaleDateString() : 'TBD'}</td>
              <td style={{ padding: '15px' }}>
                <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '12px', background: f.status === 'active' ? '#dcfce7' : '#fef3c7' }}>
                  {f.status || 'Pending'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

export default AdminDashboard;