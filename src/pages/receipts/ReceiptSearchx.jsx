import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabase';

function ReceiptSearch() {
  // Input tracking states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  // Tenant-bound active scope variables
  const [institution, setInstitution] = useState(null);
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  /**
   * Resolves the active session credentials to lock transaction 
   * queries down specifically to the logged-in user's institution.
   */
  const resolveTenantContext = useCallback(async () => {
    try {
      setPageLoading(true);
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("No authenticated session context found.");

      // Fetch user profile linkage row
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('institution_id')
        .eq('id', user.id)
        .single();

      if (profileError || !profile?.institution_id) {
        throw new Error("User account is not assigned to an active institution.");
      }

      // Fetch the actual institution record parameters
      const { data: inst, error: instError } = await supabase
        .from('institutions')
        .select('*')
        .eq('id', profile.institution_id)
        .single();

      if (instError || !inst) throw instError;

      // Parse absolute public bucket route for institution logo if it is stored as a path reference
      if (inst.logo_url && !inst.logo_url.startsWith('http')) {
        const { data: logoStorage } = supabase.storage
          .from('institution-logos')
          .getPublicUrl(inst.logo_url);
        inst.logo_url = logoStorage.publicUrl;
      }
      
      setInstitution(inst);
    } catch (err) {
      console.error('Context initialization failure:', err);
    } finally {
      setPageLoading(false);
    }
  }, []);

  useEffect(() => {
    resolveTenantContext();
  }, [resolveTenantContext]);

  /**
   * Fires a wildcard search query parsing donor names, phone logs, or explicit system references.
   */
  const handleDatabaseLookup = async (e) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim() || !institution) return;

    setSearchLoading(true);
    try {
      const sanitizedQuery = `%${searchQuery.trim()}%`;

      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          funerals (
            full_name,
            photo_url
          )
        `)
        .eq('institution_id', institution.id)
        .or(`donor_name.ilike.${sanitizedQuery},donor_phone.ilike.${sanitizedQuery},reference.ilike.${sanitizedQuery}`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSearchResults(data || []);
    } catch (err) {
      console.error('Search query execution fault:', err);
      alert('Failed to extract matching audit logs from database index: ' + err.message);
    } finally {
      setSearchLoading(false);
    }
  };

  /**
   * Hydrates the thermal viewer workspace block with selected transaction rows
   * and builds clean cloud asset links for storage bucket media targets.
   */
  const mountSelectedReceipt = (transaction) => {
    let rawDeceasedPhoto = transaction.funerals?.photo_url;
    let computedPhotoUrl = null;

    if (rawDeceasedPhoto) {
      if (rawDeceasedPhoto.startsWith('http')) {
        computedPhotoUrl = rawDeceasedPhoto;
      } else {
        const { data: storageResult } = supabase.storage
          .from('deceased-logos')
          .getPublicUrl(rawDeceasedPhoto);
        computedPhotoUrl = storageResult.publicUrl;
      }
    }

    setSelectedReceipt({
      ...transaction,
      resolvedDeceasedPhoto: computedPhotoUrl,
      formattedPhone: `${transaction.donor_country_code || ''} ${transaction.donor_phone_national || transaction.donor_phone || ''}`.trim()
    });
  };

  const executeSystemPrintRoute = () => {
    window.print();
  };

  if (pageLoading) {
    return (
      <div style={centeredStatusBox}>
        <div style={spinnerStyle}></div>
        <p style={{ marginTop: 12, fontWeight: '500', color: '#64748b' }}>Initializing Receipt Lookup Registry...</p>
      </div>
    );
  }

  if (!institution) {
    return (
      <div style={errorContainerStyle}>
        <h3>Scope Context Warning</h3>
        <p>Could not safely establish tenant ownership profile metadata for this account session. Please verify connection credentials.</p>
      </div>
    );
  }

  return (
    <div style={workspaceGridContainer}>
      <style>{printCssInjectionRules}</style>

      {/* LEFT MODULE ACTION COLUMN - EXCLUDED FROM PRINT MATRIX */}
      <div className="no-print" style={searchWorkspaceCard}>
        <div style={moduleHeaderStyle}>
          <h2 style={moduleTitle}>Receipt Audit Lookup</h2>
          <p style={moduleSubtitle}>Query and extract archival financial transactions to issue verified duplicate thermal invoices.</p>
        </div>

        <form onSubmit={handleDatabaseLookup} style={searchFormRow}>
          <div style={inputWrapper}>
            <input 
              type="text" 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              placeholder="Filter by Name, Phone, or Reference Code..." 
              style={textInputStyle}
            />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery('')} style={clearInputButton}>✕</button>
            )}
          </div>
          <button type="submit" disabled={searchLoading || !searchQuery.trim()} style={searchSubmitBtn}>
            {searchLoading ? 'Processing...' : 'Find Record'}
          </button>
        </form>

        {/* LOOKUP RESULTS INDEX DATA VIEWER */}
        <div style={resultsScrollerContainer}>
          {searchResults.length === 0 ? (
            <div style={emptyStateBlock}>
              <span style={{ fontSize: '24px', display: 'block', marginBottom: '8px' }}>📂</span>
              {searchQuery.trim() ? 'No database records match current query fields.' : 'Enter a search key parameters to extract system audits.'}
            </div>
          ) : (
            searchResults.map((tx) => {
              const isSelected = selectedReceipt?.id === tx.id;
              return (
                <div 
                  key={tx.id} 
                  style={{
                    ...resultItemRowFrame,
                    border: isSelected ? '1px solid #2563eb' : '1px solid #e2e8f0',
                    background: isSelected ? '#f0f6ff' : '#f8fafc'
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={resultDonorNameText}>{tx.donor_name}</div>
                    <div style={resultMetaLine}>
                      <span style={amountLabelTag}>{tx.amount} {tx.currency}</span>
                      <span style={dividerDot}>•</span>
                      <span style={{ textTransform: 'capitalize' }}>{tx.payment_method}</span>
                    </div>
                    <div style={resultReferenceHash}>REF: {tx.reference}</div>
                  </div>
                  <button onClick={() => mountSelectedReceipt(tx)} style={loadReceiptDockBtn}>
                    {isSelected ? 'Viewing 🖨️' : 'Load Copy'}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT MODULE VIEWPORT COLUMN - CONDITIONAL VISIBILITY */}
      <div style={receiptDockViewport}>
        {selectedReceipt ? (
          <div style={dockWrapper}>
            {/* THERMAL SIMULATION MATRIX CORE */}
            <div id="thermal-receipt" style={thermalPaperCoreFrame}>
              
              {/* BRANDING LOGO COMPONENT LAYOUT */}
              <div style={receiptHeaderLayoutBlock}>
                <div style={{ flex: 1 }}>
                  <h2 style={receiptTitleText}>FUNERAL RECEIPT</h2>
                  <p style={receiptTenantCorporateName}>{institution.name}</p>
                  <p style={receiptTenantMetaContact}>{institution.phone || 'N/A'}</p>
                  {institution.email && <p style={receiptTenantMetaContact}>{institution.email}</p>}
                </div>
                {institution.logo_url && (
                  <img src={institution.logo_url} alt="Corporate Logo" style={receiptHeaderLogoImage} crossOrigin="anonymous" />
                )}
              </div>

              <hr style={thermalLineBreakStyle} />

              {/* RELATIONAL SYSTEM LINKAGE ROW (DECEASED DECORATOR PROFILE) */}
              {selectedReceipt.funerals ? (
                <div style={deceasedProfileRowBlock}>
                  {selectedReceipt.resolvedDeceasedPhoto && (
                    <img src={selectedReceipt.resolvedDeceasedPhoto} alt="Deceased Profile" style={deceasedThumbnailPhoto} crossOrigin="anonymous" />
                  )}
                  <div style={{ flex: 1 }}>
                    <p style={deceasedLabelPrompt}>In Honored Memory of:</p>
                    <p style={deceasedTargetFullName}>{selectedReceipt.funerals.full_name}</p>
                  </div>
                </div>
              ) : (
                <div style={deceasedProfileRowBlock}>
                  <p style={deceasedLabelPrompt}>General Institutional Contribution</p>
                </div>
              )}

              <hr style={thermalLineBreakStyle} />

              {/* METRIC AUDIT DETAIL MATRIX */}
              <div style={invoiceDetailsDataListGrid}>
                <div style={invoiceRowItemDataField}>
                  <span style={invoiceFieldLabel}>Donor Account:</span>
                  <span style={invoiceFieldValueText}>{selectedReceipt.donor_name}</span>
                </div>
                
                {(selectedReceipt.donor_phone || selectedReceipt.donor_phone_national) && (
                  <div style={invoiceRowItemDataField}>
                    <span style={invoiceFieldLabel}>Phone Log:</span>
                    <span style={invoiceFieldValueText}>{selectedReceipt.formattedPhone}</span>
                  </div>
                )}

                {selectedReceipt.recipient_name && (
                  <div style={invoiceRowItemDataField}>
                    <span style={invoiceFieldLabel}>Cashier Agent:</span>
                    <span style={invoiceFieldValueText}>{selectedReceipt.recipient_name}</span>
                  </div>
                )}

                <div style={invoiceRowItemDataField}>
                  <span style={invoiceFieldLabel}>Method Flag:</span>
                  <span style={{ ...invoiceFieldValueText, textTransform: 'uppercase' }}>{selectedReceipt.payment_method}</span>
                </div>

                <div style={{ ...invoiceRowItemDataField, margin: '6px 0' }}>
                  <span style={invoiceFieldLabel}>Gross Amount:</span>
                  <span style={invoiceFieldValueFinancialHighlight}>{selectedReceipt.amount} {selectedReceipt.currency}</span>
                </div>

                <div style={{ ...invoiceRowItemDataField, display: 'block', paddingTop: '4px' }}>
                  <span style={invoiceFieldLabel}>Transaction Audit Index Token:</span>
                  <span style={invoiceFieldBarcodeFallback}>{selectedReceipt.reference}</span>
                </div>
                
                <div style={invoiceRowItemDataField}>
                  <span style={invoiceFieldLabel}>Timestamp:</span>
                  <span style={invoiceFieldValueText}>{new Date(selectedReceipt.created_at).toLocaleString()}</span>
                </div>
              </div>

              <hr style={thermalLineBreakStyle} />

              {/* AUDIT COPY WATERMARK DISCLAIMER FOOTER */}
              <div style={receiptSystemFooterWrapper}>
                <p style={footerStandardLegalDisclaimer}>Thank you for your generous financial support.</p>
                <div style={watermarkReprintBadgeContainer}>* DUPLICATE SYSTEM REPRINT COPY *</div>
                <p style={{ margin: '4px 0 0 0', fontSize: '8px', color: '#666' }}>System Tracking ID: {selectedReceipt.id}</p>
              </div>

            </div>

            {/* CONTROL DISPATCH TRIPPERS */}
            <button className="no-print" onClick={executeSystemPrintRoute} style={triggerPrintSystemActionBtn}>
              🖨️ Dispatch Print Event
            </button>
          </div>
        ) : (
          <div className="no-print" style={emptyViewportWrapperPrompt}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>🖨️</div>
            <p style={{ margin: 0, fontWeight: '500' }}>No Active Receipt Loaded</p>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#94a3b8' }}>Select a resolved row from the index log to review printable layouts.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ==========================================================================
   CSS OVERRIDE DESCRIPTOR CONTEXTS FOR PRINT ARCHITECTURES
   ========================================================================== */
const printCssInjectionRules = `
  @media print {
    body, html { 
      background: #ffffff !important; 
      margin: 0 !important; 
      padding: 0 !important; 
    }
    #root, .dashboard-layout-wrapper {
      padding: 0 !important;
      margin: 0 !important;
      background: transparent !important;
    }
    .no-print { 
      display: none !important; 
    }
    #thermal-receipt { 
      border: none !important; 
      box-shadow: none !important; 
      margin: 0 !important; 
      padding: 0 !important; 
      width: 100% !important; 
      max-width: 280px !important; 
      background: #fff !important;
    }
    body * {
      visibility: hidden;
    }
    #thermal-receipt, #thermal-receipt * {
      visibility: visible;
    }
    #thermal-receipt {
      position: absolute;
      left: 0;
      top: 0;
    }
  }
