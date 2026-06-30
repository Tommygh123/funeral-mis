import { supabase } from '../supabase';
import { db } from '../db';

export const saveTransaction = async (data) => {
  if (navigator.onLine) {
    try {
      const { error } = await supabase.from('valid_transactions').insert([data]);
      if (!error) return { success: true };
    } catch (e) {
      console.log("Supabase failed, queuing...");
    }
  }
  
  // If we reach here, it means we are offline or Supabase failed
  await db.pendingTransactions.add({ ...data, status: 'pending' });
  return { success: false, message: "Saved locally" };
};