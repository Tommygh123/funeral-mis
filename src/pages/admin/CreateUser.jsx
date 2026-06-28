import React, { useEffect, useState } from "react";
import { supabase } from "../../supabase";

function CreateUser() {

  // =========================
  // STATE
  // =========================
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    role_id: ""
  });

  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);

  // =========================
  // LOAD ROLES
  // =========================
  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {

    const { data, error } = await supabase
      .from("roles")
      .select("id, name");

    if (error) {
      console.error(error);
      return;
    }

    setRoles(data || []);
  };

  // =========================
  // HANDLE INPUT
  // =========================
  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  };

  // =========================
  // SUBMIT USER
  // =========================
  const handleSubmit = async () => {

    try {

      setLoading(true);

      if (!form.full_name || !form.role_id) {
        alert("Name and Role are required");
        return;
      }

      const { error } = await supabase
        .from("users")
        .insert([form]);

      if (error) {
        throw error;
      }

      alert("User created successfully!");

      setForm({
        full_name: "",
        email: "",
        phone: "",
        role_id: ""
      });

    } catch (err) {
      alert(err.message);
    }

    setLoading(false);
  };

  // =========================
  // UI
  // =========================
  return (
    <div style={styles.container}>

      <h2>Create User</h2>

      <input
        name="full_name"
        placeholder="Full Name"
        value={form.full_name}
        onChange={handleChange}
        style={styles.input}
      />

      <input
        name="email"
        placeholder="Email"
        value={form.email}
        onChange={handleChange}
        style={styles.input}
      />

      <input
        name="phone"
        placeholder="Phone"
        value={form.phone}
        onChange={handleChange}
        style={styles.input}
      />

      {/* =========================
          ROLE DROPDOWN (FIX)
      ========================= */}
      <select
        name="role_id"
        value={form.role_id}
        onChange={handleChange}
        style={styles.input}
      >
        <option value="">Select Role</option>

        {roles.map((role) => (
          <option key={role.id} value={role.id}>
            {role.name}
          </option>
        ))}
      </select>

      <button
        onClick={handleSubmit}
        style={styles.button}
        disabled={loading}
      >
        {loading ? "Creating..." : "Create User"}
      </button>

    </div>
  );
}

// =========================
// STYLES
// =========================
const styles = {
  container: {
    padding: "30px",
    maxWidth: "400px"
  },
  input: {
    width: "100%",
    padding: "12px",
    marginBottom: "10px",
    border: "1px solid #ccc",
    borderRadius: "6px"
  },
  button: {
    width: "100%",
    padding: "12px",
    background: "#2563eb",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer"
  }
};

export default CreateUser;