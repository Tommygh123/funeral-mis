import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabase';
import { useNavigate, useLocation } from 'react-router-dom';

function GlobalSubscriptionGuard({ children }) {
  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Dynamically detect if we are on an upgrade-related path
  const isUpgradeRoute = location.pathname.includes('/upgrade');

  useEffect(() => {
    const checkStatus = async () => {
      if (isUpgradeRoute) {
        setLoading(false);
        return;
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { navigate('/login'); return; }

        const { data: profile } = await supabase
          .from('users')
          .select('institution_id')
          .eq('id', user.id)
          .single();

        if (!profile) { navigate('/login'); return; }

        const { data: activeSub } = await supabase
          .from('subscriptions')
          .select('id')
          .eq('institution_id', profile.institution_id)
          .eq('status', 'active')
          .gt('expires_at', new Date().toISOString())
          .maybeSingle();

        setExpired(!activeSub);
      } catch (err) { 
        console.error("Guard Check Error:", err); 
      } finally { 
        setLoading(false); 
      }
    };
    checkStatus();
  }, [location.pathname, navigate, isUpgradeRoute]);

  if (loading) return <div style={styles.center}>Verifying Subscription...</div>;

  if (expired && !isUpgradeRoute) {
    return (
      <div style={styles.lockoutOverlay}>
        <style>{blinkKeyframes}</style>
        <h1 style={styles.blink}>⚠️ SUBSCRIPTION EXPIRED</h1>
        <p style={styles.text}>Your access is restricted. Please upgrade your plan to continue.</p>
        <button onClick={() => navigate('/admin/upgrade')} style={styles.upgradeBtn}>
          Upgrade Plan Now
        </button>
      </div>
    );
  }

  return <>{children}</>;
}

const blinkKeyframes = `@keyframes blink { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } }`;
const styles = {
  center: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#64748b' },
  lockoutOverlay: { padding: '60px 20px', textAlign: 'center', background: '#fff', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' },
  blink: { animation: 'blink 1.5s linear infinite', color: '#dc2626', fontSize: '3rem', marginBottom: '20px' },
  text: { color: '#475569', fontSize: '1.1rem', maxWidth: '500px', marginBottom: '30px', lineHeight: '1.6' },
  upgradeBtn: { padding: '16px 32px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' }
};

export default GlobalSubscriptionGuard;