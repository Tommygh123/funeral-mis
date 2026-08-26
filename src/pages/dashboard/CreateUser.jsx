import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../supabase';
import { useToast } from '../../components/ui/ToastProvider';

const emptyForm = { id: null, full_name: '', username: '', phone: '', password: '', role_id: '', funeral_id: '' };

function CreateUser() {
  const notifications = useToast();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [funerals, setFunerals] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [institutionId, setInstitutionId] = useState(null);

  const fetchUsers = useCallback(async (id) => {
    const { data, error } = await supabase.from('users').select('id, full_name, username, phone, role_id, roles(name)').eq('institution_id', id).order('full_name');
    if (error) notifications.error(error.message); else setUsers(data || []);
  }, [notifications]);

  const fetchFunerals = useCallback(async (id) => {
    const { data } = await supabase.from('funerals').select('id, full_name').eq('institution_id', id);
    setFunerals(data || []);
  }, []);

  useEffect(() => {
    const initialize = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [{ data: profile }, { data: roleData }] = await Promise.all([
        supabase.from('users').select('institution_id').eq('id', user.id).single(),
        supabase.from('roles').select('id, name'),
      ]);
      if (profile?.institution_id) {
        setInstitutionId(profile.institution_id);
        fetchUsers(profile.institution_id);
        fetchFunerals(profile.institution_id);
      }
      setRoles((roleData || []).filter((role) => !['SUPERADMIN', 'ADMIN'].includes(String(role.name).toUpperCase())));
    };
    initialize();
  }, [fetchFunerals, fetchUsers]);

  const getRoleName = (id) => roles.find((role) => role.id === id)?.name || '';

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.full_name.trim() || !form.username.trim() || !form.role_id) return notifications.warning('Full name, username, and role are required.');
    if (!editMode && form.password.length < 8) return notifications.warning('Password must be at least 8 characters.');

    setLoading(true);
    try {
      let userId = form.id;
      if (!editMode) {
        const { data, error } = await supabase.functions.invoke('admin-create-user', {
          body: {
            fullName: form.full_name.trim(), username: form.username.trim().toLowerCase(),
            phone: form.phone.trim(), password: form.password, roleId: form.role_id,
          },
        });
        if (error) throw error;
        if (!data?.success) throw new Error(data?.message || 'Unable to create user.');
        userId = data.userId;
        notifications.success(data.message);
      } else {
        const { error } = await supabase.from('users').update({ full_name: form.full_name.trim(), phone: form.phone.trim() || null, role_id: form.role_id }).eq('id', userId).eq('institution_id', institutionId);
        if (error) throw error;
        notifications.success('User profile updated successfully.');
      }

      if (String(getRoleName(form.role_id)).toUpperCase() === 'FAMILYHEAD' && form.funeral_id) {
        const { error } = await supabase.from('user_funeral_access').upsert({ user_id: userId, funeral_id: form.funeral_id });
        if (error) throw error;
      }

      setForm(emptyForm);
      setEditMode(false);
      await fetchUsers(institutionId);
    } catch (error) {
      notifications.error(error.message || 'Unable to save user.');
    } finally {
      setLoading(false);
    }
  };

  const editUser = (user) => {
    setForm({ id: user.id, full_name: user.full_name, username: user.username, phone: user.phone || '', password: '', role_id: user.role_id || '', funeral_id: '' });
    setEditMode(true);
  };

  return (
    <div style={{ padding: 20, maxWidth: 900, margin: '0 auto', fontFamily: 'system-ui' }}>
      <form onSubmit={handleSubmit} style={{ background: '#fff', padding: 25, borderRadius: 12, marginBottom: 30, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <h2>{editMode ? 'Edit User' : 'Create New User'}</h2>
        <div className="grid-form-2">
          <input placeholder="Full Name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} style={inputStyle} />
          <input placeholder="Unique Username" autoComplete="off" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })} disabled={editMode} style={inputStyle} />
          <input placeholder="Phone (optional)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={inputStyle} />
          {!editMode && <input type="password" autoComplete="new-password" placeholder="Password (minimum 8 characters)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} style={inputStyle} />}
          <select value={form.role_id} onChange={(e) => setForm({ ...form, role_id: e.target.value })} style={inputStyle}><option value="">Select Role</option>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select>
          {String(getRoleName(form.role_id)).toUpperCase() === 'FAMILYHEAD' && <select value={form.funeral_id} onChange={(e) => setForm({ ...form, funeral_id: e.target.value })} style={inputStyle}><option value="">Select Funeral to Manage</option>{funerals.map((funeral) => <option key={funeral.id} value={funeral.id}>{funeral.full_name}</option>)}</select>}
        </div>
        <button type="submit" disabled={loading} style={btnStyle}>{loading ? 'Processing...' : editMode ? 'Save Changes' : 'Create Username Account'}</button>
        {editMode && <button type="button" onClick={() => { setForm(emptyForm); setEditMode(false); }} style={cancelStyle}>Cancel</button>}
      </form>

      <div className="table-wrapper"><table><thead><tr><th style={thStyle}>Name</th><th style={thStyle}>Username</th><th style={thStyle}>Role</th><th style={thStyle}>Action</th></tr></thead><tbody>
        {users.map((user) => <tr key={user.id}><td style={tdStyle}>{user.full_name}</td><td style={tdStyle}><strong>{user.username}</strong></td><td style={tdStyle}>{user.roles?.name || getRoleName(user.role_id)}</td><td style={tdStyle}><button type="button" onClick={() => editUser(user)} style={editStyle}>Edit</button></td></tr>)}
      </tbody></table></div>
    </div>
  );
}

const inputStyle = { padding: 10, borderRadius: 6, border: '1px solid #cbd5e1' };
const btnStyle = { padding: '12px 20px', background: '#2563eb', color: '#fff', border: 0, borderRadius: 6, cursor: 'pointer', marginTop: 15 };
const cancelStyle = { ...btnStyle, marginLeft: 10, background: '#64748b' };
const thStyle = { padding: 12, fontSize: '0.85rem', textTransform: 'uppercase', textAlign: 'left' };
const tdStyle = { padding: 12, borderBottom: '1px solid #e2e8f0' };
const editStyle = { color: '#2563eb', border: 0, background: 'none', cursor: 'pointer' };

export default CreateUser;
