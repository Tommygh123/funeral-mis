import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabase';

function SmsLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('users')
        .select('institution_id')
        .eq('id', user.id)
        .single();

      const { data, error } = await supabase
        .from('sms_logs')
        .select('*')
        .eq('institution_id', profile.institution_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error('Error loading SMS logs:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={container}>
      <h2 style={title}>SMS Activity Logs</h2>
      <div style={tableContainer}>
        <table style={table}>
          <thead>
            <tr style={thead}>
              <th style={th}>Recipient</th>
              <th style={th}>Message</th>
              <th style={th}>Status</th>
              <th style={th}>Date</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="4" style={cell}>Loading logs...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan="4" style={cell}>No logs found.</td></tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} style={tr}>
                  {/* Updated to match your DB schema: log.phone and log.message */}
                  <td style={cell}>{log.phone}</td>
                  <td style={cell}>{log.message}</td>
                  <td style={cell}>
                    <span style={{ 
                      ...statusBadge, 
                      background: log.status === 'sent' ? '#dcfce7' : '#fee2e2',
                      color: log.status === 'sent' ? '#166534' : '#991b1b'
                    }}>
                      {log.status}
                    </span>
                  </td>
                  <td style={cell}>{new Date(log.created_at).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const container = { padding: '20px' };
const title = { color: '#0f172a', marginBottom: '20px' };
const tableContainer = { background: '#fff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' };
const table = { width: '100%', borderCollapse: 'collapse' };
const thead = { background: '#f8fafc', borderBottom: '1px solid #e2e8f0' };
const th = { padding: '12px', textAlign: 'left', fontSize: '14px', color: '#64748b' };
const tr = { borderBottom: '1px solid #e2e8f0' };
const cell = { padding: '12px', fontSize: '14px' };
const statusBadge = { padding: '4px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' };

export default SmsLogs;