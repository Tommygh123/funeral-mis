import React from "react";
import { useNavigate } from "react-router-dom";

function AdminDashboard() {

  const navigate = useNavigate();

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "Arial" }}>

      {/* SIDEBAR */}
      <div style={{
        width: "250px",
        background: "#0b1f3a",
        color: "white",
        padding: "20px"
      }}>

        <h2>LegacyCloud</h2>
        <p>Admin Panel</p>

        <button onClick={() => navigate("/admin/create-user")}>
          ➕ Create User
        </button>

        <button>
          📊 Reports
        </button>

        <button>
          ⚙️ Settings
        </button>

      </div>

      {/* MAIN CONTENT */}
      <div style={{ flex: 1, padding: "30px" }}>

        <h1>Admin Dashboard</h1>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px" }}>

          <div style={card}>
            <h3>Total Donations</h3>
            <p>₵0.00</p>
          </div>

          <div style={card}>
            <h3>Active Users</h3>
            <p>0</p>
          </div>

          <div style={card}>
            <h3>Institutions</h3>
            <p>1</p>
          </div>

        </div>

      </div>

    </div>
  );
}

const card = {
  padding: "20px",
  background: "#f5f7fb",
  borderRadius: "10px"
};

export default AdminDashboard;