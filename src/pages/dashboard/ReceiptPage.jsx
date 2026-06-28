import React, { useEffect, useState } from 'react';
import { useNavigate, Outlet } from 'react-router-dom';
import { supabase } from '../../supabase';

function DashboardLayout() {

  const navigate = useNavigate();

  const [institution, setInstitution] = useState({
    name: '',
    logo_url: ''
  });

  useEffect(() => {
    loadInstitution();
  }, []);

  const loadInstitution = async () => {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return;

    const { data: profile } = await supabase
      .from('users')
      .select('institution_id')
      .eq('id', user.id)
      .single();

    const institutionId = profile?.institution_id;

    if (!institutionId) return;

    const { data } = await supabase
      .from('institutions')
      .select('name, logo_url')
      .eq('id', institutionId)
      .single();

    setInstitution({
      name: data?.name || 'Institution',
      logo_url: data?.logo_url || ''
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <div style={styles.wrapper}>

      {/* SIDEBAR */}
      <div style={styles.sidebar}>

        <div>
          <h3 style={{ color: '#fff' }}>
            {institution.name || 'LegacyCloud'}
          </h3>
        </div>

        <div style={styles.menu}>

          <button style={btn} onClick={() => navigate('/admin')}>
            Dashboard
          </button>

          <button style={btn} onClick={() => navigate('/admin/create-user')}>
            Create User
          </button>

          <button style={btn} onClick={() => navigate('/admin/manage-users')}>
            Manage Users
          </button>

          <button style={btn} onClick={() => navigate('/admin/funerals/create')}>
            Register Funeral
          </button>

          <button style={btn} onClick={() => navigate('/admin/funerals')}>
            Funeral List
          </button>

                  

          <button style={btn} onClick={() => navigate('/admin/reports')}>
            Reports
          </button>

           <button style={btn} onClick={() => navigate('/admin/settings')}>
            Settings
          </button>

        </div>

        <button
          style={{ ...btn, background: 'red', marginTop: 'auto' }}
          onClick={handleLogout}
        >
          Logout
        </button>

      </div>

      {/* MAIN */}
      <div style={styles.main}>
        <Outlet />
      </div>

    </div>
  );
}

const styles = {
  wrapper: {
    display: 'flex',
    height: '100vh',
    fontFamily: 'Arial'
  },
  sidebar: {
    width: '260px',
    background: '#0b1f3a',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column'
  },
  menu: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginTop: '20px'
  },
  main: {
    flex: 1,
    padding: '20px',
    background: '#f5f7fb'
  }
};

const btn = {
  padding: '12px',
  border: 'none',
  borderRadius: '6px',
  background: '#1f2937',
  color: '#fff',
  textAlign: 'left',
  cursor: 'pointer'
};

export default DashboardLayout;