import { NextResponse } from "next/server";
import {
  createAuthenticatedServerClient,
  createServiceRoleServerClient,
  hasServerSupabaseEnv,
} from "@/lib/server-supabase";
import { sendNotificationEmail, buildGuardianPaymentRequestHtml } from "@/lib/email-notifications";

export const runtime = "nodejs";

type CashoutRequest = {
  cashout_request_id: string;
  family_id: string;
  child_display_label: string;
  requested_amount_jpy: number;
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

const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.NEXT_PUBLIC_SITE_URL ??
  "https://famimane.app";

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

  const grantIds =
    typeof body === "object" && body !== null && "grantIds" in body && Array.isArray(body.grantIds)
      ? body.grantIds.map(String)
      : [];

  if (grantIds.length === 0) {
    return jsonError("引き出すお小遣いを選んでください。");
  }

  const userClient = createAuthenticatedServerClient(authorization);

  const { data, error } = await userClient.rpc("request_cashout_for_allowances", {
    target_allowance_grant_ids: grantIds,
  });

  if (error) {
    return jsonError(`引き出し申請に失敗しました: ${error.message}`, 500);
  }

  const cashoutRequest = Array.isArray(data)
    ? (data[0] as CashoutRequest | undefined)
    : undefined;

  if (cashoutRequest) {
    const guardianEmails = await fetchGuardianEmails(cashoutRequest.family_id);

    const amountFormatted = formatCurrency(cashoutRequest.requested_amount_jpy);
    await sendNotificationEmail({
      to: guardianEmails,
      subject: "【ファミマネ】支払い申請が届きました",
      text: [
        `${cashoutRequest.child_display_label}さんから払い出し申請が来ました！`,
        "",
        `子ども：${cashoutRequest.child_display_label}`,
        `金額：${amountFormatted}`,
        "内容：投資したお小遣いの払い出し",
        "",
        `${cashoutRequest.child_display_label}さんにお金を渡したら、`,
        "ファミマネで「渡した」ボタンを押してください。",
        "",
        "また、お金を渡すだけでなく、",
        "どうして今払い出しを行ったのかを話し合ってみてください。",
        "",
        siteUrl,
        "",
        "家族と学ぶお金学習アプリ",
        "〜〜 ファミマネ 〜〜",
      ].join("\n"),
      html: buildGuardianPaymentRequestHtml({
        childName: cashoutRequest.child_display_label,
        amount: amountFormatted,
        requestType: "投資したお小遣いの払い出し",
        appUrl: siteUrl,
      }),
    }).catch(async (emailError: unknown) => {
      const adminClient = createServiceRoleServerClient();
      await adminClient.from("allowance_notification_logs").insert({
        family_id: cashoutRequest.family_id,
        notification_type: "cashout_requested",
        recipient_email: guardianEmails.join(","),
        subject: "ファミマネ: お小遣いの引き出し申請が届きました",
        status: "failed",
        error_message: emailError instanceof Error ? emailError.message : "unknown error",
      });
    });
  }

  return NextResponse.json({ cashoutRequest });
}
