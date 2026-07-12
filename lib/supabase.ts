import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./env.js";

const supabaseEnv = getSupabaseEnv();

export const supabase = createClient(supabaseEnv.supabaseUrl, supabaseEnv.supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});
