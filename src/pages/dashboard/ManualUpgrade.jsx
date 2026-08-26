import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabase';
import { useToast } from '../../components/ui/ToastProvider';

const extensionOptions = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '3 months', days: 90 },
  { label: '6 months', days: 180 },
  { label: '1 year', days: 365 },
];

function ManualUpgrade() {
  const notifications = useToast();
  const [view, setView] = useState('paid');
  const [institutions, setInstitutions] = useState([]);
  const [payments, setPayments] = useState([]);
  const [totals, setTotals] = useState({ GHS: 0, USD: 0 });
  const [manual, setManual] = useState({ inst_id: '', plan: 'LOCAL_BASIC', amount: 500, max_funerals: 1, ref: '', market: 'local' });
  const [extension, setExtension] = useState({ inst_id: '', option: '30', custom_days: '', reason: '' });
  const [busy, setBusy] = useState(false);
  const [systemSettings, setSystemSettings] = useState({ price_local_base: 500, price_local_stream: 300, price_business_volume: 1500 });

  const fetchData = useCallback(async () => {
    const [{ data: instData, error: instError }, { data: configs }, { data: payData }] = await Promise.all([
      supabase.from('institutions').select('id, name, subscription_plan, subscription_status, subscription_end_date').order('name'),
      supabase.from('system_global_configs').select('config_key, config_value'),
      supabase.from('offline_payments').select('amount, currency, plan_name, momo_ref, created_at, institutions(name)').order('created_at', { ascending: false }),
    ]);

    if (instError) notifications.error(instError.message);
    if (instData) setInstitutions(instData);
    if (payData) {
      setPayments(payData);
      setTotals(payData.reduce((result, payment) => {
        if (Object.prototype.hasOwnProperty.call(result, payment.currency)) result[payment.currency] += Number(payment.amount || 0);
        return result;
      }, { GHS: 0, USD: 0 }));
    }
    if (configs) {
      const next = {};
      configs.forEach((row) => { if (Object.prototype.hasOwnProperty.call(systemSettings, row.config_key)) next[row.config_key] = Number(row.config_value); });
      setSystemSettings((current) => ({ ...current, ...next }));
    }
  }, [notifications]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const selectedInstitution = useMemo(
    () => institutions.find((item) => item.id === extension.inst_id),
    [extension.inst_id, institutions],
  );

  const extensionDays = extension.option === 'custom' ? Number(extension.custom_days) : Number(extension.option);

  const handlePaidUpgrade = async (event) => {
    event.preventDefault();
    if (!manual.inst_id) return notifications.warning('Please select an institution.');
    if (!manual.ref.trim()) return notifications.warning('Transaction reference is required for a paid upgrade.');
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.rpc('manual_admin_upgrade', {
        p_target_id: manual.inst_id,
        p_plan_name: manual.plan,
        p_amount: Number(manual.amount),
        p_currency: manual.market === 'local' ? 'GHS' : 'USD',
        p_max_funerals: Number(manual.max_funerals),
        p_billing_market: manual.market,
        p_momo_ref: manual.ref.trim(),
        p_admin_user_id: user?.id,
        p_livestream_enabled: manual.plan === 'LOCAL_STREAM' || manual.plan === 'BUSINESS',
      });
      if (error) throw error;
      notifications.success('Paid manual upgrade completed successfully.');
      setManual({ inst_id: '', plan: 'LOCAL_BASIC', amount: 500, max_funerals: 1, ref: '', market: 'local' });
      await fetchData();
    } catch (error) {
      notifications.error(`Upgrade failed: ${error.message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleComplimentaryExtension = async (event) => {
    event.preventDefault();
    if (!extension.inst_id) return notifications.warning('Please select an institution.');
    if (!Number.isInteger(extensionDays) || extensionDays < 1 || extensionDays > 3650) return notifications.warning('Extension must be between 1 and 3650 days.');
    if (extension.reason.trim().length < 5) return notifications.warning('Enter a reason of at least 5 characters.');

    const confirmed = window.confirm(`Extend ${selectedInstitution?.name || 'this institution'} by ${extensionDays} day(s) without payment?`);
    if (!confirmed) return;

    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('funeralmis_extend_subscription', {
        p_institution_id: extension.inst_id,
        p_days: extensionDays,
        p_reason: extension.reason.trim(),
      });
      if (error) throw error;
      notifications.success(data?.message || 'Subscription extended successfully.');
      setExtension({ inst_id: '', option: '30', custom_days: '', reason: '' });
      await fetchData();
    } catch (error) {
      notifications.error(`Extension failed: ${error.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page-padding" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <h1>Subscription Administration</h1>
      <div className="flex-row-wrap" style={{ gap: 10, marginBottom: 24 }}>
        <TabButton active={view === 'paid'} onClick={() => setView('paid')}>Paid Upgrade</TabButton>
        <TabButton active={view === 'complimentary'} onClick={() => setView('complimentary')}>Complimentary Extension</TabButton>
        <TabButton active={view === 'history'} onClick={() => setView('history')}>Payment History</TabButton>
      </div>

      {view === 'paid' && (
        <Panel title="Manual Paid Upgrade" subtitle="Use only after confirming an offline payment.">
          <form onSubmit={handlePaidUpgrade} style={formStyle}>
            <InstitutionSelect institutions={institutions} value={manual.inst_id} onChange={(value) => setManual({ ...manual, inst_id: value })} />
            <select value={manual.market} onChange={(e) => setManual({ ...manual, market: e.target.value })} style={controlStyle}>
              <option value="local">Local Market (GHS)</option><option value="diaspora">Diaspora Market (USD)</option>
            </select>
            <select value={manual.plan} onChange={(e) => {
              const plan = e.target.value;
              const prices = { LOCAL_BASIC: systemSettings.price_local_base, LOCAL_STREAM: systemSettings.price_local_stream, BUSINESS: systemSettings.price_business_volume };
              setManual({ ...manual, plan, amount: prices[plan] || 0, max_funerals: plan === 'BUSINESS' ? 5 : 1 });
            }} style={controlStyle}>
              <option value="LOCAL_BASIC">Local Basic</option><option value="LOCAL_STREAM">Local Stream</option><option value="BUSINESS">Business Volume</option>
            </select>
            <input value={manual.ref} onChange={(e) => setManual({ ...manual, ref: e.target.value })} placeholder="Transaction reference" style={controlStyle} />
            <button type="submit" disabled={busy} style={primaryButton}>{busy ? 'Processing...' : 'Confirm Paid Upgrade'}</button>
          </form>
        </Panel>
      )}

      {view === 'complimentary' && (
        <Panel title="Extend Without Payment" subtitle="SUPERADMIN only. Every extension is recorded in the system audit log.">
          <form onSubmit={handleComplimentaryExtension} style={formStyle}>
            <InstitutionSelect institutions={institutions} value={extension.inst_id} onChange={(value) => setExtension({ ...extension, inst_id: value })} />
            {selectedInstitution && (
              <div style={currentBox}>
                <strong>{selectedInstitution.name}</strong>
                <span>Current expiry: {selectedInstitution.subscription_end_date ? new Date(selectedInstitution.subscription_end_date).toLocaleString() : 'No expiry recorded'}</span>
                <span>Status: {selectedInstitution.subscription_status || 'Not set'} · Plan: {selectedInstitution.subscription_plan || 'Not set'}</span>
              </div>
            )}
            <select value={extension.option} onChange={(e) => setExtension({ ...extension, option: e.target.value })} style={controlStyle}>
              {extensionOptions.map((item) => <option key={item.days} value={item.days}>{item.label}</option>)}
              <option value="custom">Custom number of days</option>
            </select>
            {extension.option === 'custom' && <input type="number" min="1" max="3650" value={extension.custom_days} onChange={(e) => setExtension({ ...extension, custom_days: e.target.value })} placeholder="Days" style={controlStyle} />}
            <textarea value={extension.reason} onChange={(e) => setExtension({ ...extension, reason: e.target.value })} placeholder="Reason for complimentary extension (required)" rows="4" style={controlStyle} />
            <button type="submit" disabled={busy} style={{ ...primaryButton, background: '#7c3aed' }}>{busy ? 'Extending...' : 'Extend Subscription Without Payment'}</button>
          </form>
        </Panel>
      )}

      {view === 'history' && (
        <Panel title="Offline Payment History" subtitle={`GHS ${totals.GHS.toLocaleString()} · USD ${totals.USD.toLocaleString()}`}>
          <div className="table-wrapper"><table><thead><tr><th>Date</th><th>Institution</th><th>Plan</th><th>Amount</th><th>Reference</th></tr></thead><tbody>
            {payments.map((payment, index) => <tr key={`${payment.created_at}-${index}`}><td>{new Date(payment.created_at).toLocaleDateString()}</td><td>{payment.institutions?.name || '—'}</td><td>{payment.plan_name || '—'}</td><td>{payment.currency} {Number(payment.amount || 0).toLocaleString()}</td><td>{payment.momo_ref || '—'}</td></tr>)}
          </tbody></table></div>
        </Panel>
      )}
    </div>
  );
}

const TabButton = ({ active, children, onClick }) => <button type="button" onClick={onClick} style={{ ...tabButton, background: active ? '#2563eb' : '#fff', color: active ? '#fff' : '#334155' }}>{children}</button>;
const Panel = ({ title, subtitle, children }) => <section style={panelStyle}><h2 style={{ margin: 0 }}>{title}</h2><p style={{ color: '#64748b', marginTop: 6 }}>{subtitle}</p>{children}</section>;
const InstitutionSelect = ({ institutions, value, onChange }) => <select value={value} onChange={(e) => onChange(e.target.value)} style={controlStyle}><option value="">Select institution</option>{institutions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>;
const panelStyle = { background: '#fff', padding: 24, borderRadius: 12, border: '1px solid #e2e8f0', maxWidth: 760 };
const formStyle = { display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 520, marginTop: 20 };
const controlStyle = { width: '100%', padding: 12, border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff' };
const primaryButton = { padding: '12px 18px', background: '#2563eb', color: '#fff', border: 0, borderRadius: 8, cursor: 'pointer', fontWeight: 700 };
const tabButton = { padding: '10px 16px', border: '1px solid #cbd5e1', borderRadius: 8, cursor: 'pointer', fontWeight: 650 };
const currentBox = { display: 'flex', flexDirection: 'column', gap: 5, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14, color: '#475569' };

export default ManualUpgrade;
