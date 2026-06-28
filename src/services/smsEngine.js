import { supabase } from '../supabase';

// =========================
// MESSAGE TEMPLATE
// =========================
export const buildReceiptSMS = (data) => {
  return (
    `LegacyCloud Receipt\n` +
    `---------------------\n` +
    `Name: ${data.donor_name}\n` +
    `Amount: ${data.amount} ${data.currency}\n` +
    `Funeral: ${data.funeral_name}\n` +
    `Receipt: ${data.receipt_no}\n\n` +
    `Thank you for your support 🙏`
  );
};

// =========================
// SAVE SMS TO DB (ENGINE CORE)
// =========================
export const queueSMS = async ({
  institution_id,
  transaction_id,
  phone,
  message
}) => {

  try {
    const { error } = await supabase.from('sms_logs').insert([
      {
        institution_id,
        transaction_id,
        phone,
        message,
        status: 'pending',
        provider: 'mock'
      }
    ]);

    if (error) throw error;

    console.log("📩 SMS queued");
    return true;

  } catch (err) {
    console.error("SMS queue error:", err.message);
    return false;
  }
};