import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase';

function CreateFuneral() {
  const [institution, setInstitution] = useState(null);
  const [loading, setLoading] = useState(false);
  const [photo, setPhoto] = useState(null);
  const navigate = useNavigate();

  const [form, setForm] = useState({
    full_name: '', gender: '', age: '', date_of_death: '',
    burial_date: '', location: '', notes: '', family_contact_name: '', 
    family_contact_phone: '', status: 'active'
  });

  const todayString = new Date().toISOString().split('T')[0];

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate('/login'); return; }
    
    const { data: profile } = await supabase
      .from('users')
      .select('institution_id')
      .eq('id', user.id)
      .single();

    if (profile?.institution_id) {
      const { data: inst } = await supabase
        .from('institutions')
        .select('*')
        .eq('id', profile.institution_id)
        .single();
      
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('max_funerals')
        .eq('institution_id', profile.institution_id)
        .single();

      setInstitution({ 
        ...inst, 
        limit: sub?.max_funerals || 1 
      });
    }
  }, [navigate]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!institution) return;

    if (!form.full_name) return alert("Deceased Name is required.");
    if (!form.age) return alert("Age is required.");
    if (!photo) return alert("Please upload a photo of the deceased.");
    if (!form.date_of_death) return alert("Date of death is required.");
    if (!form.burial_date) return alert("Burial date is required.");

    const dod = new Date(form.date_of_death);
    const burial = new Date(form.burial_date);
    const now = new Date();

    if (dod > now) return alert("Date of death cannot be in the future.");
    if (burial < dod) return alert("Burial date cannot be before the date of death.");

    if (institution.total_funerals_registered >= institution.limit) {
      return alert("Trial Limit Reached. Please upgrade your plan.");
    }

    setLoading(true);
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('deceased-logos')
      .upload(`${Date.now()}-${photo.name}`, photo);

    if (uploadError) {
      setLoading(false);
      return alert("Photo upload failed: " + uploadError.message);
    }

    const photoUrl = supabase.storage.from('deceased-logos').getPublicUrl(uploadData.path).data.publicUrl;

    const { error: insertError } = await supabase.from('funerals').insert([{ 
        institution_id: institution.id, 
        ...form, 
        age: parseInt(form.age),
        photo_url: photoUrl 
    }]);

    if (!insertError) {
      await supabase.from('institutions')
        .update({ total_funerals_registered: institution.total_funerals_registered + 1 })
        .eq('id', institution.id);

      alert("🎉 Funeral registered successfully.");
      // FIXED: Pointing to the root of the admin domain as per your App.jsx routes
      navigate('/admin'); 
    } else {
      alert(insertError.message);
    }
    setLoading(false);
  };

  if (!institution) return <div>Loading...</div>;

  const isAtLimit = institution.total_funerals_registered >= institution.limit;

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: 'auto' }}>
      <h2>Register Funeral ({institution.total_funerals_registered} / {institution.limit} used)</h2>
      
      {isAtLimit ? (
        <div style={{ padding: '15px', background: '#fee2e2', color: '#991b1b', marginBottom: '20px', borderRadius: '6px' }}>
          <p>You have reached your limit.</p>
          <button onClick={() => navigate('/admin/upgrade')} style={{ ...buttonStyle, background: '#dc2626' }}>
            View Plan Details & Upgrade
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <label>Deceased Name (Required)</label>
          <input name="full_name" onChange={handleChange} style={inputStyle} required />
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <select name="gender" onChange={handleChange} style={inputStyle} required>
                <option value="">Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
            </select>
            <input name="age" type="number" placeholder="Age (Required)" onChange={handleChange} style={inputStyle} required />
          </div>

          <label>Date of Death</label>
          <input type="date" name="date_of_death" max={todayString} onChange={handleChange} style={inputStyle} required />
          
          <label>Burial Date</label>
          <input type="date" name="burial_date" onChange={handleChange} style={inputStyle} required />
          
          <label>Location</label>
          <input name="location" onChange={handleChange} style={inputStyle} />
          
          <label>Family Contact Name</label>
          <input name="family_contact_name" onChange={handleChange} style={inputStyle} />
          
          <label>Family Contact Phone</label>
          <input name="family_contact_phone" onChange={handleChange} style={inputStyle} />
          
          <label>Notes</label>
          <textarea name="notes" onChange={handleChange} style={inputStyle} />
          
          <label>Photo (Required)</label>
          <input type="file" onChange={(e) => setPhoto(e.target.files[0])} style={inputStyle} accept="image/*" required />
          
          <button type="submit" disabled={loading} style={buttonStyle}>
            {loading ? 'Saving...' : 'Register'}
          </button>
        </form>
      )}
    </div>
  );
}

const inputStyle = { width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '6px', border: '1px solid #ccc' };
const buttonStyle = { width: '100%', padding: '15px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' };

export default CreateFuneral;