import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabase';
import { QRCodeCanvas } from 'qrcode.react';

function QRGenerator() {
  const [funerals, setFunerals] = useState([]);
  const [selectedFuneral, setSelectedFuneral] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFunerals();
  }, []);

  const fetchFunerals = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('funerals')
      .select('id, full_name')
      .eq('status', 'active');
    setFunerals(data || []);
    setLoading(false);
  };

  const downloadQR = () => {
    const canvas = document.getElementById("funeral-qr-code");
    const pngUrl = canvas.toDataURL("image/png").replace("image/png", "image/octet-stream");
    let downloadLink = document.createElement("a");
    downloadLink.href = pngUrl;
    downloadLink.download = `${selectedFuneral.full_name.replace(/\s+/g, '_')}_QR.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>QR Code Generator</h2>
      
      <div style={styles.layout}>
        <div style={styles.sidebar}>
          <div style={styles.list}>
            {funerals.map(f => (
              <button 
                key={f.id} 
                onClick={() => setSelectedFuneral(f)}
                style={{...styles.listItem, background: selectedFuneral?.id === f.id ? '#eff6ff' : '#fff'}}
              >
                {f.full_name}
              </button>
            ))}
          </div>
        </div>

        <div style={styles.previewArea}>
          {selectedFuneral ? (
            <div style={styles.qrCard}>
              <h3 style={styles.funeralName}>{selectedFuneral.full_name}</h3>
              <div style={styles.qrWrapper}>
                <QRCodeCanvas 
                  id="funeral-qr-code"
                  value={`${window.location.origin}/donate/${selectedFuneral.id}`} 
                  size={300} 
                  level="H" 
                  includeMargin={true}
                />
              </div>
              <div style={styles.actions}>
                <button onClick={() => window.print()} style={styles.btnPrimary}>Print</button>
                <button onClick={downloadQR} style={styles.btnSecondary}>Download PNG</button>
              </div>
            </div>
          ) : (
            <div style={styles.placeholder}>Select a funeral from the left to generate its QR code.</div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: { padding: '24px', maxWidth: '1000px', margin: '0 auto' },
  title: { fontSize: '24px', color: '#1e293b', marginBottom: '24px' },
  layout: { display: 'grid', gridTemplateColumns: '300px 1fr', gap: '24px' },
  sidebar: { background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' },
  list: { display: 'flex', flexDirection: 'column', gap: '8px' },
  listItem: { padding: '12px', textAlign: 'left', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer' },
  previewArea: { background: '#fff', padding: '40px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'center' },
  qrCard: { textAlign: 'center' },
  funeralName: { fontSize: '20px', marginBottom: '20px' },
  qrWrapper: { padding: '20px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' },
  actions: { display: 'flex', gap: '10px', marginTop: '24px', justifyContent: 'center' },
  btnPrimary: { padding: '10px 20px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' },
  btnSecondary: { padding: '10px 20px', background: '#64748b', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' },
  placeholder: { color: '#94a3b8' }
};

export default QRGenerator;