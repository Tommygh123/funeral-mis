import React from 'react';
import { useNavigate } from 'react-router-dom';

function Home() {
  const navigate = useNavigate();

  return (
    <div
      style={{
        backgroundColor: '#050505',
        color: 'white',
        minHeight: '100vh',
        fontFamily: 'Arial, sans-serif'
      }}
    >
      {/* ========================= */}
      {/* NAVBAR */}
      {/* ========================= */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '18px 40px',
          borderBottom: '1px solid #1f1f1f',
          background: '#000'
        }}
      >
        <h2
          style={{
            color: '#d4af37',
            margin: 0
          }}
        >
          LegacyCloud
        </h2>

        <div>
          <button
            onClick={() => navigate('/subscription')}
            style={{
              padding: '10px 20px',
              marginRight: '12px',
              background: 'transparent',
              border: '1px solid #d4af37',
              color: '#d4af37',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Pricing
          </button>
          <button
            onClick={() => navigate('/login')}
            style={{
              padding: '10px 20px',
              marginRight: '12px',
              background: 'transparent',
              border: '1px solid #444',
              color: 'white',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Login
          </button>

          <button
            onClick={() => navigate('/get-started')}
            style={{
              padding: '10px 20px',
              background: '#d4af37',
              color: '#000',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Get Started
          </button>
        </div>
      </header>

      {/* ========================= */}
      {/* HERO SECTION */}
      {/* ========================= */}
      <section
        style={{
          position: 'relative',
          minHeight: '85vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center',
          padding: '40px',
          backgroundColor: '#0a0a0a',
          boxSizing: 'border-box',
          borderBottom: '1px solid #111'
        }}
      >
        <div style={{ maxWidth: '900px' }}>
          <h1
            style={{
              fontSize: '58px',
              marginBottom: '25px',
              color: '#d4af37',
              lineHeight: '1.2'
            }}
          >
            African Funeral Donation Management SaaS
          </h1>

          <p
            style={{
              fontSize: '20px',
              color: '#ddd',
              lineHeight: '1.8',
              marginBottom: '35px'
            }}
          >
            Digitize funeral donations, receipt printing, family records, memorial contributions, 
            SMS alerts, and financial reporting across funeral grounds, churches, rural banks, 
            and funeral committees.
          </p>

          <div>
            <button
              onClick={() => navigate('/get-started')}
              style={{
                padding: '16px 35px',
                background: '#d4af37',
                color: '#000',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '16px',
                marginRight: '15px'
              }}
            >
              Start Free Registration
            </button>

            <button
              onClick={() => navigate('/subscription')}
              style={{
                padding: '16px 35px',
                background: 'transparent',
                color: '#d4af37',
                border: '1px solid #d4af37',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              View Subscription Plans
            </button>
          </div>
        </div>
      </section>

      {/* ========================= */}
      {/* FEATURES */}
      {/* ========================= */}
      <section style={{ padding: '80px 40px' }}>
        <h2
          style={{
            textAlign: 'center',
            color: '#d4af37',
            marginBottom: '50px',
            fontSize: '38px'
          }}
        >
          Powerful SaaS Features
        </h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '25px'
          }}
        >
          {/* FEATURE 1 */}
          <div style={cardStyle}>
            <div style={badgeContainerStyle}>
              <span style={iconSpanStyle}>📊</span>
            </div>
            <div style={{ padding: '20px' }}>
              <h3 style={titleStyle}>Donation Collection</h3>
              <p style={textStyle}>
                Collect and track funeral donations digitally with real-time receipts and unalterable audit logs.
              </p>
            </div>
          </div>

          {/* FEATURE 2 */}
          <div style={cardStyle}>
            <div style={badgeContainerStyle}>
              <span style={iconSpanStyle}>🤝</span>
            </div>
            <div style={{ padding: '20px' }}>
              <h3 style={titleStyle}>Family Coordination</h3>
              <p style={textStyle}>
                Manage family records, institutional committees, custom announcements, and structural memorial schedules.
              </p>
            </div>
          </div>

          {/* FEATURE 3 */}
          <div style={cardStyle}>
            <div style={badgeContainerStyle}>
              <span style={iconSpanStyle}>💼</span>
            </div>
            <div style={{ padding: '20px' }}>
              <h3 style={titleStyle}>Cashier Operations</h3>
              <p style={textStyle}>
                Enable multiple cashiers to collect contributions simultaneously across decentralized scales at funeral grounds.
              </p>
            </div>
          </div>

          {/* FEATURE 4 */}
          <div style={cardStyle}>
            <div style={badgeContainerStyle}>
              <span style={iconSpanStyle}>📈</span>
            </div>
            <div style={{ padding: '20px' }}>
              <h3 style={titleStyle}>Financial Reports</h3>
              <p style={textStyle}>
                Generate micro-targeted accounting profiles for absolute institutional transparency and ecosystem accountability.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================= */}
      {/* CTA SECTION */}
      {/* ========================= */}
      <section
        style={{
          textAlign: 'center',
          padding: '90px 20px',
          background: '#0f0f0f'
        }}
      >
        <h2
          style={{
            fontSize: '42px',
            color: '#d4af37',
            marginBottom: '20px'
          }}
        >
          Start Managing Funeral Donations Professionally
        </h2>

        <p
          style={{
            color: '#bbb',
            maxWidth: '700px',
            margin: '0 auto 35px auto',
            lineHeight: '1.8'
          }}
        >
          Designed specifically for African funeral systems, churches, rural banks, and memorial organizations.
        </p>

        <button
          onClick={() => navigate('/subscription')}
          style={{
            padding: '16px 40px',
            background: '#d4af37',
            color: '#000',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '16px'
          }}
        >
          View Subscription Plans
        </button>
      </section>

      {/* ========================= */}
      {/* FOOTER */}
      {/* ========================= */}
      <footer
        style={{
          padding: '30px',
          textAlign: 'center',
          borderTop: '1px solid #1f1f1f',
          color: '#888',
          background: '#000'
        }}
      >
        © 2026 LegacyCloud SaaS Platform. Powered by Arynat Solutions. +44 79 0921 1818. +233 244 228 546
      </footer>
    </div>
  );
}

/* ========================= */
/* CENTRAL STYLING INTERFACES */
/* ========================= */

const cardStyle = {
  background: '#111',
  borderRadius: '12px',
  overflow: 'hidden',
  border: '1px solid #1f1f1f',
  display: 'flex',
  flexDirection: 'column'
};

const badgeContainerStyle = {
  width: '100%',
  height: '160px',
  background: 'linear-gradient(135deg, #141414 0%, #1a1a1a 100%)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  borderBottom: '1px solid #1f1f1f'
};

const iconSpanStyle = {
  fontSize: '48px',
  filter: 'drop-shadow(0px 4px 12px rgba(212, 175, 55, 0.15))'
};

const titleStyle = {
  color: '#d4af37',
  margin: '0 0 10px 0',
  fontSize: '20px'
};

const textStyle = {
  color: '#ccc',
  lineHeight: '1.7',
  margin: 0,
  fontSize: '14px'
};

export default Home;