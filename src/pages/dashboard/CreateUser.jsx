import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabase';

function CreateUser() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [funerals, setFunerals] = useState([]);
  const [form, setForm] = useState({ id: null, full_name: '', email: '', phone: '', password: '', role_id: '', funeral_id: '' });
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [institutionId, setInstitutionId] = useState(null);

  useEffect(() => {
    getInstitutionFromSession();
    fetchRoles();
  }, []);

  useEffect(() => {
    if (institutionId) {
      fetchUsers();
      fetchFunerals();
    }
  }, [institutionId]);

  const getInstitutionFromSession = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('users').select('institution_id').eq('id', user.id).single();
    if (data?.institution_id) setInstitutionId(data.institution_id);
  };

  const fetchRoles = async () => {
    const { data } = await supabase.from('roles').select('id, name');
    setRoles((data || []).filter(r => r.name.toLowerCase() !== 'superadmin'));
  };

  const fetchFunerals = async () => {
    const { data } = await supabase.from('funerals').select('id, full_name').eq('institution_id', institutionId);
    setFunerals(data || []);
  };

  const fetchUsers = async () => {
    const { data } = await supabase.from('users').select('*, roles(name)').eq('institution_id', institutionId);
    setUsers(data || []);
  };

  const getRoleName = (id) => roles.find(r => r.id === id)?.name || '';

  const handleSubmit = async () => {
    if (!form.full_name || !form.email || !form.role_id) return alert("Required fields missing.");

    setLoading(true);
    try {
      let userId = form.id;
      if (!editMode) {
        const { data: auth, error: authError } = await supabase.auth.signUp({ email: form.email, password: form.password });
        if (authError) throw authError;
        userId = auth.user.id;
        
        await supabase.from('users').insert([{ id: userId, full_name: form.full_name, email: form.email, phone: form.phone, role_id: form.role_id, institution_id: institutionId, status: 'active' }]);
      } else {
        await supabase.from('users').update({ full_name: form.full_name, phone: form.phone, role_id: form.role_id }).eq('id', userId);
      }

      // Handle Family Head Assignment
      if (getRoleName(form.role_id) === 'FAMILYHEAD' && form.funeral_id) {
        await supabase.from('user_funeral_access').upsert({ user_id: userId, funeral_id: form.funeral_id });
      }

      setForm({ id: null, full_name: '', email: '', phone: '', password: '', role_id: '', funeral_id: '' });
      setEditMode(false);
      fetchUsers();
      alert("Operation successful!");
    } catch (err) { alert(err.message); } finally { setLoading(false); }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '900px', margin: '0 auto', fontFamily: 'system-ui' }}>
      <div style={{ background: '#fff', padding: '25px', borderRadius: '12px', marginBottom: '30px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <h2>{editMode ? "Edit User" : "Create New User"}</h2>
        <div className="grid-form-2">
          <input placeholder="Full Name" value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} style={inputStyle} />
          <input placeholder="Email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} disabled={editMode} style={inputStyle} />
          <input placeholder="Phone" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} style={inputStyle} />
          {!editMode && <input type="password" placeholder="Password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} style={inputStyle} />}
          
          <select value={form.role_id} onChange={e => setForm({...form, role_id: e.target.value})} style={inputStyle}>
            <option value="">Select Role</option>
            {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>

          {getRoleName(form.role_id) === 'FAMILYHEAD' && (
            <select value={form.funeral_id} onChange={e => setForm({...form, funeral_id: e.target.value})} style={inputStyle}>
              <option value="">Select Funeral to Manage</option>
              {funerals.map(f => <option key={f.id} value={f.id}>{f.full_name}</option>)}
            </select>
          )}
        </div>
        <button onClick={handleSubmit} style={btnStyle}>{loading ? "Processing..." : "Save User"}</button>
      </div>

      <div className="table-wrapper">
      <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
        <thead><tr style={{ background: '#f1f5f9', textAlign: 'left' }}><th style={thStyle}>Name</th><th style={thStyle}>Role</th><th style={thStyle}>Action</th></tr></thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={tdStyle}>{u.full_name}</td>
              <td style={tdStyle}>{getRoleName(u.role_id)}</td>
              <td style={tdStyle}><button onClick={() => { setForm({...u, password: ''}); setEditMode(true); }} style={{color: '#2563eb', border: 'none', background: 'none', cursor: 'pointer'}}>Edit</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

const inputStyle = { padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' };
const btnStyle = { padding: '12px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', marginTop: '15px' };
const thStyle = { padding: '12px', fontSize: '0.85rem', textTransform: 'uppercase' };
const tdStyle = { padding: '12px' };

export default CreateUser;