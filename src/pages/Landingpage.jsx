import './App.css';

function App() {
  return (
    <div
      style={{
        fontFamily: 'Arial, sans-serif',
        backgroundColor: '#f5f7fb',
        minHeight: '100vh'
      }}
    >
      {/* TOP NAVBAR */}
      <header
        style={{
          backgroundColor: '#0b1f3a',
          color: 'white',
          padding: '15px 30px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <h2>LegacyCloud</h2>

        <div>
          <button
            style={{
              marginRight: '10px',
              padding: '10px 18px',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            Login
          </button>

          <button
            style={{
              padding: '10px 18px',
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            Request Demo
          </button>
        </div>
      </header>

      {/* HERO SECTION */}
      <section
        style={{
          textAlign: 'center',
          padding: '80px 20px'
        }}
      >
        <img
          src="https://images.unsplash.com/photo-1521737604893-d14cc237f11d"
          alt="LegacyCloud dashboard"
          style={{
            width: '100%',
            maxWidth: '700px',
            borderRadius: '12px',
            marginBottom: '30px'
          }}
        />

        <h1
          style={{
            fontSize: '48px',
            marginBottom: '20px',
            color: '#0b1f3a'
          }}
        >
          Funeral Donation Management System
        </h1>

        <p
          style={{
            fontSize: '20px',
            color: '#555',
            maxWidth: '700px',
            margin: '0 auto 30px'
          }}
        >
          LegacyCloud is a secure SaaS platform for banks, funeral committees,
          churches, and institutions to manage donations, receipts, SMS notifications,
          and real-time reporting.
        </p>

        <button
          style={{
            backgroundColor: '#2563eb',
            color: 'white',
            padding: '15px 30px',
            border: 'none',
            borderRadius: '6px',
            fontSize: '16px',
            cursor: 'pointer'
          }}
        >
          Get Started
        </button>
      </section>

      {/* FEATURES */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '20px',
          padding: '40px'
        }}
      >
        <div className="card">
          <img
            src="https://images.unsplash.com/photo-1554224155-6726b3ff858f"
            alt="Multi bank"
            style={{ width: '100%', borderRadius: '8px', marginBottom: '10px' }}
          />
          <h3>Multi-Bank SaaS</h3>
          <p>Secure isolated systems for each institution.</p>
        </div>

        <div className="card">
          <img
            src="https://images.unsplash.com/photo-1556741533-f6acd647d2fb"
            alt="Receipt printing"
            style={{ width: '100%', borderRadius: '8px', marginBottom: '10px' }}
          />
          <h3>Instant Receipts</h3>
          <p>Generate and print receipts immediately.</p>
        </div>

        <div className="card">
          <img
            src="https://images.unsplash.com/photo-1551434678-e076c223a692"
            alt="SMS notifications"
            style={{ width: '100%', borderRadius: '8px', marginBottom: '10px' }}
          />
          <h3>SMS Notifications</h3>
          <p>Automatic donor confirmation messages.</p>
        </div>

        <div className="card">
          <img
            src="https://images.unsplash.com/photo-1551288049-bebda4e38f71"
            alt="Reports"
            style={{ width: '100%', borderRadius: '8px', marginBottom: '10px' }}
          />
          <h3>Real-Time Reports</h3>
          <p>Track donations and funeral summaries live.</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer
        style={{
          backgroundColor: '#0b1f3a',
          color: 'white',
          textAlign: 'center',
          padding: '20px',
          marginTop: '50px'
        }}
      >
        © 2026 LegacyCloud — All Rights Reserved
      </footer>
    </div>
  );
}

export default App;
