import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../supabase';

function UserManagement() {

  // =========================
  // STATE
  // =========================
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);

  const [form, setForm] = useState({
    id: null,
    full_name: '',
    email: '',
    phone: '',
    password: '',
    role_id: '',
  });

  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  
  const [institutionId, setInstitutionId] = useState(null);
  const [currentUserRole, setCurrentUserRole] = useState(''); // Tracks the logged-in operator's tier
  const [checkingSession, setCheckingSession] = useState(true);

  // =========================
  // INIT & SESSION CHECK
  // =========================
  const getSessionContext = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        console.error("No authenticated session available.");
        return;
      }

      // Fetch profile meta-properties
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('institution_id, role_id')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;

      // Fetch corresponding security string designation
      const { data: roleData, error: roleError } = await supabase
        .from('roles')
        .select('name')
        .eq('id', profile.role_id)
        .single();

      if (roleError) throw roleError;

      const userRoleNormalized = String(roleData.name).toUpperCase();
      setCurrentUserRole(userRoleNormalized);
      setInstitutionId(profile?.institution_id || null); // Leaves null cleanly if SUPERADMIN
      
    } catch (error) {
      console.error("❌ Session validation failed:", error.message);
    } finally {
      setCheckingSession(false);
    }
  }, []);

  useEffect(() => {
    getSessionContext();
  }, [getSessionContext]);

  // Load contextual arrays once session resolves
  useEffect(() => {
    if (!checkingSession) {
      fetchRoles();
      fetchUsers();
    }
  }, [checkingSession, institutionId, currentUserRole]);

  // =========================
  // FETCH & FILTER SYSTEM ROLES
  // =========================
  const fetchRoles = async () => {
    try {
      const { data, error } = await supabase
        .from('roles')
        .select('id, name');

      if (error) throw error;

      let allRoles = data || [];

      // 🛑 CRITICAL GATEWAY FILTERING REQUIREMENT
      if (currentUserRole !== 'SUPERADMIN') {
        // Regular institutional admins cannot provision platform layers or mirror other admins
        allRoles = allRoles.filter(
          r => String(r.name).toUpperCase() !== 'SUPERADMIN' && String(r.name).toUpperCase() !== 'ADMIN'
        );
      }

      setRoles(allRoles);
    } catch (err) {
      console.error("Error fetching database role entries:", err.message);
    }
  };

  // =========================
  // FETCH USERS (SCOPE SEPARATION)
  // =========================
  const fetchUsers = async () => {
    try {
      let query = supabase.from('users').select('*');

      // If not platform owner, bind data boundary to current tenant's location ID
      if (currentUserRole !== 'SUPERADMIN') {
        if (!institutionId) return;
        query = query.eq('institution_id', institutionId);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      setUsers(data || []);
    } catch (err) {
      console.error("Error rendering user data grid context:", err.message);
    }
  };

  // =========================
  // HANDLE INPUT
  // =========================
  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  };

  // =========================
  // VALIDATION
  // =========================
  const validate = () => {
    if (!form.full_name || !form.email || !form.role_id) {
      alert("Full name, email, and role are required");
      return false;
    }

    if (!editMode && !form.password) {
      alert("Password is required for new users");
      return false;
    }

    if (currentUserRole !== 'SUPERADMIN' && !institutionId) {
      alert("Session context missing local tenant parameters. Re-login required.");
      return false;
    }

    return true;
  };

  // =========================
  // CREATE / UPDATE
  // =========================
  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);

    try {
      // Create user branch
      if (!editMode) {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: form.email,
          password: form.password
        });

        if (authError) throw authError;
        const userId = authData?.user?.id;

        if (!userId) throw new Error("Auth provider record provisioning anomaly.");

        const { error: insertError } = await supabase
          .from('users')
          .insert([
            {
              id: userId,
              full_name: form.full_name,
              email: form.email,
              phone: form.phone || null,
              role_id: form.role_id || null,
              institution_id: currentUserRole === 'SUPERADMIN' ? null : institutionId, // Superadmin provisions globally unattached rows
              status: 'active'
            }
          ]);

        if (insertError) throw insertError;
        alert("User account successfully registered.");
      }
      // Update existing record branch
      else {
        let updateQuery = supabase
          .from('users')
          .update({
            full_name: form.full_name,
            phone: form.phone || null,
            role_id: form.role_id || null
          })
          .eq('id', form.id);

        // Institutional operators can only edit identities inside their own company walls
        if (currentUserRole !== 'SUPERADMIN') {
          updateQuery = updateQuery.eq('institution_id', institutionId);
        }

        const { error } = await updateQuery;
        if (error) throw error;

        alert("User attributes updated successfully.");
      }

      resetForm();
      fetchUsers();

    } catch (err) {
      console.error("USER MANAGEMENT WRITER RUNTIME EXCEPTION:", err);
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // EDIT TRIGGER
  // =========================
  const handleEdit = (user) => {
    setForm({
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      phone: user.phone || '',
      password: '',
      role_id: user.role_id || ''
    });

    setEditMode(true);
  };

  // =========================
  // DELETE
  // =========================
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this operational account profile?")) return;

    try {
      let deleteQuery = supabase.from('users').delete().eq('id', id);

      if (currentUserRole !== 'SUPERADMIN') {
        deleteQuery = deleteQuery.eq('institution_id', institutionId);
      }

      const { error } = await deleteQuery;
      if (error) throw error;

      fetchUsers();
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

  // =========================
  // RESET FORM
  // =========================
  const resetForm = () => {
    setForm({
      id: null,
      full_name: '',
      email: '',
      phone: '',
      password: '',
      role_id: ''
    });
    setEditMode(false);
  };

  if (checkingSession) {
    return <div style={{ padding: '40px', color: '#64748b' }}>Verifying Security Clearing Context...</div>;
  }

  // =========================
  // UI RENDER LAYER
  // =========================
  return (
    <div style={{ display: 'flex', gap: 30, boxSizing: 'border-box', width: '100%' }}>

      {/* FORM INTERACTION DECK */}
      <div style={formBox}>
        <h2 style={{ marginTop: 0, fontSize: '20px', color: '#0f172a' }}>
          {editMode ? "🔧 Edit Staff Profile" : "👤 Create Staff User"}
        </h2>
        <p style={{ fontSize: '13px', color: '#64748b', marginTop: '-10px', marginBottom: '20px' }}>
          {currentUserRole === 'SUPERADMIN' ? 'Operating Mode: Platform-wide Provisioning' : 'Operating Mode: Tenant Branch Isolated'}
        </p>

        <input name="full_name" placeholder="Full Name" value={form.full_name} onChange={handleChange} style={input} />
        <input name="email" placeholder="Email Address" value={form.email} onChange={handleChange} style={input} disabled={editMode} />
        <input name="phone" placeholder="Phone Number" value={form.phone} onChange={handleChange} style={input} />

        {!editMode && (
          <input name="password" type="password" placeholder="Account Password" value={form.password} onChange={handleChange} style={input} />
        )}

        <select name="role_id" value={form.role_id} onChange={handleChange} style={input}>
          <option value="">Select Permitted Role Tier</option>
          {roles.map(role => (
            <option key={role.id} value={role.id}>
              {String(role.name).toUpperCase()}
            </option>
          ))}
        </select>

        <button onClick={handleSubmit} disabled={loading} style={btn}>
          {loading ? "Processing transaction..." : editMode ? "Save Changes" : "Register User Profile"}
        </button>

        {editMode && (
          <button onClick={resetForm} style={btnCancel}>
            Cancel Operations
          </button>
        )}
      </div>

      {/* DATA DATAGRID GRID VIEW */}
      <div style={{ flex: 1, background: '#fff', padding: '24px', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
        <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', color: '#0f172a' }}>Operational Core Personnel Registry</h3>

        <table width="100%" style={{ borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
              <th style={{ padding: '12px 8px' }}>Name</th>
              <th style={{ padding: '12px 8px' }}>Email Connection</th>
              <th style={{ padding: '12px 8px' }}>Role Reference Token</th>
              <th style={{ padding: '12px 8px', textAlign: 'right' }}>Management Controls</th>
            </tr>
          </thead>

          <tbody>
            {users.map(user => (
              <tr key={user.id} style={{ borderBottom: '1px solid #f1f5f9', color: '#334155' }}>
                <td style={{ padding: '12px 8px', fontWeight: '500' }}>{user.full_name}</td>
                <td style={{ padding: '12px 8px' }}>{user.email}</td>
                <td style={{ padding: '12px 8px' }}>
                  <span style={{
                    padding: '3px 8px', 
                    background: '#f1f5f9', 
                    borderRadius: '4px', 
                    fontSize: '12px', 
                    fontWeight: '600'
                  }}>
                    {user.role_id ? 'Assigned' : 'Unassigned Tier'}
                  </span>
                </td>
                <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                  <button onClick={() => handleEdit(user)} style={inlineEditBtn}>Edit</button>
                  <button onClick={() => handleDelete(user.id)} style={inlineDeleteBtn}>Delete</button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan="4" style={{ textAlign: 'center', color: '#94a3b8', padding: '30px', fontStyle: 'italic' }}>
                  No team profiles found under this workspace filter scope.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}

// =========================
// DESIGN SYSTEM DESIGN CONFIG
// =========================
const formBox = {
  width: 350,
  padding: '24px',
  background: '#fff',
  borderRadius: 10,
  boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
  boxSizing: 'border-box'
};

const input = {
  width: '100%',
  padding: '11px 14px',
  marginBottom: '14px',
  boxSizing: 'border-box',
  borderRadius: '6px',
  border: '1px solid #cbd5e1',
  fontSize: '14px',
  fontFamily: 'inherit'
};

const btn = {
  width: '100%',
  padding: '12px',
  background: '#2563eb',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  fontWeight: '600',
  fontSize: '14px'
};

const btnCancel = {
  width: '100%',
  padding: '12px',
  background: '#64748b',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  fontWeight: '600',
  fontSize: '14px',
  marginTop: 10
};

const inlineEditBtn = {
  padding: '6px 12px',
  background: '#f1f5f9',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  marginRight: '6px',
  color: '#1e293b',
  fontWeight: '600',
  fontSize: '12px'
};

const inlineDeleteBtn = {
  padding: '6px 12px',
  background: '#fef2f2',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  color: '#ef4444',
  fontWeight: '600',
  fontSize: '12px'
};

export default UserManagement;