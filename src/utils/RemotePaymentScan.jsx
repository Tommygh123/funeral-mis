import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../supabase';

function RemotePaymentScan() {
  const [searchParams] = useSearchParams();
  const [funeralData, setFuneralData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Example QR scan deep-link URL configuration format:
  // https://yourplatform.com/pay?funeral_id=UUID_HERE&inst_id=UUID_HERE
  const funeralId = searchParams.get('funeral_id');
  const institutionId = searchParams.get('inst_id');

  useEffect(() => {
    async function loadScannedContext() {
      if (!funeralId) return;
      try {
        const { data, error } = await supabase
          .from('funerals')
          .select('*, institutions(name, phone)')
          .eq('id', funeralId)
          .single();

        if (error) throw error;
        setFuneralData(data);
      } catch (err) {
        console.error('Error parsing context metadata:', err);
      } finally {
        setLoading(false);
      }
    }
    loadScannedContext();
  }, [funeralId]);

  if (loading) return <div>Initializing secure checkout portal...</div>;
  if (!funeralData) return <div>Invalid or expired transaction QR configuration token.</div>;

  return (
    <div style={{ maxWidth: '400px', margin: '20px auto', padding: '20px', fontFamily: 'sans-serif' }}>
      {/* 1. Header showing custom tenant branding */}
      <h2>Secure Portal: {funeralData.institutions?.name}</h2>
      
      {/* 2. Interactive reminder card showing who they are giving towards */}
      <div style={{ background: '#f3f4f6', padding: '15px', borderRadius: '8px' }}>
        <p>Donation Contribution Target:</p>
        <h3>In Loving Memory of {funeralData.full_name}</h3>
      </div>

      {/* 3. The Future Payment Form: Integrates with mobile money gateways (Hubtel, Paystack, or Arkesel) */}
      <form style={{ marginTop: '20px' }}>
        {/* Donor inputs their name, amount, select wallet networks, and taps 'Pay Now' */}
        {/* Once payment finishes, you hit 'sendDonationWhatsAppNotification' on the backend to trigger the auto-receipt! */}
      </form>
    </div>
  );
}

export default RemotePaymentScan;