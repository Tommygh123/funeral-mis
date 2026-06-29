import React from 'react';
import { useNavigate } from 'react-router-dom';

function Home() {
  const navigate = useNavigate();

  // Location-aware navigation to the subscription page
  const handlePricingClick = async () => {
    try {
      const response = await fetch('https://ipapi.co/json/');
      const data = await response.json();
      navigate('/subscription', { state: { country_code: data.country_code } });
    } catch (err) {
      // Fallback to Ghana if detection fails
      navigate('/subscription', { state: { country_code: 'GH' } });
    }
  };

  return (
    <div style={{ backgroundColor: '#050505', color: 'white', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>
      
      {/* NAVBAR */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 40px', borderBottom: '1px solid #1f1f1f', background: '#000' }}>
        <h2 style={{ color: '#d4af37', margin: 0 }}>LegacyCloud</h2>
        <div>
          <button onClick={handlePricingClick} style={{ padding: '10px 20px', marginRight: '12px', background: 'transparent', border: '1px solid #d4af37', color: '#d4af37', borderRadius: '6px', cursor: 'pointer' }}>
            Pricing
          </button>
          <button onClick={() => navigate('/login')} style={{ padding: '10px 20px', marginRight: '12px', background: 'transparent', border: '1px solid #444', color: 'white', borderRadius: '6px', cursor: 'pointer' }}>
            Login
          </button>
          <button onClick={() => navigate('/get-started')} style={{ padding: '10px 20px', background: '#d4af37', color: '#000', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
            Get Started
          </button>
        </div>
      </header>

      {/* HERO SECTION */}
      <section style={{ position: 'relative', minHeight: '80vh', display: 'flex', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '40px', backgroundColor: '#0a0a0a', backgroundImage: 'linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.6)), url("/IMG-20260616-WA0004.jpg")', backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div style={{ maxWidth: '900px' }}>
          <h1 style={{ fontSize: '48px', marginBottom: '20px', color: '#d4af37', lineHeight: '1.2' }}>Honoring Loved Ones Through Transparent Giving</h1>
          <p style={{ fontSize: '18px', color: '#ddd', lineHeight: '1.8', marginBottom: '35px' }}>
            A comprehensive digital ecosystem for funeral grounds, churches, and financial institutions to manage contributions, family records, and accountability with absolute transparency.
          </p>
          <div>
            <button onClick={() => navigate('/get-started')} style={{ padding: '16px 35px', background: '#d4af37', color: '#000', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px', marginRight: '15px' }}>
              Start Free Registration
            </button>
            <button onClick={handlePricingClick} style={{ padding: '16px 35px', background: 'transparent', color: '#d4af37', border: '1px solid #d4af37', borderRadius: '8px', cursor: 'pointer', fontSize: '16px' }}>
              View Subscription Plans
            </button>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section style={{ padding: '80px 40px' }}>
        <h2 style={{ textAlign: 'center', color: '#d4af37', marginBottom: '50px', fontSize: '38px' }}>Platform Capabilities</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '25px', maxWidth: '1200px', margin: '0 auto' }}>
          
          <div style={cardStyle}>
            <div style={badgeContainerStyle}><span style={iconSpanStyle}>📱</span></div>
            <div style={{ padding: '20px' }}>
              <h3 style={titleStyle}>Smart Collection</h3>
              <p style={textStyle}>Automated digital intake for funeral donations with real-time receipt generation and immutable audit logs.</p>
            </div>
          </div>

          <div style={cardStyle}>
            <div style={badgeContainerStyle}><span style={iconSpanStyle}>📋</span></div>
            <div style={{ padding: '20px' }}>
              <h3 style={titleStyle}>Family & Institutional Records</h3>
              <p style={textStyle}>Centralized management for family trees, funeral committees, and recurring memorial event scheduling.</p>
            </div>
          </div>

          <div style={cardStyle}>
            <div style={badgeContainerStyle}><span style={iconSpanStyle}>🏦</span></div>
            <div style={{ padding: '20px' }}>
              <h3 style={titleStyle}>Decentralized Cashiering</h3>
              <p style={textStyle}>Support for multiple concurrent cashiers operating across diverse funeral grounds or church branches.</p>
            </div>
          </div>

          <div style={cardStyle}>
            <div style={badgeContainerStyle}><span style={iconSpanStyle}>📊</span></div>
            <div style={{ padding: '20px' }}>
              <h3 style={titleStyle}>Transparent Financial Reporting</h3>
              <p style={textStyle}>Generate detailed, micro-targeted financial statements to ensure ecosystem-wide accountability and trust.</p>
            </div>
          </div>

        </div>
      </section>

      {/* CTA SECTION */}
      <section style={{ textAlign: 'center', padding: '90px 20px', background: '#0f0f0f' }}>
        <h2 style={{ fontSize: '36px', color: '#d4af37', marginBottom: '20px' }}>Ready to Digitize Your Institution?</h2>
        <button onClick={handlePricingClick} style={{ padding: '16px 40px', background: '#d4af37', color: '#000', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}>
          View Subscription Plans
        </button>
      </section>

      {/* FOOTER */}
      <footer style={{ padding: '30px', textAlign: 'center', borderTop: '1px solid #1f1f1f', color: '#888', background: '#000' }}>
        © 2026 LegacyCloud SaaS Platform. Powered by Arynat Solutions. +44 79 0921 1818 | +233 244 228 546
      </footer>
    </div>
  );
}

const cardStyle = { background: '#111', borderRadius: '12px', border: '1px solid #1f1f1f', display: 'flex', flexDirection: 'column' };
const badgeContainerStyle = { width: '100%', height: '120px', background: '#181818', display: 'flex', justifyContent: 'center', alignItems: 'center', borderBottom: '1px solid #1f1f1f' };
const iconSpanStyle = { fontSize: '40px' };
const titleStyle = { color: '#d4af37', margin: '0 0 10px 0', fontSize: '20px' };
const textStyle = { color: '#ccc', lineHeight: '1.6', margin: 0, fontSize: '14px' };

export default Home;