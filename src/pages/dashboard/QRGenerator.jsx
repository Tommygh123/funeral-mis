import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabase';
import { QRCodeCanvas } from 'qrcode.react';
import { useToast } from '../../components/ui/ToastProvider';

function QRGenerator() {
  const notifications = useToast();
  const [funerals, setFunerals] = useState([]);
  const [selectedFuneral, setSelectedFuneral] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFunerals();
  }, []);

  const fetchFunerals = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required.');

      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('institution_id')
        .eq('id', user.id)
        .single();
      if (profileError) throw profileError;
      if (!profile?.institution_id) throw new Error('Institution assignment was not found.');

      const { data, error } = await supabase
        .from('funerals')
        .select('id, full_name')
        .eq('institution_id', profile.institution_id)
        .eq('status', 'active')
        .order('full_name');
      if (error) throw error;

      const availableFunerals = data || [];
      setFunerals(availableFunerals);
      setSelectedFuneral((current) => (
        availableFunerals.find((funeral) => funeral.id === current?.id)
        || availableFunerals[0]
        || null
      ));
    } catch (error) {
      setFunerals([]);
      setSelectedFuneral(null);
      notifications.error(`Unable to load funerals: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Generates the public donation URL
  const getDonationLink = (id) => `${window.location.origin}/donate/${id}`;

  const handleSelection = (funeral) => {
    setSelectedFuneral(funeral);
    // Smooth scroll to preview area on mobile
    setTimeout(() => {
      const el = document.getElementById('qr-preview-section');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const downloadQR = () => {
    const canvas = document.getElementById("funeral-qr-code");
    if (!canvas) return;
    const pngUrl = canvas.toDataURL("image/png").replace("image/png", "image/octet-stream");
    let downloadLink = document.createElement("a");
    downloadLink.href = pngUrl;
    downloadLink.download = `${selectedFuneral.full_name.replace(/\s+/g, '_')}_QR.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      notifications.success('Donation link copied.');
    } catch {
      notifications.error('Unable to copy the link. Select and copy it manually.');
    }
  };

  if (loading) return <div style={styles.center}>Loading funerals...</div>;

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>QR Code & Link Generator</h2>
      
      <div style={styles.layout}>
        {/* Sidebar */}
        <div style={styles.sidebar}>
          <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '10px' }}>Select a funeral:</p>
          <div style={styles.list}>
            {funerals.map(f => (
              <button 
                key={f.id} 
                onClick={() => handleSelection(f)}
                style={{
                  ...styles.listItem, 
                  background: selectedFuneral?.id === f.id ? '#eff6ff' : '#fff',
                  borderColor: selectedFuneral?.id === f.id ? '#3b82f6' : '#e2e8f0'
                }}
              >
                {f.full_name}
              </button>
            ))}
          </div>
        </div>

        {/* Preview Area */}
        <div id="qr-preview-section" style={styles.previewArea}>
          {selectedFuneral ? (
            <div style={styles.qrCard}>
              <h3 style={styles.funeralName}>{selectedFuneral.full_name}</h3>
              
              <div style={styles.qrWrapper}>
                <QRCodeCanvas 
                  id="funeral-qr-code"
                  value={getDonationLink(selectedFuneral.id)} 
                  size={220} 
                  level="H" 
                  includeMargin={true}
                />
              </div>

              {/* Donation Link Section */}
              <div style={styles.linkContainer}>
                {/* Clickable link for mobile navigation */}
                <a 
                  href={getDonationLink(selectedFuneral.id)} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  style={styles.clickableLink}
                >
                  {getDonationLink(selectedFuneral.id)}
                </a>
                
                <div style={{ marginTop: '15px' }}>
                  <button 
                    onClick={() => copyToClipboard(getDonationLink(selectedFuneral.id))} 
                    style={styles.btnCopy}
                  >
                    Copy Link
                  </button>
                </div>
              </div>

              <div style={styles.actions}>
                <button onClick={() => window.print()} style={styles.btnPrimary}>Print</button>
                <button onClick={downloadQR} style={styles.btnSecondary}>Download PNG</button>
              </div>
            </div>
          ) : (
            <div style={styles.placeholder}>{funerals.length === 0 ? 'No active funerals are available for this institution.' : 'Select a funeral from the list to generate its QR code and link.'}</div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: { padding: '20px', maxWidth: '900px', margin: '0 auto' },
  title: { fontSize: '22px', color: '#1e293b', marginBottom: '20px', textAlign: 'center' },
  layout: { 
    display: 'grid', 
    gridTemplateColumns: window.innerWidth < 768 ? '1fr' : '300px 1fr', 
    gap: '20px' 
  },
  sidebar: { background: '#fff', padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0', height: 'fit-content' },
  list: { display: 'flex', flexDirection: 'column', gap: '10px' },
  listItem: { padding: '14px', textAlign: 'left', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '500', width: '100%' },
  previewArea: { background: '#fff', padding: '25px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' },
  qrCard: { textAlign: 'center', width: '100%' },
  funeralName: { fontSize: '18px', marginBottom: '15px', color: '#334155' },
  qrWrapper: { padding: '15px', background: '#f8fafc', borderRadius: '8px', display: 'inline-block', border: '1px solid #e2e8f0' },
  linkContainer: { marginTop: '20px', padding: '15px', background: '#f1f5f9', borderRadius: '8px', border: '1px solid #cbd5e1' },
  clickableLink: { 
    fontSize: '13px', 
    wordBreak: 'break-all', 
    color: '#2563eb', 
    textDecoration: 'underline', 
    display: 'block', 
    cursor: 'pointer' 
  },
  btnCopy: { padding: '8px 16px', background: '#059669', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' },
  actions: { display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'center' },
  btnPrimary: { padding: '10px 18px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' },
  btnSecondary: { padding: '10px 18px', background: '#64748b', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' },
  placeholder: { color: '#94a3b8', fontSize: '14px' },
  center: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }
};

export default QRGenerator;
