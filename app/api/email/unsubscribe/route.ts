import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeSupabaseUrl } from "@/lib/normalize-supabase-url";

export const runtime = "nodejs";

const supabaseUrl = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token")?.trim();

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "https://famimane.me";

  if (!token) {
    return NextResponse.redirect(`${appUrl}/unsubscribe?error=invalid`);
  }

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return NextResponse.redirect(`${appUrl}/unsubscribe?error=server`);
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Look up the token
  const { data: tokenRow, error: tokenError } = await adminClient
    .from("email_unsubscribe_tokens")
    .select("user_id")
    .eq("token", token)
    .maybeSingle();

  if (tokenError || !tokenRow) {
    return NextResponse.redirect(`${appUrl}/unsubscribe?error=invalid`);
  }

  // Set marketing_email_enabled = false (marketing emails only)
  const { error: updateError } = await adminClient
    .from("profiles")
    .update({
      marketing_email_enabled: false,
      marketing_email_unsubscribed_at: new Date().toISOString(),
    })
    .eq("id", tokenRow.user_id);

  if (updateError) {
    return NextResponse.redirect(`${appUrl}/unsubscribe?error=server`);
  }

  return NextResponse.redirect(`${appUrl}/unsubscribe?success=1`);
}
