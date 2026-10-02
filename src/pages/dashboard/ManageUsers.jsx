import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabase';
import { useToast } from '../../components/ui/ToastProvider';
import PasswordInput from '../../components/ui/PasswordInput';

const blankForm = { id: null, full_name: '', email: '', phone: '', role_id: '', password: '', confirm: '', status: 'active' };

async function invokeMessage(error, fallback) {
  try {
    if (error?.context && typeof error.context.json === 'function') {
      const body = await error.context.json();
      return body?.message || body?.error || fallback;
    }
  } catch (_) { /* ignore response parsing errors */ }
  return error?.message || fallback;
}

export default function ManageUsers() {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [institutionId, setInstitutionId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(blankForm);
  const [resetTarget, setResetTarget] = useState(null);
  const [passwords, setPasswords] = useState({ password: '', confirm: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required.');
      const { data: profile, error: profileError } = await supabase.from('users').select('institution_id').eq('id', user.id).single();
      if (profileError) throw profileError;
      if (!profile?.institution_id) throw new Error('Institution profile not found.');
      setInstitutionId(profile.institution_id);
      const [{ data: userRows, error: usersError }, { data: roleRows, error: rolesError }] = await Promise.all([
        supabase.from('users').select('id, full_name, email, phone, role_id, status, institution_id, roles(name)').eq('institution_id', profile.institution_id).order('full_name'),
        supabase.from('roles').select('id, name').order('name'),
      ]);
      if (usersError) throw usersError;
      if (rolesError) throw rolesError;
      setUsers(userRows || []);
      setRoles((roleRows || []).filter((r) => !['ADMIN', 'SUPERADMIN'].includes(String(r.name).toUpperCase())));
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => [u.full_name, u.email, u.phone, u.roles?.name, u.status].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [query, users]);

  const openAdd = () => { setForm(blankForm); setFormOpen(true); };
  const openEdit = (u) => {
    setForm({ id: u.id, full_name: u.full_name || '', email: u.email || '', phone: u.phone || '', role_id: u.role_id || '', password: '', confirm: '', status: u.status || 'active' });
    setFormOpen(true);
  };

  const saveUser = async (e) => {
    e.preventDefault();
    if (!form.full_name.trim() || !form.email.trim() || !form.role_id) return toast.warning('Full name, email and role are required.');
    if (!form.id && form.password.length < 8) return toast.warning('Password must be at least 8 characters.');
    if (!form.id && form.password !== form.confirm) return toast.warning('Passwords do not match.');
    setSaving(true);
    try {
      if (!form.id) {
        const { data, error } = await supabase.functions.invoke('admin-create-user', { body: { fullName: form.full_name.trim(), email: form.email.trim().toLowerCase(), phone: form.phone.trim(), password: form.password, roleId: form.role_id } });
        if (error) throw new Error(await invokeMessage(error, 'Unable to create user.'));
        if (!data?.success) throw new Error(data?.message || 'Unable to create user.');
        toast.success(data.message || 'User created successfully.');
      } else {
        const { data, error } = await supabase.functions.invoke('admin-manage-user', { body: { action: 'update', targetUserId: form.id, fullName: form.full_name.trim(), email: form.email.trim().toLowerCase(), phone: form.phone.trim(), roleId: form.role_id, status: form.status } });
        if (error) throw new Error(await invokeMessage(error, 'Unable to update user.'));
        if (!data?.success) throw new Error(data?.message || 'Unable to update user.');
        toast.success(data.message || 'User updated successfully.');
      }
      setFormOpen(false); setForm(blankForm); await load();
    } catch (e2) { toast.error(e2.message); }
    finally { setSaving(false); }
  };

  const toggleStatus = async (u) => {
    const next = u.status === 'active' ? 'inactive' : 'active';
    try {
      const { data, error } = await supabase.functions.invoke('admin-manage-user', { body: { action: 'status', targetUserId: u.id, status: next } });
      if (error) throw new Error(await invokeMessage(error, 'Unable to change user status.'));
      if (!data?.success) throw new Error(data?.message || 'Unable to change user status.');
      toast.success(`${u.full_name} is now ${next}.`); await load();
    } catch (e) { toast.error(e.message); }
  };

  const deleteUser = async (u) => {
    if (!window.confirm(`Delete ${u.full_name} (${u.email}) permanently? This removes the user's login account too.`)) return;
    try {
      const { data, error } = await supabase.functions.invoke('admin-manage-user', { body: { action: 'delete', targetUserId: u.id } });
      if (error) throw new Error(await invokeMessage(error, 'Unable to delete user.'));
      if (!data?.success) throw new Error(data?.message || 'Unable to delete user.');
      toast.success(data.message || 'User deleted.'); await load();
    } catch (e) { toast.error(e.message); }
  };

  const resetPassword = async (e) => {
    e.preventDefault();
    if (passwords.password.length < 8) return toast.warning('Password must be at least 8 characters.');
    if (passwords.password !== passwords.confirm) return toast.warning('Passwords do not match.');
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-reset-user-password', { body: { targetUserId: resetTarget.id, newPassword: passwords.password } });
      if (error) throw new Error(await invokeMessage(error, 'Password reset failed.'));
      if (!data?.success) throw new Error(data?.message || 'Password reset failed.');
      toast.success(data.message || 'Password reset successfully.'); setResetTarget(null); setPasswords({ password: '', confirm: '' });
    } catch (e2) { toast.error(e2.message); }
    finally { setSaving(false); }
  };

  if (loading) return <div style={{ padding: 30, color: '#64748b' }}>Loading users...</div>;

  return <div style={{ padding: 20 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginBottom: 18 }}>
      <div><h2 style={{ margin: 0 }}>User Management</h2><p style={{ margin: '5px 0 0', color: '#64748b' }}>Create and manage users for your institution.</p></div>
      <button type="button" onClick={openAdd} style={primaryButton}>+ Add User</button>
    </div>
    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email, phone, role or status..." style={{ ...inputStyle, width: '100%', maxWidth: 520, marginBottom: 16 }} />
    <div className="table-wrapper"><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr style={{ textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead><tbody>
      {filtered.map((u) => { const protectedRole = ['ADMIN', 'SUPERADMIN'].includes(String(u.roles?.name || '').toUpperCase()); return <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
        <td style={cell}>{u.full_name}</td><td style={cell}><strong>{u.email}</strong></td><td style={cell}>{u.phone || '—'}</td><td style={cell}>{u.roles?.name || 'Unassigned'}</td><td style={cell}><strong>{u.status}</strong></td>
        <td style={{ ...cell, whiteSpace: 'nowrap' }}>
          {!protectedRole && <><button onClick={() => openEdit(u)} style={actionButton}>Edit</button><button onClick={() => toggleStatus(u)} style={actionButton}>{u.status === 'active' ? 'Deactivate' : 'Activate'}</button><button onClick={() => { setResetTarget(u); setPasswords({ password: '', confirm: '' }); }} style={actionButton}>Reset Password</button><button onClick={() => deleteUser(u)} style={dangerButton}>Delete</button></>}
          {protectedRole && <span style={{ color: '#64748b' }}>Institution administrator</span>}
        </td>
      </tr>; })}
      {!filtered.length && <tr><td colSpan="6" style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>No users found.</td></tr>}
    </tbody></table></div>

    {formOpen && <div style={overlay} onMouseDown={(e) => { if (e.target === e.currentTarget) setFormOpen(false); }}><div style={modal}>
      <h3 style={{ marginTop: 0 }}>{form.id ? 'Edit User' : 'Add User'}</h3>
      <form onSubmit={saveUser} style={{ display: 'grid', gap: 12 }}>
        <label>Full Name<input style={inputStyle} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required /></label>
        <label>Email Address<input style={inputStyle} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value.toLowerCase() })} required /></label>
        <label>Phone Number<input style={inputStyle} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
        <label>Role<select style={inputStyle} value={form.role_id} onChange={(e) => setForm({ ...form, role_id: e.target.value })} required><option value="">Select Role</option>{roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
        {!form.id && <><label>Password<PasswordInput style={inputStyle} autoComplete="new-password" minLength="8" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></label><label>Confirm Password<PasswordInput style={inputStyle} autoComplete="new-password" minLength="8" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} required /></label></>}
        {form.id && <label>Status<select style={inputStyle} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}><button type="button" onClick={() => setFormOpen(false)} style={secondaryButton}>Cancel</button><button disabled={saving} style={primaryButton}>{saving ? 'Saving...' : form.id ? 'Save Changes' : 'Create User'}</button></div>
      </form>
    </div></div>}

    {resetTarget && <div style={overlay} onMouseDown={(e) => { if (e.target === e.currentTarget) setResetTarget(null); }}><div style={modal}><h3 style={{ marginTop: 0 }}>Reset Password</h3><p>{resetTarget.full_name}<br/><strong>{resetTarget.email}</strong></p><form onSubmit={resetPassword} style={{ display: 'grid', gap: 12 }}><PasswordInput style={inputStyle} placeholder="New password" minLength="8" value={passwords.password} onChange={(e) => setPasswords({ ...passwords, password: e.target.value })} required/><PasswordInput style={inputStyle} placeholder="Confirm new password" minLength="8" value={passwords.confirm} onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })} required/><div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}><button type="button" onClick={() => setResetTarget(null)} style={secondaryButton}>Cancel</button><button disabled={saving} style={primaryButton}>{saving ? 'Resetting...' : 'Reset Password'}</button></div></form></div></div>}
  </div>;
}

const cell = { padding: 10, verticalAlign: 'middle' };
const inputStyle = { display: 'block', boxSizing: 'border-box', width: '100%', padding: 11, marginTop: 5, border: '1px solid #cbd5e1', borderRadius: 7 };
const primaryButton = { padding: '10px 15px', color: '#fff', background: '#2563eb', border: 0, borderRadius: 7, cursor: 'pointer', fontWeight: 700 };
const secondaryButton = { padding: '9px 13px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: 7, cursor: 'pointer' };
const actionButton = { ...secondaryButton, padding: '7px 9px', marginRight: 6, marginBottom: 4 };
const dangerButton = { ...actionButton, color: '#b91c1c', borderColor: '#fecaca' };
const overlay = { position: 'fixed', inset: 0, zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'rgba(15,23,42,.62)' };
const modal = { width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', padding: 24, background: '#fff', borderRadius: 12, boxShadow: '0 24px 60px rgba(0,0,0,.25)' };
