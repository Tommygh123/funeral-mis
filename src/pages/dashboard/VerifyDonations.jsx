import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabase';

function VerifyDonations() {
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPendingDonations();
  }, []);

  const fetchPendingDonations = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('donations')
      .select('*, funerals(full_name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    
    if (error) console.error("Error fetching donations:", error);
    else setDonations(data || []);
    setLoading(false);
  };

  const handleVerify = async (id) => {
    const { error } = await supabase
      .from('donations')
      .update({ status: 'completed' })
      .eq('id', id);

    if (error) {
      alert("Error verifying donation: " + error.message);
    } else {
      // Refresh list without reloading page
      fetchPendingDonations();
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Verify Donations</h2>
      {loading ? (
        <p>Loading pending donations...</p>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr style={styles.thead}>
              <th>Funeral</th>
              <th>Donor Name</th>
              <th>Amount</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {donations.map((d) => (
              <tr key={d.id} style={styles.row}>
                <td>{d.funerals?.full_name}</td>
                <td>{d.donor_name}</td>
                <td>{d.amount}</td>
                <td>
                  <button 
                    onClick={() => handleVerify(d.id)}
                    style={styles.verifyBtn}
                  >
                    Verify
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const styles = {
  table: { width: '100%', borderCollapse: 'collapse', marginTop: '20px' },
  thead: { background: '#f1f5f9', textAlign: 'left' },
  row: { borderBottom: '1px solid #e2e8f0' },
  verifyBtn: { 
    background: '#2563eb', 
    color: '#fff', 
    border: 'none', 
    padding: '6px 12px', 
    borderRadius: '4px', 
    cursor: 'pointer' 
  }
};

export default VerifyDonations;