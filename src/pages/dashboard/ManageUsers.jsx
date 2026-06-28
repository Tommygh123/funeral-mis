import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../supabase';

function ManageUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase.from('users').select('institution_id').eq('id', user.id).single();
    
    // Fetch all users for this institution regardless of status, so you can re-activate if needed
    const { data } = await supabase
      .from('users')
      .select('*, roles(name)')
      .eq('institution_id', profile.institution_id);

    setUsers(data || []);
    setLoading(false);
  }, []);

  const toggleStatus = async (user) => {
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    await supabase.from('users').update({ status: newStatus }).eq('id', user.id);
    fetchUsers();
  };

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  return (
    <div style={{ padding: '20px' }}>
      <h2>Manage Team</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>
            <th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '10px' }}>{u.full_name}</td>
              <td style={{ padding: '10px' }}>{u.email}</td>
              <td style={{ padding: '10px' }}>{u.roles?.name}</td>
              <td style={{ padding: '10px' }}>
                <span style={{ color: u.status === 'active' ? 'green' : 'red', fontWeight: 'bold' }}>
                  {u.status}
                </span>
              </td>
              <td style={{ padding: '10px' }}>
                <button onClick={() => toggleStatus(u)} style={{ marginRight: '10px' }}>
                  {u.status === 'active' ? 'Deactivate' : 'Activate'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ManageUsers;