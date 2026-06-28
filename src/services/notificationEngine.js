import { supabase } from '../supabase';

// =========================
// NORMALIZE PHONE
// =========================
export const normalizePhone = (phone) => {
  if (!phone) return null;

  let p = phone.replace(/\s/g, '');

  // Ghana
  if (p.startsWith('0')) {
    p = '+233' + p.substring(1);
  }

  // ensure +
  if (!p.startsWith('+')) {
    p = '+' + p;
  }

  return p;
};

// =========================
// ROUTE CHANNEL
// =========================
export const getChannel = (phone) => {
  if (!phone) return 'whatsapp';

  if (phone.startsWith('+233')) {
    return 'sms';
  }

  return 'whatsapp';
};

// =========================
// CREATE NOTIFICATION
// =========================
export const createNotification = async ({
  institution_id,
  funeral_id,
  transaction_id,
  recipient_name,
  recipient_phone,
  message
}) => {

  const phone = normalizePhone(recipient_phone);
  const channel = getChannel(phone);

  const { data, error } = await supabase
    .from('notifications')
    .insert([
      {
        institution_id,
        funeral_id,
        transaction_id,
        recipient_name,
        recipient_phone: phone,
        channel,
        message,
        status: 'pending'
      }
    ])
    .select()
    .single();

  if (error) throw error;

  return data;
};