import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabase';

function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('system_audit_logs')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) console.error("Audit Fetch Error:", error);
    setLogs(data || []);
    setLoading(false);
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>📜 System Audit Trail</h2>
      <button onClick={fetchLogs} style={styles.refreshBtn}>🔄 Refresh Logs</button>
      
      <div className="table-wrapper">
      <table style={styles.table}>
        <thead>
          <tr style={styles.trHead}>
            <th>Timestamp</th>
            <th>Admin</th>
            <th>Action</th>
            <th>Target ID</th>
          </tr>
        </thead>
        <tbody>
          {logs.map(log => (
            <tr key={log.id} style={styles.trBody}>
              <td>{new Date(log.created_at).toLocaleString()}</td>
              <td>{log.admin_email}</td>
              <td><span style={styles.badge}>{log.action}</span></td>
              <td style={{ fontSize: '10px', color: '#64748b' }}>{log.target_id}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

const styles = {
  container: { padding: '24px', background: '#fff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
  title: { fontSize: '18px', marginBottom: '16px', color: '#1e293b' },
  refreshBtn: { marginBottom: '15px', padding: '8px 12px', cursor: 'pointer' },
  table: { width: '100%', borderCollapse: 'collapse' },
  trHead: { background: '#f8fafc', textAlign: 'left', padding: '10px' },
  trBody: { borderBottom: '1px solid #f1f5f9', fontSize: '14px' },
  badge: { background: '#e0e7ff', color: '#4338ca', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }
};

export default AuditLog;