import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, Outlet, useLocation } from 'react-router-dom';
import { supabase } from '../../supabase';

const MENU_BY_ROLE = {
  superadmin: [
    { label: 'Platform Engine', path: '/superadmin' },
    { label: 'Manual Upgrade', path: '/superadmin/manual-upgrade' },
    { label: 'Global Subscriptions', path: '/superadmin/subscriptions' },
    { label: 'Settings', path: '/superadmin/settings' },
    { label: 'SMS Logs', path: '/superadmin/sms-logs' },
    { label: 'Reports', path: '/superadmin/reports' }
  ],
  admin: [
    { label: 'Admin Dashboard', path: '/admin' },
    { label: 'Create User', path: '/admin/create-user' },
    { label: 'Manage Users', path: '/admin/manage-users' },
    { label: 'Register Funeral', path: '/admin/funerals/create' },
    { label: 'QR Generator', path: '/admin/qr-generator' },
    { label: 'Reports', path: '/admin/reports' },
    { label: 'Settings', path: '/admin/settings' }
  ],
  supervisor: [
    { label: 'Overview', path: '/supervisor' },
    { label: 'Receipt Search', path: '/supervisor/receipts' },
    { label: 'Reverse Entries', path: '/supervisor/reversals' },
    { label: 'System Reports', path: '/supervisor/reports' },
    { label: 'SMS Log Audits', path: '/supervisor/sms' }
  ],
  cashier: [
    { label: 'Dashboard', path: '/cashier' },
    { label: 'Enter Donation', path: '/cashier/donations' },
    { label: 'Receipt Search', path: '/cashier/receipts' },
    { label: 'Reports', path: '/cashier/reports' },
    { label: 'SMS Logs', path: '/cashier/sms' }
  ],
  viewer: [
    { label: 'Dashboard', path: '/viewer' },
    { label: 'Executive Reports', path: '/viewer/reports' }
  ],
  funeralhead: [
    { label: 'Family Dashboard', path: '/funeralhead' }
  ]
};

const INST_CACHE_KEY = 'legacy_cloud_inst_context';

function DashboardLayout({ role }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isInitialized = useRef(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const [institution, setInstitution] = useState({ name: 'LegacyCloud', logo_url: '', streaming_enabled: false, sub_end: null });
  const [loading, setLoading] = useState(true);

  const activeRoleKey = String(role || '').toLowerCase().trim();
  const menuItems = MENU_BY_ROLE[activeRoleKey] || [];

  const loadInstitution = useCallback(async () => {
    if (isInitialized.current) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/login', { replace: true }); return; }

      const { data: profile } = await supabase.from('users').select('institution_id').eq('id', user.id).single();

      if (activeRoleKey === 'superadmin') {
        setInstitution({ name: 'System Global HQ', logo_url: '', streaming_enabled: true, sub_end: null });
      } else if (profile?.institution_id) {
        const { data: instData } = await supabase.from('institutions').select('name, logo_url, streaming_enabled, subscription_end_date').eq('id', profile.institution_id).single();
        if (instData) {
          const resolution = { name: instData.name, logo_url: instData.logo_url, streaming_enabled: instData.streaming_enabled, sub_end: instData.subscription_end_date };
          setInstitution(resolution);
          localStorage.setItem(INST_CACHE_KEY, JSON.stringify(resolution));
        }
      }
      isInitialized.current = true;
    } catch (error) { console.error('[TENANT_LOAD_ERROR]:', error.message); } finally { setLoading(false); }
  }, [activeRoleKey, navigate]);

  useEffect(() => { loadInstitution(); }, [loadInstitution]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  const isExpiringSoon = institution.sub_end && (new Date(institution.sub_end) - new Date()) < (7 * 24 * 60 * 60 * 1000);

  const handleLogout = async () => {
    localStorage.removeItem(INST_CACHE_KEY);
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  };

  const handleNav = (path) => {
    navigate(path);
    setSidebarOpen(false);
  };

  if (loading) return <div style={styles.loader}>Initializing Workspace...</div>;

  return (
    <div className="dashboard-shell">
      <div className="dashboard-mobile-header no-print">
        <button
          type="button"
          className="mobile-nav-toggle"
          onClick={() => setSidebarOpen((open) => !open)}
          aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
        >
          {sidebarOpen ? '✕' : '☰'}
        </button>
        <span style={{ fontWeight: 600, fontSize: '14px' }}>{institution.name}</span>
      </div>

      <div
        className={`sidebar-overlay ${sidebarOpen ? 'visible' : ''}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      <aside className={`dashboard-sidebar no-print ${sidebarOpen ? 'open' : ''}`}>
        <div>
          <div style={styles.brandBox}>
            <h3 style={styles.brandText}>LegacyCloud</h3>
            <span style={styles.roleSub}>{role?.toUpperCase() || 'DOMAIN'}</span>
            <div style={{ marginTop: '8px', fontSize: '11px', color: '#94a3b8', fontWeight: '500' }}>{institution.name}</div>
            {isExpiringSoon && <div style={styles.warningBanner}>⚠️ Subscription ends soon!</div>}
          </div>
          <nav style={styles.menu}>
            {menuItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => handleNav(item.path)}
                  className={`sidebar-nav-btn ${isActive ? 'active' : ''}`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>
        <button type="button" className="sidebar-logout-btn" onClick={handleLogout}>
          Close Session
        </button>
      </aside>

      <main className="dashboard-main">
        <Outlet />
      </main>
    </div>
  );
}

const styles = {
  loader: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#64748b' },
  brandBox: { marginBottom: '32px', color: '#fff', borderBottom: '1px solid #1e293b', paddingBottom: '16px' },
  brandText: { fontSize: '18px', margin: '0 0 4px 0', letterSpacing: '0.02em' },
  roleSub: { fontSize: '10px', color: '#fbbf24', fontWeight: '700', letterSpacing: '0.05em' },
  warningBanner: { marginTop: '10px', fontSize: '10px', color: '#f59e0b', fontWeight: 'bold' },
  menu: { display: 'flex', flexDirection: 'column', gap: '8px' }
};

export default DashboardLayout;
