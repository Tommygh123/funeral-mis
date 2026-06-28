import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabase';

function FuneralManagement() {

  const [funerals, setFunerals] = useState([]);
  const [institutionId, setInstitutionId] = useState(null);

  const [form, setForm] = useState({
    id: null,
    full_name: '',
    date_of_death: '',
    burial_date: '',
    family_contact_name: '',
    family_contact_phone: '',
    location: '',
    notes: '',
    status: 'active'
  });

  const [photo, setPhoto] = useState(null);
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    loadContext();
  }, []);

  // =========================
  // LOAD CONTEXT
  // =========================
  const loadContext = async () => {

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('users')
      .select('institution_id')
      .eq('id', user.id)
      .single();

    const instId = data?.institution_id;

    if (!instId) {
      alert("Institution not found");
      return;
    }

    setInstitutionId(instId);
    fetchFunerals(instId);
  };

  // =========================
  // FETCH FUNERALS
  // =========================
  const fetchFunerals = async (instId) => {

    const { data } = await supabase
      .from('funerals')
      .select('*')
      .eq('institution_id', instId)
      .order('created_at', { ascending: false });

    setFunerals(data || []);
  };

  // =========================
  // INPUT HANDLER
  // =========================
  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  };

  // =========================
  // PHOTO
  // =========================
  const handlePhoto = (e) => {
    setPhoto(e.target.files?.[0] || null);
  };

  // =========================
  // CREATE / UPDATE
  // =========================
  const handleSubmit = async () => {

    try {

      if (!institutionId) {
        alert("Institution missing");
        return;
      }

      if (!form.full_name) {
        alert("Full name required");
        return;
      }

      setLoading(true);

      let photoUrl = null;

      // =========================
      // UPLOAD PHOTO
      // =========================
      if (photo) {

        const fileName = `${Date.now()}-${photo.name}`;

        const { error: uploadError } = await supabase
          .storage
          .from('funeral-photos')
          .upload(fileName, photo);

        if (uploadError) throw uploadError;

        const { data } = supabase
          .storage
          .from('funeral-photos')
          .getPublicUrl(fileName);

        photoUrl = data?.publicUrl || null;
      }

      // =========================
      // CREATE
      // =========================
      if (!editMode) {

        const { error } = await supabase.from('funerals').insert([
          {
            institution_id: institutionId,
            full_name: form.full_name,
            photo_url: photoUrl,
            date_of_death: form.date_of_death || null,
            burial_date: form.burial_date || null,
            family_contact_name: form.family_contact_name || null,
            family_contact_phone: form.family_contact_phone || null,
            location: form.location || null,
            notes: form.notes || null,
            status: form.status || 'active'
          }
        ]);

        if (error) throw error;

        alert("Funeral created successfully");
      }

      // =========================
      // UPDATE
      // =========================
      else {

        const { error } = await supabase
          .from('funerals')
          .update({
            full_name: form.full_name,
            date_of_death: form.date_of_death || null,
            burial_date: form.burial_date || null,
            family_contact_name: form.family_contact_name || null,
            family_contact_phone: form.family_contact_phone || null,
            location: form.location || null,
            notes: form.notes || null,
            status: form.status || 'active',
            ...(photoUrl && { photo_url: photoUrl })
          })
          .eq('id', form.id);

        if (error) throw error;

        alert("Updated successfully");
      }

      resetForm();
      fetchFunerals(institutionId);

    } catch (err) {
      console.error(err);
      alert(err.message);
    }

    setLoading(false);
  };

  // =========================
  // EDIT
  // =========================
  const handleEdit = (funeral) => {

    setForm({
      id: funeral.id,
      full_name: funeral.full_name || '',
      date_of_death: funeral.date_of_death || '',
      burial_date: funeral.burial_date || '',
      family_contact_name: funeral.family_contact_name || '',
      family_contact_phone: funeral.family_contact_phone || '',
      location: funeral.location || '',
      notes: funeral.notes || '',
      status: funeral.status || 'active'
    });

    setEditMode(true);
  };

  // =========================
  // DELETE
  // =========================
  const handleDelete = async (id) => {

    if (!window.confirm("Delete this funeral?")) return;

    const { error } = await supabase
      .from('funerals')
      .delete()
      .eq('id', id);

    if (error) {
      alert(error.message);
      return;
    }

    fetchFunerals(institutionId);
  };

  // =========================
  // RESET
  // =========================
  const resetForm = () => {

    setForm({
      id: null,
      full_name: '',
      date_of_death: '',
      burial_date: '',
      family_contact_name: '',
      family_contact_phone: '',
      location: '',
      notes: '',
      status: 'active'
    });

    setPhoto(null);
    setEditMode(false);
  };

  return (
    <div style={{ padding: 30 }}>

      <h1>Funeral Management</h1>

      {/* FORM */}
      <div style={{
        background: '#fff',
        padding: 20,
        borderRadius: 10,
        maxWidth: 500
      }}>

        <input
          name="full_name"
          placeholder="Deceased Name"
          value={form.full_name}
          onChange={handleChange}
          style={input}
        />

        <input type="date" name="date_of_death" value={form.date_of_death} onChange={handleChange} style={input} />

        <input type="date" name="burial_date" value={form.burial_date} onChange={handleChange} style={input} />

        <input name="family_contact_name" placeholder="Family Contact" value={form.family_contact_name} onChange={handleChange} style={input} />

        <input name="family_contact_phone" placeholder="Phone" value={form.family_contact_phone} onChange={handleChange} style={input} />

        <input name="location" placeholder="Location" value={form.location} onChange={handleChange} style={input} />

        <textarea name="notes" placeholder="Notes" value={form.notes} onChange={handleChange} style={input} />

        <input type="file" onChange={handlePhoto} />

        <button onClick={handleSubmit} style={btn}>
          {loading ? "Saving..." : editMode ? "Update Funeral" : "Create Funeral"}
        </button>

        {editMode && (
          <button onClick={resetForm} style={{ marginLeft: 10 }}>
            Cancel
          </button>
        )}

      </div>

      {/* LIST */}
      <div style={{ marginTop: 40 }}>
        <h2>Funerals</h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))',
          gap: 20
        }}>

          {funerals.map(f => (
            <div key={f.id} style={card}>

              {f.photo_url && (
                <img
                  src={f.photo_url}
                  style={{
                    width: '100%',
                    height: 200,
                    objectFit: 'cover',
                    borderRadius: 10
                  }}
                />
              )}

              <h3>{f.full_name}</h3>
              <p>Status: {f.status}</p>
              <p>{f.location}</p>

              <button onClick={() => handleEdit(f)}>Edit</button>

              <button
                onClick={() => handleDelete(f.id)}
                style={{ marginLeft: 10, color: 'red' }}
              >
                Delete
              </button>

            </div>
          ))}

        </div>
      </div>

    </div>
  );
}

// =========================
// STYLES
// =========================
const input = {
  width: '100%',
  padding: 10,
  marginBottom: 10,
  borderRadius: 6,
  border: '1px solid #ddd'
};

const btn = {
  padding: 12,
  background: '#2563eb',
  color: '#fff',
  border: 'none',
  marginTop: 10,
  borderRadius: 6
};

const card = {
  background: '#fff',
  padding: 15,
  borderRadius: 10
};

export default FuneralManagement;