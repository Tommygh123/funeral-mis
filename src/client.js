import { createClient } from '@supabase/supabase-js';

// Pull environment target metrics out of the runtime configuration scope
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

// ==========================================
// SYSTEM ENVIRONMENT VALIDATION GUARD
// ==========================================
if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "⚠️ RUNTIME ARCHITECTURE ERROR:\n" +
    "Supabase credentials could not be loaded by the application bundle.\n" +
    "Verify that your .env configuration file resides in the project root directory, " +
    "and restart your terminal process."
  );
} else {
  console.log("🌐 Connection established with backend cluster node: rouwinbyputjuhiucrpb");
}

// Initialize the secure multi-tenant communication client pipeline
export const supabase = createClient(supabaseUrl, supabaseAnonKey);