import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { normalizeSupabaseUrl } from "@/lib/normalize-supabase-url";

export const runtime = "nodejs";

type InviteRole = "guardian" | "child";

const supabaseUrl = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function isInviteRole(value: unknown): value is InviteRole {
  return value === "guardian" || value === "child";
}

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeDisplayName(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function findUserByEmail(
  adminClient: SupabaseClient,
  email: string
) {
  const perPage = 200;

  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw error;
    }

    const user = data.users.find(
      (candidate) => candidate.email?.toLowerCase() === email
    );

    if (user) {
      return user;
    }

    if (data.users.length < perPage) {
      return null;
    }
  }

  return null;
}

export async function POST(request: Request) {
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonError("Supabase のサーバー環境変数が不足しています。", 500);
  }

  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return jsonError("ログイン状態を確認できませんでした。", 401);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError("リクエスト内容を読み取れませんでした。");
  }

  const familyId =
    typeof body === "object" && body !== null && "familyId" in body
      ? String(body.familyId)
      : "";
  const email =
    typeof body === "object" && body !== null && "email" in body
      ? normalizeEmail(body.email)
      : "";
  const role =
    typeof body === "object" && body !== null && "role" in body
      ? body.role
      : undefined;
  const displayName =
    typeof body === "object" && body !== null && "displayName" in body
      ? normalizeDisplayName(body.displayName)
      : "";

  if (!familyId) {
    return jsonError("家族IDが指定されていません。");
  }

  if (!email) {
    return jsonError("招待するメールアドレスを入力してください。");
  }

  if (!isInviteRole(role)) {
    return jsonError("招待する相手の種別が正しくありません。");
  }

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

  const { data: membership, error: membershipError } = await adminClient
    .from("family_members")
    .select("family_id")
    .eq("family_id", familyId)
    .eq("user_id", user.id)
    .eq("role", "guardian_admin")
    .maybeSingle();

  if (membershipError) {
    return jsonError(`招待権限の確認に失敗しました: ${membershipError.message}`, 500);
  }

  if (!membership) {
    return jsonError("招待を作成できるのは家族管理者だけです。", 403);
  }

  const { data: existingInvite, error: existingInviteError } = await adminClient
    .from("family_invites")
    .select("id")
    .eq("family_id", familyId)
    .eq("email", email)
    .eq("status", "pending")
    .maybeSingle();

  if (existingInviteError) {
    return jsonError(`既存招待の確認に失敗しました: ${existingInviteError.message}`, 500);
  }

  if (existingInvite) {
    return jsonError("このメールアドレスには承認待ちの招待がすでにあります。", 409);
  }

  let invitedUser = null;

  try {
    invitedUser = await findUserByEmail(adminClient, email);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";

    return jsonError(`招待ユーザーの確認に失敗しました: ${message}`, 500);
  }

  if (invitedUser) {
    const { data: existingFamilyMember, error: existingFamilyMemberError } =
      await adminClient
        .from("family_members")
        .select("family_id")
        .eq("user_id", invitedUser.id)
        .maybeSingle();

    if (existingFamilyMemberError) {
      return jsonError(
        `家族所属の確認に失敗しました: ${existingFamilyMemberError.message}`,
        500
      );
    }

    if (existingFamilyMember) {
      return jsonError("このユーザーはすでに家族に所属しています。", 409);
    }
  }

  if (!invitedUser) {
    const { data: createdUserData, error: createUserError } =
      await adminClient.auth.admin.createUser({
        email,
        email_confirm: true,
      });

    if (createUserError || !createdUserData.user) {
      return jsonError(
        `招待ユーザーの作成に失敗しました: ${createUserError?.message ?? "unknown error"}`,
        500
      );
    }

    invitedUser = createdUserData.user;
  }

  const { error: profileError } = await adminClient.from("profiles").upsert({
    id: invitedUser.id,
    email,
    display_name: displayName || null,
  });

  if (profileError) {
    return jsonError(`プロフィールの準備に失敗しました: ${profileError.message}`, 500);
  }

  const { data: invite, error: inviteError } = await adminClient
    .from("family_invites")
    .insert({
      family_id: familyId,
      email,
      role,
      invited_by_user_id: user.id,
    })
    .select("id, email, role, expires_at")
    .single();

  if (inviteError) {
    return jsonError(`招待の作成に失敗しました: ${inviteError.message}`, 500);
  }

  return NextResponse.json({ invite });
}
