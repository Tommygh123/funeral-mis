import React, { useEffect, useState } from 'react';
import { supabase } from '../../../supabase';

function DonationReports() {

  const [reports, setReports] = useState([]);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {

    const { data } = await supabase
      .from('donations')
      .select('*')
      .order('created_at', { ascending: false });

    setReports(data || []);
  };

  return (
    <div>
      <h2>Donation Reports</h2>

      {reports.map(r => (
        <div key={r.id}>
          <p>Amount: {r.amount}</p>
          <p>Donor: {r.donor_name}</p>
          <p>Date: {r.created_at}</p>
        </div>
      ))}

    </div>
  );
}

export default DonationReports;