`;

/* ==========================================================================
   FLEXIBLE COMPONENT INLINE STYLES SHEET
   ========================================================================== */
const workspaceGridContainer = { display: 'flex', gap: '32px', background: 'transparent', alignItems: 'flex-start', width: '100%', boxSizing: 'border-box' };
const searchWorkspaceCard = { flex: '1', minWidth: '320px', maxWidth: '520px', background: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', boxSizing: 'border-box' };
const receiptDockViewport = { flex: '12', minWidth: '300px', display: 'flex', justifyContent: 'center' };
const dockWrapper = { display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', position: 'sticky', top: '24px' };

const moduleHeaderStyle = { marginBottom: '20px' };
const moduleTitle = { margin: 0, color: '#0f172a', fontSize: '20px', fontWeight: '700', letterSpacing: '-0.025em' };
const moduleSubtitle = { color: '#64748b', marginTop: '6px', fontSize: '13px', lineHeight: '1.5' };

const searchFormRow = { display: 'flex', gap: '10px', marginBottom: '20px' };
const inputWrapper = { position: 'relative', flex: 1 };
const textInputStyle = { width: '100%', padding: '10px 36px 10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', boxSizing: 'border-box', background: '#ffffff', transition: 'border-color 0.15s ease' };
const clearInputButton = { position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '12px', padding: '4px' };
const searchSubmitBtn = { padding: '0 18px', background: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'background-color 0.1s ease' };

const resultsScrollerContainer = { display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: 'calc(100vh - 250px)', overflowY: 'auto', paddingRight: '4px' };
const emptyStateBlock = { padding: '40px 20px', textAlign: 'center', color: '#94a3b8', fontSize: '13px', border: '1px dashed #e2e8f0', borderRadius: '8px', background: '#f8fafc' };

const resultItemRowFrame = { display: 'flex', alignItems: 'center', padding: '14px', borderRadius: '10px', gap: '14px', boxSizing: 'border-box', transition: 'all 0.15s ease' };
const resultDonorNameText = { fontSize: '14px', fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
const resultMetaLine = { fontSize: '13px', color: '#475569', marginTop: '4px', display: 'flex', alignItems: 'center' };
const amountLabelTag = { fontWeight: '600', color: '#0f172a' };
const dividerDot = { margin: '0 6px', color: '#cbd5e1' };
const resultReferenceHash = { fontSize: '11px', fontFamily: 'monospace', color: '#64748b', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
const loadReceiptDockBtn = { padding: '8px 12px', background: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' };

const emptyViewportWrapperPrompt = { width: '280px', padding: '60px 20px', textAlign: 'center', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '12px', color: '#64748b' };
const triggerPrintSystemActionBtn = { width: '100%', padding: '12px', background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)' };

/* ==========================================================================
   STRICT THERMAL 58MM EMULATION CSS SCHEMA PROPERTIES
   ========================================================================== */
const thermalPaperCoreFrame = { width: '280px', background: '#ffffff', padding: '16px', border: '1px dashed #94a3b8', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', color: '#000000', fontFamily: '"Courier New", Courier, monospace', fontSize: '12px', boxSizing: 'border-box', lineHeight: '1.4' };
const receiptHeaderLayoutBlock = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' };
const receiptTitleText = { margin: 0, fontSize: '14px', fontWeight: 'bold', letterSpacing: '0.05em' };
const receiptTenantCorporateName = { margin: '4px 0 0 0', fontSize: '12px', fontWeight: 'bold' };
const receiptTenantMetaContact = { margin: '1px 0 0 0', fontSize: '11px', color: '#333333' };
const receiptHeaderLogoImage = { width: '44px', height: '44px', objectFit: 'contain', borderRadius: '4px' };
const thermalLineBreakStyle = { border: 'none', borderTop: '1px dashed #000000', margin: '10px 0' };

const deceasedProfileRowBlock = { display: 'flex', alignItems: 'center', gap: '10px', background: '#f9f9f9', padding: '6px', borderRadius: '4px' };
const deceasedThumbnailPhoto = { width: '38px', height: '38px', borderRadius: '4px', objectFit: 'cover', background: '#eaeaea', border: '1px solid #ddd' };
const deceasedLabelPrompt = { margin: 0, fontSize: '10px', textTransform: 'uppercase', color: '#444' };
const deceasedTargetFullName = { margin: '2px 0 0 0', fontSize: '12px', fontWeight: 'bold' };

const invoiceDetailsDataListGrid = { display: 'flex', flexDirection: 'column', gap: '4px' };
const invoiceRowItemDataField = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' };
const invoiceFieldLabel = { color: '#333333' };
const invoiceFieldValueText = { textAlign: 'right', fontWeight: 'bold' };
const invoiceFieldValueFinancialHighlight = { textAlign: 'right', fontSize: '14px', fontWeight: 'bold' };
const invoiceFieldBarcodeFallback = { display: 'block', fontFamily: 'monospace', fontSize: '11px', fontWeight: 'bold', background: '#f0f0f0', padding: '2px 4px', borderRadius: '2px', marginTop: '2px', wordBreak: 'break-all' };

const receiptSystemFooterWrapper = { textAlign: 'center', marginTop: '14px' };
const footerStandardLegalDisclaimer = { margin: 0, fontSize: '10px', fontStyle: 'italic' };
const watermarkReprintBadgeContainer = { display: 'inline-block', margin: '6px auto 0 auto', padding: '2px 6px', border: '1px solid #000000', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' };

const centeredStatusBox = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', width: '100%' };
const errorContainerStyle = { padding: '20px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b', maxWidth: '400px', margin: '40px auto', textAlign: 'center' };
const spinnerStyle = { width: '28px', height: '28px', border: '3px solid #e2e8f0', borderTop: '3px solid #2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite' };

export default ReceiptSearch;