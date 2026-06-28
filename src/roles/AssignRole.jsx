import React, { useState } from 'react';
import { supabase } from '../../../supabase';

function AssignRole() {

  const [userId, setUserId] = useState('');
  const [roleId, setRoleId] = useState('');

  const assignRole = async () => {

    const { error } = await supabase
      .from('users')
      .update({ role_id: roleId })
      .eq('id', userId);

    if (error) return alert(error.message);

    alert("Role assigned successfully");
  };

  return (
    <div>
      <h2>Assign Role</h2>

      <input placeholder="User ID" onChange={(e) => setUserId(e.target.value)} />
      <input placeholder="Role ID" onChange={(e) => setRoleId(e.target.value)} />

      <button onClick={assignRole}>
        Assign
      </button>

    </div>
  );
}

export default AssignRole;