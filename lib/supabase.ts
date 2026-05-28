import { createClient } from "@supabase/supabase-js";
import { normalizeSupabaseUrl } from "@/lib/normalize-supabase-url";

const supabaseUrl = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. Check .env.local."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
