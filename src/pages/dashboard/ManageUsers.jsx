import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../supabase';
import { useToast } from '../../components/ui/ToastProvider';

function ManageUsers() {
  const notifications = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resetTarget, setResetTarget] = useState(null);
  const [passwords, setPasswords] = useState({ password: '', confirm: '' });
  const [resetting, setResetting] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required.');
      const { data: profile, error: profileError } = await supabase.from('users').select('institution_id').eq('id', user.id).single();
      if (profileError) throw profileError;
      const { data, error } = await supabase.from('users').select('id, full_name, username, email, status, institution_id, roles(name)').eq('institution_id', profile.institution_id).order('full_name');
      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      notifications.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [notifications]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const toggleStatus = async (user) => {
    try {
      const newStatus = user.status === 'active' ? 'inactive' : 'active';
      const { error } = await supabase.from('users').update({ status: newStatus }).eq('id', user.id);
      if (error) throw error;
      notifications.success(`${user.full_name} is now ${newStatus}.`);
      await fetchUsers();
    } catch (error) {
      notifications.error(error.message);
    }
  };

  const openReset = (user) => {
    setResetTarget(user);
    setPasswords({ password: '', confirm: '' });
  };

  const handleResetPassword = async (event) => {
    event.preventDefault();
    if (passwords.password.length < 8) return notifications.warning('Password must be at least 8 characters.');
    if (passwords.password !== passwords.confirm) return notifications.warning('Passwords do not match.');
    if (!window.confirm(`Reset the password for ${resetTarget.full_name}?`)) return;

    setResetting(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-reset-user-password', {
        body: { targetUserId: resetTarget.id, newPassword: passwords.password },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.message || 'Password reset failed.');
      notifications.success(data.message);
      setResetTarget(null);
      setPasswords({ password: '', confirm: '' });
    } catch (error) {
      notifications.error(error.context?.body?.message || error.message || 'Password reset failed.');
    } finally {
      setResetting(false);
    }
  };

  if (loading) return <div style={{ padding: 30, color: '#64748b' }}>Loading team...</div>;

  return (
    <div style={{ padding: 20 }}>
      <h2>Manage Team</h2>
      <p style={{ color: '#64748b' }}>Reset passwords only for staff in your institution. ADMIN and SUPERADMIN accounts are protected.</p>
      <div className="table-wrapper">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}><th>Name</th><th>Username</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>{users.map((user) => {
            const protectedRole = ['ADMIN', 'SUPERADMIN'].includes(String(user.roles?.name || '').toUpperCase());
            return <tr key={user.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={cellStyle}>{user.full_name}</td><td style={cellStyle}><strong>{user.username}</strong></td><td style={cellStyle}>{user.roles?.name || 'Unassigned'}</td>
              <td style={cellStyle}><span style={{ color: user.status === 'active' ? '#15803d' : '#b91c1c', fontWeight: 700 }}>{user.status}</span></td>
              <td style={cellStyle}>
                <button type="button" onClick={() => toggleStatus(user)} style={secondaryButton}>{user.status === 'active' ? 'Deactivate' : 'Activate'}</button>
                <button type="button" onClick={() => openReset(user)} disabled={protectedRole} title={protectedRole ? 'Protected role' : 'Reset password'} style={{ ...resetButton, opacity: protectedRole ? 0.45 : 1 }}>Reset Password</button>
              </td>
            </tr>;
          })}</tbody>
        </table>
      </div>

      {resetTarget && (
        <div style={overlayStyle} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setResetTarget(null); }}>
          <div style={modalStyle} role="dialog" aria-modal="true" aria-labelledby="reset-title">
            <h3 id="reset-title" style={{ marginTop: 0 }}>Reset Staff Password</h3>
            <p style={{ color: '#64748b' }}>{resetTarget.full_name}<br />Username: <strong>{resetTarget.username}</strong></p>
            <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input type="password" autoComplete="new-password" value={passwords.password} onChange={(e) => setPasswords({ ...passwords, password: e.target.value })} placeholder="New password (minimum 8 characters)" required minLength="8" style={inputStyle} />
              <input type="password" autoComplete="new-password" value={passwords.confirm} onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })} placeholder="Confirm new password" required minLength="8" style={inputStyle} />
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setResetTarget(null)} style={secondaryButton}>Cancel</button>
                <button type="submit" disabled={resetting} style={resetButton}>{resetting ? 'Resetting...' : 'Confirm Reset'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const cellStyle = { padding: 10 };
const secondaryButton = { marginRight: 8, padding: '8px 11px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: 6, cursor: 'pointer' };
const resetButton = { padding: '8px 11px', color: '#fff', background: '#7c3aed', border: 0, borderRadius: 6, cursor: 'pointer', fontWeight: 650 };
const overlayStyle = { position: 'fixed', inset: 0, zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'rgba(15, 23, 42, 0.62)' };
const modalStyle = { width: '100%', maxWidth: 460, padding: 24, background: '#fff', borderRadius: 12, boxShadow: '0 24px 60px rgba(0,0,0,0.25)' };
const inputStyle = { width: '100%', padding: 12, border: '1px solid #cbd5e1', borderRadius: 7 };

export default ManageUsers;
