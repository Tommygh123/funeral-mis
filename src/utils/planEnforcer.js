import { supabase } from '../supabase';

/**
 * Checks if an institution is allowed to create another funeral event based on their plan
 * @param {string} institutionId 
 * @returns {Promise<{allowed: boolean, message: string}>}
 */
export const checkFuneralLimit = async (institutionId) => {
  try {
    // 1. Get the current active subscription profile
    const { data: sub, error: subError } = await supabase
      .from('subscriptions')
      .select('max_funerals, expires_at, status')
      .eq('institution_id', institutionId)
      .eq('status', 'active')
      .single();

    if (subError || !sub) {
      return { allowed: false, message: "No active subscription package found. Please select a plan." };
    }

    // 2. Verify expiration date safety
    if (new Date(sub.expires_at) < new Date()) {
      return { allowed: false, message: "Your subscription package has expired. Please renew." };
    }

    // 3. Count how many active funerals this institution has already created
    const { count, error: countError } = await supabase
      .from('funerals')
      .select('*', { count: 'exact', head: true })
      .eq('institution_id', institutionId);

    if (countError) throw countError;

    // 4. Compare current count against package allowances
    if (count >= sub.max_funerals) {
      return { 
        allowed: false, 
        message: `Plan limit reached! Your current package supports up to ${sub.max_funerals} funeral event(s). Please upgrade to the Professional Business Plan.` 
      };
    }

    return { allowed: true, message: "Limit verified successfully." };

  } catch (error) {
    console.error("Plan limit enforcement error:", error.message);
    return { allowed: false, message: "Failed to verify account permissions." };
  }
};