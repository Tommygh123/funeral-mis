import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabase';

function SuperAdminSmsLogs() {
  const [groupedLogs, setGroupedLogs] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState(new Set());

  useEffect(() => {
    fetchGlobalSmsLogs();
  }, []);

  const fetchGlobalSmsLogs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('sms_logs')
        .select('id, message, phone, status, created_at, institutions (name)')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;

      const grouped = (data || []).reduce((acc, log) => {
        const instName = log.institutions?.name || 'Unknown Institution';
        if (!acc[instName]) acc[instName] = [];
        acc[instName].push(log);
        return acc;
      }, {});

      setGroupedLogs(grouped);
    } catch (err) {
      console.error("Error fetching logs:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedIds(newSelected);
  };

  const handleDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Delete ${selectedIds.size} selected logs?`)) return;

    const { error } = await supabase
      .from('sms_logs')
      .delete()
      .in('id', Array.from(selectedIds));

    if (error) alert("Error deleting logs: " + error.message);
    else {
      setSelectedIds(new Set());
      fetchGlobalSmsLogs(); 
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.headerRow}>
        <div>
          <h2 style={styles.title}>Global SMS Traffic Monitor</h2>
          <p style={styles.subtitle}>Traffic grouped by institutional tenants.</p>
        </div>
        {selectedIds.size > 0 && (
          <button onClick={handleDelete} style={styles.deleteBtn}>
            Delete Selected ({selectedIds.size})
          </button>
        )}
      </div>

      {loading ? (
        <div style={styles.loading}>Synchronizing global message registry...</div>
      ) : (
        Object.entries(groupedLogs).map(([instName, logs]) => (
          <div key={instName} style={styles.groupContainer}>
            <div style={styles.groupTitleRow}>
              <h3 style={styles.groupTitle}>{instName}</h3>
              <span style={styles.countBadge}>{logs.length} Total Logs</span>
            </div>
            <table style={styles.table}>
              <thead>
                <tr style={styles.thead}>
                  <th style={styles.th}><input type="checkbox" disabled /></th>
                  <th style={styles.th}>Timestamp</th>
                  <th style={styles.th}>Recipient</th>
                  <th style={styles.th}>Message Snippet</th>
                  <th style={styles.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id}>
                    <td style={styles.td}>
                      <input 
                        type="checkbox" 
                        checked={selectedIds.has(log.id)}
                        onChange={() => toggleSelect(log.id)}
                      />
                    </td>
                    <td style={styles.td}>{new Date(log.created_at).toLocaleString()}</td>
                    <td style={styles.td}>{log.phone}</td>
                    <td style={styles.td}>{log.message?.substring(0, 30)}...</td>
                    <td style={styles.td}>
                      <span style={{ ...styles.badge, background: log.status === 'sent' ? '#dcfce7' : '#fee2e2' }}>
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  );
}

const styles = {
  container: { padding: '24px', background: '#ffffff', borderRadius: '12px' },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
  title: { fontSize: '20px', color: '#0f172a', margin: 0 },
  subtitle: { color: '#64748b', margin: 0 },
  deleteBtn: { padding: '8px 16px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' },
  groupContainer: { marginBottom: '30px', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' },
  groupTitleRow: { background: '#f1f5f9', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  groupTitle: { margin: 0, fontSize: '16px', color: '#1e293b' },
  countBadge: { background: '#cbd5e1', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '600' },
  table: { width: '100%', borderCollapse: 'collapse' },
  thead: { background: '#f8fafc', textAlign: 'left' },
  th: { padding: '12px', borderBottom: '2px solid #e2e8f0', fontSize: '13px', color: '#475569' },
  td: { padding: '12px', borderBottom: '1px solid #f1f5f9', fontSize: '13px', color: '#334155' },
  badge: { padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase' },
  loading: { padding: '40px', textAlign: 'center', color: '#94a3b8' }
};

export default SuperAdminSmsLogs;