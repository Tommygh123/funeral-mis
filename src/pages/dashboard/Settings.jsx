import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../supabase';

function Settings() {
  const [activeTab, setActiveTab] = useState('institution');
  const [loading, setLoading] = useState(false);
  const [inst, setInst] = useState({ name: '', logo_url: '' });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  
  const [funerals, setFunerals] = useState([]);
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [assignment, setAssignment] = useState({ funeral_id: '', user_id: '' });

  const fetchData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase.from('users').select('institution_id').eq('id', user.id).single();
      
      // Fetch Institution
      const { data: iData } = await supabase.from('institutions').select('*').eq('id', userData.institution_id).single();
      setInst(iData);
      
      // Fetch Funerals
      const { data: fData } = await supabase.from('funerals').select('*').eq('institution_id', userData.institution_id);
      setFunerals(fData || []);

      // Fetch Users with explicit role join
      const { data: uData } = await supabase
        .from('users')
        .select(`
          id, 
          full_name, 
          roles (
            name
          )
        `)
        .eq('institution_id', userData.institution_id);

      // UPDATED: Filter for FUNERALHEAD as per your database results
      const familyHeads = uData?.filter(u => u.roles?.name?.toUpperCase() === 'FUNERALHEAD') || [];
      setUsers(familyHeads);
      
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Handlers
  const handleLogoChange = (e) => { setLogoFile(e.target.files[0]); setLogoPreview(URL.createObjectURL(e.target.files[0])); };
  const handlePhotoChange = (e) => { setPhotoFile(e.target.files[0]); setPhotoPreview(URL.createObjectURL(e.target.files[0])); };

  const updateInstitution = async () => {
    setLoading(true);
    let url = inst.logo_url;
    if (logoFile) {
      const path = `${inst.id}/logo-${Date.now()}`;
      await supabase.storage.from('institution-logos').upload(path, logoFile, { upsert: true });
      const { data } = supabase.storage.from('institution-logos').getPublicUrl(path);
      url = data.publicUrl;
    }
    await supabase.from('institutions').update({ name: inst.name, logo_url: url }).eq('id', inst.id);
    alert("Institution profile updated.");
    setLoading(false);
    fetchData();
  };

  const updateFuneralPhoto = async () => {
    setLoading(true);
    const path = `${selected.institution_id}/deceased-${Date.now()}`;
    await supabase.storage.from('deceased-logos').upload(path, photoFile);
    const { data } = supabase.storage.from('deceased-logos').getPublicUrl(path);
    await supabase.from('funerals').update({ photo_url: data.publicUrl }).eq('id', selected.id);
    alert("Portrait updated.");
    setLoading(false);
    setSelected(null);
    fetchData();
  };

  const handleAssignment = async () => {
    if (!assignment.funeral_id || !assignment.user_id) return alert("Please select both a funeral and a user.");
    setLoading(true);
    const { error } = await supabase.from('funerals').update({ manager_id: assignment.user_id }).eq('id', assignment.funeral_id);
    if (error) alert(error.message);
    else { alert("Linkage established successfully!"); fetchData(); }
    setLoading(false);
  };

  return (
    <div style={{ padding: '40px', background: '#f8fafc', minHeight: '100vh', fontFamily: 'system-ui' }}>
      <h1 style={{ color: '#0f172a', marginBottom: '30px' }}>System Administration</h1>

      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <button onClick={() => setActiveTab('institution')} style={tabStyle(activeTab === 'institution')}>🏢 Institution Profile</button>
        <button onClick={() => setActiveTab('deceased')} style={tabStyle(activeTab === 'deceased')}>🕊️ Funeral Registry</button>
        <button onClick={() => setActiveTab('access')} style={tabStyle(activeTab === 'access')}>🔑 Access Control</button>
      </div>

      {activeTab === 'institution' && (
        <div style={cardStyle}>
          <h3>Update Institutional Identity</h3>
          <img src={logoPreview || inst.logo_url} alt="Logo" style={{ width: '120px', height: '120px', objectFit: 'cover', borderRadius: '10px', marginBottom: '15px' }} />
          <input type="text" value={inst.name} onChange={e => setInst({...inst, name: e.target.value})} style={inputStyle} />
          <input type="file" onChange={handleLogoChange} style={{ display: 'block', marginBottom: '15px' }} />
          <button onClick={updateInstitution} disabled={loading} style={btnStyle}>Update Institution</button>
        </div>
      )}

      {activeTab === 'deceased' && (
        <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '20px' }}>
          <div style={cardStyle}>
            <h4>Deceased Portrait Update</h4>
            {selected ? (
              <>
                <p>Editing: <strong>{selected.full_name}</strong></p>
                <img src={photoPreview || selected.photo_url} style={{ width: '80px', height: '80px', borderRadius: '8px', objectFit: 'cover' }} />
                <input type="file" onChange={handlePhotoChange} style={{ margin: '15px 0' }} />
                <button onClick={updateFuneralPhoto} disabled={!photoFile || loading} style={btnStyle}>Update Portrait</button>
              </>
            ) : <p style={{ color: '#94a3b8' }}>Select a funeral record to edit.</p>}
          </div>
          <div style={cardStyle}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: '#f1f5f9' }}>{['Name', 'Status'].map(h => <th key={h} style={{ padding: '10px', textAlign: 'left' }}>{h}</th>)}</tr></thead>
              <tbody>
                {funerals.map(f => (
                  <tr key={f.id} style={{ borderBottom: '1px solid #e2e8f0', cursor: 'pointer', background: selected?.id === f.id ? '#eff6ff' : '' }} onClick={() => setSelected(f)}>
                    <td style={{ padding: '10px' }}>{f.full_name}</td>
                    <td style={{ padding: '10px' }}>{f.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'access' && (
        <div style={cardStyle}>
          <h3>Assign Family Head to Funeral</h3>
          <p style={{ color: '#64748b', marginBottom: '20px' }}>Select an existing funeral and map it to a registered Funeral Head.</p>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <select style={inputStyle} onChange={e => setAssignment({...assignment, funeral_id: e.target.value})}>
              <option value="">Select Funeral</option>
              {funerals.map(f => <option key={f.id} value={f.id}>{f.full_name}</option>)}
            </select>
            <select style={inputStyle} onChange={e => setAssignment({...assignment, user_id: e.target.value})}>
              <option value="">Select Funeral Head</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
            <button onClick={handleAssignment} disabled={loading} style={btnStyle}>Confirm Linkage</button>
          </div>
        </div>
      )}
    </div>
  );
}

const cardStyle = { background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' };
const inputStyle = { width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' };
const btnStyle = { padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' };
const tabStyle = (active) => ({ padding: '10px 20px', border: 'none', borderRadius: '8px', background: active ? '#2563eb' : '#e2e8f0', color: active ? '#fff' : '#64748b', cursor: 'pointer', fontWeight: '600' });

export default Settings;