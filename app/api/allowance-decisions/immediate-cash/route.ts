import { NextResponse } from "next/server";
import {
  createAuthenticatedServerClient,
  createServiceRoleServerClient,
  hasServerSupabaseEnv,
} from "@/lib/server-supabase";
import { sendNotificationEmail } from "@/lib/email-notifications";

export const runtime = "nodejs";

type ImmediateCashGrant = {
  id: string;
  family_id: string;
  child_display_label: string;
  amount_jpy: number;
};

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(amount);
}

async function fetchGuardianEmails(familyId: string) {
  const adminClient = createServiceRoleServerClient();
  const { data: members, error: membersError } = await adminClient
    .from("family_members")
    .select("user_id")
    .eq("family_id", familyId)
    .in("role", ["guardian_admin", "guardian"]);

  if (membersError) {
    throw membersError;
  }

  const userIds = (members ?? []).map((member) => member.user_id).filter(Boolean);

  if (userIds.length === 0) {
    return [];
  }

  const { data: profiles, error: profilesError } = await adminClient
    .from("profiles")
    .select("email")
    .in("id", userIds);

  if (profilesError) {
    throw profilesError;
  }

  return (profiles ?? []).map((profile) => profile.email).filter((email): email is string => Boolean(email));
}

export async function POST(request: Request) {
  if (!hasServerSupabaseEnv()) {
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

  const grantId =
    typeof body === "object" && body !== null && "grantId" in body ? String(body.grantId) : "";

  if (!grantId) {
    return jsonError("お小遣いIDが指定されていません。");
  }

  const userClient = createAuthenticatedServerClient(authorization);
  const { data, error } = await userClient.rpc("request_immediate_cash_for_allowance", {
    target_allowance_grant_id: grantId,
  });

  if (error) {
    return jsonError(`すぐにもらう選択に失敗しました: ${error.message}`, 500);
  }

  const grant = Array.isArray(data) ? (data[0] as ImmediateCashGrant | undefined) : undefined;

  if (grant) {
    const guardianEmails = await fetchGuardianEmails(grant.family_id);

    await sendNotificationEmail({
      to: guardianEmails,
      subject: "ファミマネ: お小遣いの受け取り申請が届きました",
      text: [
        "ファミマネからのお知らせです。",
        "",
        `${grant.child_display_label} さんが ${formatCurrency(
          grant.amount_jpy
        )} を「すぐにもらう」で申請しました。`,
        "ファミマネにログインして、支払いが完了したら「子供にお金を払いました」を押してください。",
      ].join("\n"),
    }).catch(() => {
      // 操作成功を優先し、メール失敗ではUI操作を失敗扱いにしません。
    });
  }

  return NextResponse.json({ grant });
}
