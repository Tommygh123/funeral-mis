import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Settings, MessageSquare, CreditCard, FileText, 
  Users, UserPlus, Home, Receipt, RefreshCcw, Terminal 
} from 'react-icons/lu';

// Your existing structure remains completely untouched
const MENU_BY_ROLE = {
  superadmin: [
    { label: 'Platform Overview', path: '/superadmin' },
    { label: 'Global Settings', path: '/superadmin/settings' },
    { label: 'SMS Logs', path: '/superadmin/sms-logs' },
    { label: 'Subscriptions', path: '/superadmin/subscriptions' },
    { label: 'Reports', path: '/superadmin/reports' }
  ],
  admin: [
    { label: 'Dashboard', path: '/admin' },
    { label: 'Users → Create', path: '/admin/create-user' },
    { label: 'Users → Manage', path: '/admin/manage-users' },
    { label: 'Funeral → Register', path: '/admin/funerals/create' },
    { label: 'Funeral → List', path: '/admin/funerals' },
    { label: 'Subscription', path: '/admin/subscription' },
    { label: 'Reports', path: '/admin/reports' },
    { label: 'Settings', path: '/admin/settings' }
  ],
  supervisor: [
    { label: 'Overview', path: '/supervisor' },
    { label: 'Donations → Verify', path: '/supervisor/donations' },
    { label: 'Receipts', path: '/supervisor/receipts' },
    { label: 'Reversals', path: '/supervisor/reversals' },
    { label: 'Reports', path: '/supervisor/reports' },
    { label: 'SMS Audits', path: '/supervisor/sms' }
  ],
  cashier: [
    { label: 'Dashboard', path: '/cashier' },
    { label: 'Enter Donation', path: '/cashier/donations' },
    { label: 'Receipts', path: '/cashier/receipts' },
    { label: 'Reports', path: '/cashier/reports' },
    { label: 'SMS Logs', path: '/cashier/sms' }
  ],
  viewer: [
    { label: 'Dashboard', path: '/viewer' },
    { label: 'Reports', path: '/viewer/reports' }
  ]
};

// Helper to assign icons without modifying your MENU_BY_ROLE object
const getIconForLabel = (label) => {
  const l = label.toLowerCase();
  if (l.includes('dashboard') || l.includes('overview')) return <LayoutDashboard />;
  if (l.includes('user')) return <Users />;
  if (l.includes('funeral')) return <Home />;
  if (l.includes('sms')) return <MessageSquare />;
  if (l.includes('report')) return <FileText />;
  if (l.includes('subscription')) return <CreditCard />;
  if (l.includes('receipt')) return <Receipt />;
  if (l.includes('reversal')) return <RefreshCcw />;
  if (l.includes('setting')) return <Settings />;
  return <Terminal />;
};

function Sidebar({ role }) {
  const navigate = useNavigate();
  const location = useLocation();
  const menuItems = MENU_BY_ROLE[role?.toLowerCase()] || [];

  return (
    <nav style={styles.menu}>
      {menuItems.map((item) => {
        const isActive = location.pathname === item.path;
        return (
          <button 
            key={item.path} 
            onClick={() => navigate(item.path)} 
            style={{ 
              ...styles.btn, 
              background: isActive ? '#1e293b' : 'transparent',
              color: isActive ? '#ffffff' : '#94a3b8',
              borderLeft: isActive ? '4px solid #2563eb' : '4px solid transparent'
            }}
          >
            <span style={styles.icon}>{getIconForLabel(item.label)}</span>
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}

const styles = {
  menu: { display: 'flex', flexDirection: 'column', gap: '4px' },
  btn: { 
    padding: '12px 16px', 
    border: 'none', 
    textAlign: 'left', 
    cursor: 'pointer', 
    background: 'transparent', 
    color: '#94a3b8', 
    display: 'flex', 
    alignItems: 'center', 
    gap: '12px',
    fontSize: '14px',
    transition: 'all 0.2s ease'
  },
  icon: { display: 'flex', fontSize: '18px' }
};

export default Sidebar;