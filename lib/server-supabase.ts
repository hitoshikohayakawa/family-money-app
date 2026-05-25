import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;

export function hasServerSupabaseEnv() {
  return Boolean(supabaseUrl && supabaseAnonKey && supabaseServiceRoleKey);
}

export function createAuthenticatedServerClient(authorization: string) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase の公開環境変数が不足しています。");
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authorization,
      },
    },
  });
}

export function createServiceRoleServerClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Supabase のサーバー環境変数が不足しています。");
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
