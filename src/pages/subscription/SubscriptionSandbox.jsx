import React, { useState, useEffect } from 'react';
import { supabase } from "@/lib/supabase";

function SubscriptionSandbox() {
  const [institutions, setInstitutions] = useState([]);
  const [selectedInstId, setSelectedInstId] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(null);

  // 1. Fetch available institution workspaces in your local dev ecosystem
  const fetchEnvironments = async () => {
    const { data, error } = await supabase
      .from('institutions')
      .select('id, name, subscription_plan, subscription_status, local_tokens_balance, diaspora_tokens_balance, sms_balance');
    if (!error && data) {
      setInstitutions(data);
      if (data.length > 0 && !selectedInstId) {
        setSelectedInstId(data[0].id);
      }
    }
  };

  useEffect(() => {
    fetchEnvironments();
  }, []);

  // Fetch live stats for the selected workspace to verify changes visually
  useEffect(() => {
    if (!selectedInstId) return;
    const inst = institutions.find(i => i.id === selectedInstId);
    setCurrentStatus(inst || null);
  }, [selectedInstId, institutions]);

  // 2. Centralized pipeline to forcefully overwrite state shapes for testing edge cases
  const applyTestScenario = async (scenario) => {
    if (!selectedInstId) return alert('Select an institution to simulate.');
    setLoading(true);

    try {
      let instUpdates = {};
      let subInserts = {};
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5); // 5 days ago

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30); // 30 day validation window

      switch (scenario) {
        case 'EXPIRE_TRIAL':
          instUpdates = { subscription_plan: 'free_trial', subscription_status: 'expired', local_tokens_balance: 0 };
          subInserts = { plan_name: 'free_trial', billing_market: 'local', amount: 0, currency: 'GHS', max_funerals: 1, livestream_enabled: false, status: 'expired', expires_at: pastDate.toISOString() };
          break;

        case 'DEPLETE_TOKENS':
          instUpdates = { subscription_status: 'active', local_tokens_balance: 0, diaspora_tokens_balance: 0 };
          subInserts = { plan_name: 'free_trial', billing_market: 'local', amount: 0, currency: 'GHS', max_funerals: 1, livestream_enabled: false, status: 'active', expires_at: futureDate.toISOString() };
          break;

        case 'UPGRADE_PREMIUM_LOCAL':
          instUpdates = { subscription_plan: 'premium_local', subscription_status: 'active', local_tokens_balance: 10, sms_balance: 100 };
          subInserts = { plan_name: 'premium_local', billing_market: 'local', amount: 500, currency: 'GHS', max_funerals: 10, livestream_enabled: false, status: 'active', expires_at: futureDate.toISOString() };
          break;

        case 'UPGRADE_DIASPORA_STREAM':
          instUpdates = { subscription_plan: 'diaspora_premium', subscription_status: 'active', local_tokens_balance: 25, diaspora_tokens_balance: 5, sms_balance: 500 };
          subInserts = { plan_name: 'diaspora_premium', billing_market: 'international', amount: 150, currency: 'USD', max_funerals: 25, livestream_enabled: true, status: 'active', expires_at: futureDate.toISOString() };
          break;

        default:
          return;
      }

      // Execute synchronous mutations directly across your development database references
      const { error: instErr } = await supabase
        .from('institutions')
        .update(instUpdates)
        .eq('id', selectedInstId);
      if (instErr) throw instErr;

      const { error: subErr } = await supabase
        .from('subscriptions')
        .insert([{ institution_id: selectedInstId, ...subInserts }]);
      if (subErr) throw subErr;

      alert(`Scenario "${scenario}" successfully applied to database state.`);
      await fetchEnvironments(); // Sync application interface state view

    } catch (err) {
      console.error('Sandbox error:', err);
      alert(`Simulation abort: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>🛠️ FuneralMIS Subscription Sandbox Engine</h2>
      <p style={styles.desc}>Forcefully update database state matrices to instantly verify UI guards and token interceptors.</p>

      <div style={styles.controlGroup}>
        <label style={styles.label}>Target Active Workspace Environment:</label>
        <select 
          value={selectedInstId} 
          onChange={(e) => setSelectedInstId(e.target.value)}
          style={styles.select}
        >
          {institutions.map(inst => (
            <option key={inst.id} value={inst.id}>{inst.name} ({inst.subscription_plan})</option>
          ))}
        </select>
      </div>

      {currentStatus && (
        <div style={styles.monitorCard}>
          <h4>Current Live DB Values for: <span style={{color: '#2563eb'}}>{currentStatus.name}</span></h4>
          <div style={styles.grid}>
            <div><strong>Plan Tier:</strong> <code style={styles.code}>{currentStatus.subscription_plan}</code></div>
            <div><strong>Status Line:</strong> <code style={styles.code}>{currentStatus.subscription_status}</code></div>
            <div><strong>Local Tokens:</strong> <code style={styles.code}>{currentStatus.local_tokens_balance}</code></div>
            <div><strong>Diaspora Tokens:</strong> <code style={styles.code}>{currentStatus.diaspora_tokens_balance}</code></div>
            <div><strong>SMS Balance:</strong> <code style={styles.code}>{currentStatus.sms_balance}</code></div>
          </div>
        </div>
      )}

      <div style={styles.actionZone}>
        <h3>Trigger Mock Scenarios</h3>
        <div style={styles.btnGrid}>
          <button 
            disabled={loading} 
            onClick={() => applyTestScenario('EXPIRE_TRIAL')} 
            style={{...styles.btn, backgroundColor: '#dc2626'}}
          >
            💀 Simulate Trial Expiration (Date Expired & Balance 0)
          </button>

          <button 
            disabled={loading} 
            onClick={() => applyTestScenario('DEPLETE_TOKENS')} 
            style={{...styles.btn, backgroundColor: '#ea580c'}}
          >
            📉 Simulate Token Depletion (Plan Active but 0 Tokens)
          </button>

          <button 
            disabled={loading} 
            onClick={() => applyTestScenario('UPGRADE_PREMIUM_LOCAL')} 
            style={{...styles.btn, backgroundColor: '#16a34a'}}
          >
            💳 Upgrade to Premium Local (GHS 500 • 10 Tokens • No Streams)
          </button>

          <button 
            disabled={loading} 
            onClick={() => applyTestScenario('UPGRADE_DIASPORA_STREAM')} 
            style={{...styles.btn, backgroundColor: '#2563eb'}}
          >
            🌍 Upgrade to Diaspora Tier (USD 150 • Livestream Enabled)
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: { padding: '32px', background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', maxWidth: '800px', margin: '40px auto', fontFamily: 'system-ui, sans-serif' },
  title: { margin: '0 0 8px 0', color: '#0f172a' },
  desc: { color: '#64748b', fontSize: '14px', margin: '0 0 24px 0' },
  controlGroup: { marginBottom: '24px' },
  label: { display: 'block', fontWeight: 'bold', marginBottom: '8px', fontSize: '14px', color: '#334155' },
  select: { width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '15px' },
  monitorCard: { padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '24px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginTop: '12px', fontSize: '13px' },
  code: { background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace', color: '#0f172a' },
  actionZone: { borderTop: '1px solid #e2e8f0', paddingTop: '24px' },
  btnGrid: { display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' },
  btn: { color: '#fff', padding: '14px', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', textAlign: 'left', fontSize: '14px', transition: 'opacity 0.2s' }
};

export default SubscriptionSandbox;