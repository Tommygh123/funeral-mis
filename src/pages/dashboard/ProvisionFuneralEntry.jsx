import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabase';

function ProvisionFuneralEntry({ institutionId, onSaveSuccess }) {
  const [loading, setLoading] = useState(false);
  const [globalLoading, setGlobalLoading] = useState(true);
  const [institutionalFunerals, setInstitutionalFunerals] = useState([]);
  
  // Operational Form State
  const [selectedName, setSelectedName] = useState('');
  const [deceasedFile, setDeceasedFile] = useState(null);

  // ==========================================
  // FETCH FUNERALS FOR THE SELECTED INSTITUTION
  // ==========================================
  const fetchInstitutionFunerals = useCallback(async () => {
    // DIAGNOSTIC CHECK: Is the app passing a valid ID?
    if (!institutionId) {
      console.warn("ProvisionFuneralEntry: Waiting for a valid institutionId registration...");
      // If no valid ID is passed yet, don't freeze the screen forever:
      setGlobalLoading(false);
      return;
    }
    
    try {
      setGlobalLoading(true);
      
      const { data, error } = await supabase
        .from('funerals') 
        .select('id, full_name, photo_url, status, created_at')
        .eq('institution_id', institutionId)
        .order('full_name', { ascending: true });

      if (error) throw error;
      
      console.log("Successfully fetched institutional funerals:", data);
      setInstitutionalFunerals(data || []);
    } catch (err) {
      console.error("CRITICAL: Error loading institutional funerals list:", err.message);
      alert(`System Data Load Error: ${err.message}`);
    } finally {
      // Enforce clearing the loader mask no matter what happens
      setGlobalLoading(false);
    }
  }, [institutionId]);

  useEffect(() => {
    fetchInstitutionFunerals();
  }, [fetchInstitutionFunerals]);

  // ==========================================
  // EVENT HANDLERS
  // ==========================================
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setDeceasedFile(e.target.files[0]);
    }
  };

  const handleFormSubmission = async (e) => {
    e.preventDefault();
    if (!selectedName) return alert("Please select a valid Deceased Member Profile Name.");
    if (!institutionId) return alert("Session expired: Multi-tenant reference validation frame missing.");

    try {
      setLoading(true);
      let publicPhotoUrl = '';

      if (deceasedFile) {
        const fileExtension = deceasedFile.name.split('.').pop();
        const pathName = `${institutionId}/deceased-${Date.now()}.${fileExtension}`;

        const { error: uploadError } = await supabase.storage
          .from('deceased-logos')
          .upload(pathName, deceasedFile, { cacheControl: '3600', upsert: true });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from('deceased-logos')
          .getPublicUrl(pathName);
        publicPhotoUrl = data.publicUrl;
      }

      const { error: insertError } = await supabase
        .from('funerals')
        .insert([{
          institution_id: institutionId,
          full_name: selectedName,
          photo_url: publicPhotoUrl,
          status: 'active'
        }]);

      if (insertError) throw insertError;

      alert("New operational funeral registry node appended successfully.");
      setSelectedName('');
      setDeceasedFile(null);
      
      await fetchInstitutionFunerals();
      if (onSaveSuccess) onSaveSuccess();

    } catch (err) {
      console.error("Write execution error:", err.message);
      alert(`Database write failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Safe fallback UI display if the context initialization parameters are missing
  if (!institutionId) {
    return (
      <div style={{ padding: '24px', background: '#f8fafc', color: '#64748b', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        ⚠️ <strong>System Status Matrix Delayed:</strong> Please select or log into an active institution workspace profile above to initialize database views.
      </div>
    );
  }

  if (globalLoading) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: '#475569', fontWeight: '500' }}>
        🔄 Synchronizing local institutional profiles from secure database partition...
      </div>
    );
  }

  return (
    <div style={splitDashboardContainer}>
      
      {/* LEFT PANEL: PROVISION FORM */}
      <div style={formLeftDockColumn}>
        <h3 style={sectionGroupHeading}>Provision New Funeral Entry</h3>
        <p style={sectionGroupSubtitle}>Initialize an active ledger tracking point for incoming digital or physical donations.</p>
        
        <form onSubmit={handleFormSubmission}>
          <div style={{ marginBottom: '16px' }}>
            <label style={inputLabelHeader}>Deceased Member Legal Profile Name</label>
            <select 
              value={selectedName} 
              onChange={(e) => setSelectedName(e.target.value)} 
              style={formDropdownField}
            >
              <option value="">-- Choose Profile Identity (Current Institution) --</option>
              {institutionalFunerals.map((funeral) => (
                <option key={funeral.id} value={funeral.full_name}>
                  {funeral.full_name}
                </option>
              ))}
              
              {/* Intelligent Fallbacks if the custom filtered parameter yields zero rows */}
              {institutionalFunerals.length === 0 && (
                <>
                  <option value="Late Madam Charlotte Osei">Late Madam Charlotte Osei (Demo Option)</option>
                  <option value="Late Emmanuel Kofi Mensah">Late Emmanuel Kofi Mensah (Demo Option)</option>
                </>
              )}
            </select>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={inputLabelHeader}>Obituary / Memorial Service Photo Display Asset</label>
            <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#64748b' }}>
              Appears globally across generated PDF receipts, thermal outputs, and ledger headers.
            </p>
            
            <label style={fileInputButtonTrigger}>
              Select Photo File
              <input type="file" accept="image/*" onChange={handleFileChange} hidden />
            </label>
            
            {deceasedFile ? (
              <div style={fileSelectedIndicatorText}>
                <span>📎 Ready: <strong>{deceasedFile.name}</strong></span>
              </div>
            ) : (
              <div style={{ marginTop: '6px', fontSize: '12px', color: '#94a3b8' }}>No graphic image currently attached.</div>
            )}
          </div>

          <button 
            type="submit" 
            disabled={loading} 
            style={{ ...primaryActionExecutionButton, background: '#10b981', width: '100%' }}
          >
            {loading ? 'Processing System Registries...' : 'Create Funeral Registry Entry'}
          </button>
        </form>
      </div>

      {/* RIGHT PANEL: LIVE ISOLATED LIST VIEW */}
      <div style={listRightDockColumn}>
        <div style={listHeaderWrapper}>
          <h3 style={sectionGroupHeading}>Active Local Registries</h3>
          <span style={countBadgeStyle}>{institutionalFunerals.length} Profiles</span>
        </div>
        <p style={{ ...sectionGroupSubtitle, marginBottom: '16px' }}>Verified active tracking frameworks linked to this identity scope.</p>

        <div style={listWrapperBox}>
          {institutionalFunerals.map((funeral) => (
            <div key={funeral.id} style={listItemRow}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {funeral.photo_url ? (
                  <img src={funeral.photo_url} alt="" style={avatarThumbnailStyle} />
                ) : (
                  <div style={avatarPlaceholderStyle}>🕊️</div>
                )}
                <div>
                  <div style={profileNameText}>{funeral.full_name}</div>
                  <div style={profileMetaText}>Added: {new Date(funeral.created_at).toLocaleDateString()}</div>
                </div>
              </div>
              <span style={{
                ...statusBadgeStyle,
                background: funeral.status === 'active' ? '#e2fbe8' : '#f1f5f9',
                color: funeral.status === 'active' ? '#15803d' : '#475569'
              }}>
                {funeral.status}
              </span>
            </div>
          ))}

          {institutionalFunerals.length === 0 && (
            <div style={emptyStatePlaceholder}>
              No database profiles detected under this unique corporate scope. You can provision a demo record using the form options.
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

// ==========================================
// STYLING ARCHITECTURE
// ==========================================
const splitDashboardContainer = { display: 'flex', gap: '32px', flexWrap: 'wrap', width: '100%', alignItems: 'flex-start', boxSizing: 'border-box' };
const formLeftDockColumn = { flex: '1', minWidth: '340px', background: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', boxSizing: 'border-box' };
const listRightDockColumn = { flex: '1.4', minWidth: '380px', background: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', boxSizing: 'border-box' };
const sectionGroupHeading = { margin: '0 0 4px 0', fontSize: '18px', fontWeight: '700', color: '#1e293b' };
const sectionGroupSubtitle = { margin: '0', fontSize: '13px', color: '#64748b', lineHeight: '1.4' };
const listHeaderWrapper = { display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const countBadgeStyle = { background: '#f1f5f9', color: '#475569', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '700' };
const inputLabelHeader = { display: 'block', marginBottom: '6px', fontWeight: '600', color: '#344054', fontSize: '14px' };
const formDropdownField = { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #d0d5dd', fontSize: '14px', color: '#101828', background: '#ffffff', cursor: 'pointer', outline: 'none', boxSizing: 'border-box' };
const fileInputButtonTrigger = { display: 'inline-block', padding: '10px 16px', background: '#f8fafc', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', textAlign: 'center' };
const fileSelectedIndicatorText = { marginTop: '10px', fontSize: '13px', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '4px' };
const primaryActionExecutionButton = { padding: '14px 20px', border: 'none', borderRadius: '10px', color: '#ffffff', fontSize: '15px', fontWeight: '600', cursor: 'pointer', transition: 'background 0.2s' };
const listWrapperBox = { display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' };
const listItemRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', border: '1px solid #f1f5f9', borderRadius: '10px', background: '#f8fafc' };
const avatarThumbnailStyle = { width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #e2e8f0' };
const avatarPlaceholderStyle = { width: '40px', height: '40px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' };
const profileNameText = { fontSize: '14px', fontWeight: '600', color: '#0f172a' };
const profileMetaText = { fontSize: '11px', color: '#94a3b8', marginTop: '2px' };
const statusBadgeStyle = { padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase' };
const emptyStatePlaceholder = { padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '13px', border: '1px dashed #e2e8f0', borderRadius: '8px' };

export default ProvisionFuneralEntry;