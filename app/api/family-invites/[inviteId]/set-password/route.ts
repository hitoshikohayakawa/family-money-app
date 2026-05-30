import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeSupabaseUrl } from "@/lib/normalize-supabase-url";

export const runtime = "nodejs";

const supabaseUrl = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ inviteId: string }> }
) {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return jsonError("Supabase のサーバー環境変数が不足しています。", 500);
  }

  const { inviteId } = await context.params;

  if (!inviteId) {
    return jsonError("招待IDが指定されていません。");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("リクエスト内容を読み取れませんでした。");
  }

  const email =
    typeof body === "object" && body !== null && "email" in body
      ? String(body.email).trim().toLowerCase()
      : "";
  const password =
    typeof body === "object" && body !== null && "password" in body
      ? String(body.password)
      : "";

  if (!email) {
    return jsonError("メールアドレスを入力してください。");
  }

  if (password.length < 6) {
    return jsonError("パスワードは6文字以上で入力してください。");
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: invite, error: inviteError } = await adminClient
    .from("family_invites")
    .select("id, email, status, expires_at")
    .eq("id", inviteId)
    .maybeSingle();

  if (inviteError) {
    return jsonError(`招待の確認に失敗しました: ${inviteError.message}`, 500);
  }

  if (!invite) {
    return jsonError("招待が見つかりません。");
  }

  if (invite.status !== "pending") {
    return jsonError("この招待は使用できません。");
  }

  if (new Date(invite.expires_at) <= new Date()) {
    return jsonError("この招待は期限切れです。");
  }

  if (invite.email.trim().toLowerCase() !== email) {
    return jsonError("メールアドレスが一致しません。");
  }

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id")
    .eq("email", invite.email)
    .maybeSingle();

  if (profileError) {
    return jsonError(`ユーザー情報の取得に失敗しました: ${profileError.message}`, 500);
  }

  if (!profile) {
    return jsonError("招待先のユーザーが見つかりません。", 500);
  }

  const { error: updateError } = await adminClient.auth.admin.updateUserById(
    profile.id,
    {
      password,
      user_metadata: { requires_password_setup: false },
    }
  );

  if (updateError) {
    return jsonError(`パスワードの設定に失敗しました: ${updateError.message}`, 500);
  }

  return NextResponse.json({ email: invite.email });
}
