import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabase';
import { useNavigate } from 'react-router-dom';

function SubscriptionGuard({ children }) {
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [limitData, setLimitData] = useState({ used: 0, max: 0 });
  const navigate = useNavigate();

  useEffect(() => {
    const verify = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return navigate('/login');

        const { data: profile } = await supabase
          .from('users')
          .select('institution_id')
          .eq('id', user.id)
          .single();
        
        if (!profile) return navigate('/login');

        const { data: inst } = await supabase
          .from('institutions')
          .select('total_funerals_registered, funeral_limit_per_month')
          .eq('id', profile.institution_id)
          .single();

        if (inst.total_funerals_registered >= inst.funeral_limit_per_month) {
          setBlocked(true);
        }
        setLimitData({ 
          used: inst.total_funerals_registered, 
          max: inst.funeral_limit_per_month 
        });
      } catch (err) { 
        console.error("SubscriptionGuard Verification Error:", err); 
      } finally { 
        setLoading(false); 
      }
    };
    verify();
  }, [navigate]);

  if (loading) return <div style={styles.container}>Validating access...</div>;

  if (blocked) {
    return (
      <div style={styles.blockContainer}>
        {/* Red Warning Symbol */}
        <div style={styles.iconBox}>
          <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
        </div>
        <h2 style={styles.heading}>Trial Limit Reached</h2>
        <p style={styles.text}>
          You have registered <strong>{limitData.used}</strong> out of your <strong>{limitData.max}</strong> allowed funerals. 
          To register additional records, please upgrade your subscription plan.
        </p>
        <button 
          onClick={() => navigate('/admin/upgrade')} 
          style={styles.button}
        >
          View Plans & Upgrade
        </button>
      </div>
    );
  }

  return <>{children}</>;
}

const styles = {
  container: { padding: '80px', textAlign: 'center', color: '#64748b' },
  blockContainer: { 
    padding: '40px', 
    maxWidth: '450px', 
    margin: '80px auto', 
    textAlign: 'center', 
    background: '#fff', 
    borderRadius: '16px', 
    border: '1px solid #fee2e2',
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
  },
  iconBox: { marginBottom: '20px' },
  heading: { color: '#dc2626', margin: '0 0 16px 0' },
  text: { color: '#475569', marginBottom: '24px', lineHeight: '1.5' },
  button: { 
    padding: '12px 24px', 
    background: '#dc2626', 
    color: '#fff', 
    border: 'none', 
    borderRadius: '8px', 
    cursor: 'pointer', 
    fontWeight: 'bold',
    transition: 'background 0.2s'
  }
};

export default SubscriptionGuard;