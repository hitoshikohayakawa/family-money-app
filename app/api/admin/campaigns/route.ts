import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeSupabaseUrl } from "@/lib/normalize-supabase-url";

export const runtime = "nodejs";

const supabaseUrl = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function getGuardianAdmin(authorization: string | null) {
  if (!authorization?.startsWith("Bearer ") || !supabaseUrl || !supabaseAnonKey) return null;
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) return null;

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: membership } = await adminClient
    .from("family_memberships")
    .select("role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (membership?.role !== "guardian_admin") return null;
  return user;
}

// GET /api/admin/campaigns — list campaigns
export async function GET(request: Request) {
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonError("Server configuration error", 500);
  }
  const user = await getGuardianAdmin(request.headers.get("authorization"));
  if (!user) return jsonError("権限がありません", 403);

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await adminClient
    .from("email_campaigns")
    .select("id, subject, target_role, campaign_type, status, total_count, success_count, fail_count, sent_at, created_at")
    .eq("sent_by", user.id)
    .order("created_at", { ascending: false });

  if (error) return jsonError(`取得に失敗しました: ${error.message}`, 500);
  return NextResponse.json({ campaigns: data });
}

// POST /api/admin/campaigns — create draft campaign
export async function POST(request: Request) {
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonError("Server configuration error", 500);
  }
  const user = await getGuardianAdmin(request.headers.get("authorization"));
  if (!user) return jsonError("権限がありません", 403);

  let body: unknown;
  try { body = await request.json(); } catch { return jsonError("リクエストを読み取れません"); }

  const { subject, body_text, target_role } = body as Record<string, unknown>;
  if (typeof subject !== "string" || !subject.trim()) return jsonError("件名を入力してください");
  if (typeof body_text !== "string" || !body_text.trim()) return jsonError("本文を入力してください");
  if (!["all", "guardian", "child"].includes(target_role as string)) {
    return jsonError("送信対象が不正です");
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await adminClient
    .from("email_campaigns")
    .insert({
      subject: subject.trim(),
      body_text: body_text.trim(),
      target_role,
      sent_by: user.id,
    })
    .select()
    .single();

  if (error) return jsonError(`作成に失敗しました: ${error.message}`, 500);
  return NextResponse.json({ campaign: data }, { status: 201 });
}
