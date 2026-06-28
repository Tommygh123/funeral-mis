import React, { useState } from 'react';
import { supabase } from '../../supabase';

function AssignRole() {

  const [userId, setUserId] = useState('');
  const [roleId, setRoleId] = useState('');

  const [loading, setLoading] = useState(false);

  // =========================
  // ASSIGN ROLE
  // =========================
  const assignRole = async () => {

    try {

      if (!userId || !roleId) {
        alert('Please enter User ID and Role ID');
        return;
      }

      setLoading(true);

      console.log("🔥 ASSIGN ROLE STARTED");

      // =========================
      // UPDATE USER ROLE
      // =========================
      const { data, error } = await supabase
        .from('users')
        .update({
          role_id: roleId
        })
        .eq('id', userId)
        .select();

      if (error) {
        console.error(error);
        throw error;
      }

      console.log("✅ ROLE ASSIGNED:", data);

      alert("Role assigned successfully");

      // CLEAR INPUTS
      setUserId('');
      setRoleId('');

    } catch (err) {

      console.error("❌ ASSIGN ROLE ERROR:", err);

      alert(err.message);

    } finally {

      setLoading(false);
    }
  };

  return (

    <div
      style={{
        padding: '30px',
        background: '#ffffff',
        borderRadius: '12px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
        maxWidth: '500px'
      }}
    >

      <h2
        style={{
          marginBottom: '20px',
          color: '#0b1f3a'
        }}
      >
        Assign Role
      </h2>

      {/* USER ID */}
      <input
        type="text"
        placeholder="User ID"
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
        style={inputStyle}
      />

      {/* ROLE ID */}
      <input
        type="text"
        placeholder="Role ID"
        value={roleId}
        onChange={(e) => setRoleId(e.target.value)}
        style={inputStyle}
      />

      {/* BUTTON */}
      <button
        onClick={assignRole}
        disabled={loading}
        style={buttonStyle}
      >
        {
          loading
            ? 'Assigning Role...'
            : 'Assign Role'
        }
      </button>

    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: '14px',
  marginBottom: '18px',
  borderRadius: '6px',
  border: '1px solid #ccc',
  fontSize: '15px',
  outline: 'none'
};

const buttonStyle = {
  width: '100%',
  padding: '14px',
  background: '#2563eb',
  color: 'white',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '16px',
  fontWeight: 'bold'
};

export default AssignRole;