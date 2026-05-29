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

function normalizeDisplayName(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ userId: string }> }
) {
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonError("Supabase のサーバー環境変数が不足しています。", 500);
  }

  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return jsonError("ログイン状態を確認できませんでした。", 401);
  }

  const { userId } = await context.params;

  if (!userId) {
    return jsonError("対象ユーザーが指定されていません。");
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError("リクエスト内容を読み取れませんでした。");
  }

  const displayName =
    typeof body === "object" && body !== null && "displayName" in body
      ? normalizeDisplayName(body.displayName)
      : "";

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authorization,
      },
    },
  });

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user) {
    return jsonError("ログイン状態を確認できませんでした。", 401);
  }

  if (user.id !== userId) {
    const { data: requesterMembership, error: requesterMembershipError } = await adminClient
      .from("family_memberships")
      .select("family_id, role")
      .eq("status", "active")
      .eq("user_id", user.id)
      .maybeSingle();

    if (requesterMembershipError) {
      return jsonError(
        `家族権限の確認に失敗しました: ${requesterMembershipError.message}`,
        500
      );
    }

    if (
      !requesterMembership ||
      (requesterMembership.role !== "guardian_admin" && requesterMembership.role !== "guardian")
    ) {
      return jsonError("家族の名前を編集できるのは親だけです。", 403);
    }

    const { data: targetMembership, error: targetMembershipError } = await adminClient
      .from("family_memberships")
      .select("family_id")
      .eq("status", "active")
      .eq("user_id", userId)
      .eq("family_id", requesterMembership.family_id)
      .maybeSingle();

    if (targetMembershipError) {
      return jsonError(`家族メンバーの確認に失敗しました: ${targetMembershipError.message}`, 500);
    }

    if (!targetMembership) {
      return jsonError("同じ家族のメンバーだけ編集できます。", 403);
    }
  }

  const { data: existingProfile, error: existingProfileError } = await adminClient
    .from("profiles")
    .select("id, email")
    .eq("id", userId)
    .maybeSingle();

  if (existingProfileError) {
    return jsonError(`既存プロフィールの確認に失敗しました: ${existingProfileError.message}`, 500);
  }

  let profileEmail = existingProfile?.email || (user.id === userId ? user.email ?? null : null);

  if (!profileEmail) {
    const { data: authUserData, error: authUserError } = await adminClient.auth.admin.getUserById(
      userId
    );

    if (authUserError) {
      return jsonError(`メールアドレスの確認に失敗しました: ${authUserError.message}`, 500);
    }

    profileEmail = authUserData.user?.email ?? null;
  }

  if (!profileEmail) {
    return jsonError("プロフィール保存に必要なメールアドレスを取得できませんでした。", 500);
  }

  const { error: profileError } = await adminClient.from("profiles").upsert({
    id: userId,
    email: profileEmail,
    display_name: displayName || null,
  });

  if (profileError) {
    return jsonError(`表示名の保存に失敗しました: ${profileError.message}`, 500);
  }

  return NextResponse.json({
    ok: true,
    displayName: displayName || null,
  });
}
