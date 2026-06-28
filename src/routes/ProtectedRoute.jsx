import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabase';
import { Navigate } from 'react-router-dom';

function ProtectedRoute({ children, allowedRole, allowedRoles }) {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [denied, setDenied] = useState(false);

  const verifyAccessMatrix = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setAuthorized(false);
        setLoading(false);
        return;
      }

      // Fetch user profile
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('role_id')
        .eq('id', session.user.id)
        .single();

      if (profileError) throw new Error("Could not fetch user profile.");

      // Fetch role name
      const { data: roleData, error: roleError } = await supabase
        .from('roles')
        .select('name')
        .eq('id', profile.role_id)
        .single();

      if (roleError) throw new Error("Could not fetch user role details.");

      const userRole = String(roleData.name || '').trim().toUpperCase();
      
      // Determine allowed roles list
      // 1. Prioritize allowedRoles array
      // 2. Fallback to allowedRole string
      // 3. If neither, allow access (or default to false based on your security needs)
      const rolesToMatch = (allowedRoles && allowedRoles.length > 0) 
        ? allowedRoles 
        : (allowedRole ? [allowedRole] : []);

      // If no roles are specified, we assume public access or strictly block?
      // Defaulting to "denied" if no role restrictions are provided is safer.
      if (rolesToMatch.length === 0) {
        setAuthorized(true); 
      } else {
        const isAuthorized = rolesToMatch.some(r => 
          String(r).trim().toUpperCase() === userRole
        );
        
        if (isAuthorized) {
          setAuthorized(true);
        } else {
          console.warn(`🛑 Access Denied: User (${userRole}) not in allowed list (${rolesToMatch.join(', ')})`);
          setDenied(true);
        }
      }
    } catch (err) {
      console.error("🔒 Security guard malfunction:", err.message);
      setAuthorized(false);
      setDenied(true);
    } finally {
      setLoading(false);
    }
  }, [allowedRole, allowedRoles]);

  useEffect(() => {
    verifyAccessMatrix();
  }, [verifyAccessMatrix]);

  if (loading) {
    return (
      <div style={styles.loaderContainer}>
        <h3 style={styles.heading}>Securing Network Node...</h3>
      </div>
    );
  }

  if (denied) {
    return (
      <div style={styles.loaderContainer}>
        <div style={styles.textCenter}>
          <h2>Access Denied</h2>
          <p>Insufficient clearance.</p>
          <button 
            onClick={() => window.history.back()} 
            style={styles.backBtn}
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }
  
  return authorized ? children : <Navigate to="/login" replace />;
}

const styles = {
  loaderContainer: { 
    minHeight: '100vh', 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    background: '#0f172a', 
    color: '#ffffff', 
    flexDirection: 'column',
    padding: '20px'
  },
  textCenter: { textAlign: 'center' },
  heading: { margin: '0 0 8px 0' },
  backBtn: {
    padding: '10px 20px',
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    marginTop: '15px'
  }
};

export default ProtectedRoute;