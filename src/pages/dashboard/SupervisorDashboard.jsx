import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabase';

function Dashboard() {
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    setLoading(true);
    
    // 1. Get current user's institution
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: userData } = await supabase
      .from('users')
      .select('institution_id')
      .eq('id', user.id)
      .single();

    if (userData?.institution_id) {
      // 2. Fetch all transactions for this specific institution
      const { data, error } = await supabase
        .from('transactions')
        .select('amount, currency')
        .eq('institution_id', userData.institution_id);

      if (!error && data) {
        // 3. Aggregate totals by currency
        const totals = data.reduce((acc, item) => {
          const amount = parseFloat(item.amount || 0);
          acc[item.currency] = (acc[item.currency] || 0) + amount;
          return acc;
        }, {});
        
        setStats(totals);
      }
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: '40px', fontFamily: 'system-ui, sans-serif', background: '#f8fafc', minHeight: '100vh' }}>
      <h1 style={{ marginBottom: '30px', color: '#0f172a' }}>Management Dashboard</h1>
      
      {loading ? (
        <p>Loading financial data...</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          {Object.keys(stats).length > 0 ? (
            Object.entries(stats).map(([currency, total]) => (
              <div key={currency} style={cardStyle}>
                <h3 style={{ color: '#64748b', fontSize: '0.9rem', textTransform: 'uppercase', marginBottom: '10px' }}>
                  Total Collections ({currency})
                </h3>
                <p style={{ fontSize: '2.5rem', fontWeight: '800', margin: 0, color: '#1e293b' }}>
                  {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
                <span style={{ color: '#059669', fontSize: '0.85rem' }}>Verified Institution Records</span>
              </div>
            ))
          ) : (
            <div style={cardStyle}>
              <p>No transaction data found for this institution.</p>
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: '40px', background: '#fff', padding: '25px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '15px' }}>Quick Actions</h2>
        <p style={{ color: '#475569' }}>Use the navigation menu to process new entries or manage donor records.</p>
      </div>
    </div>
  );
}

const cardStyle = {
  background: '#fff',
  padding: '30px',
  borderRadius: '16px',
  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)',
  border: '1px solid #e2e8f0'
};

export default Dashboard;