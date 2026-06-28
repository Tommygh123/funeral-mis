import React from "react";

function CashierDashboard() {
  return (
    <div style={{ padding: "30px", fontFamily: "Arial" }}>
      <h1>Cashier Dashboard</h1>

      <p>Collect funeral donations here.</p>

      <button style={{ padding: "12px", background: "green", color: "white" }}>
        + New Donation
      </button>
    </div>
  );
}

export default CashierDashboard;