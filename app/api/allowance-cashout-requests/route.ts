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

type GrantGrantedBy = {
  id: string;
  granted_by_user_id: string;
};

type GuardianProfile = {
  id: string;
  email: string | null;
  display_name: string | null;
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
  "https://famimane.me";

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

  const adminClient = createServiceRoleServerClient();
  const userClient = createAuthenticatedServerClient(authorization);

  // Look up granted_by_user_id for each grant
  const { data: grantsInfo, error: grantsInfoError } = await adminClient
    .from("allowance_grants")
    .select("id, granted_by_user_id")
    .in("id", grantIds);

  if (grantsInfoError) {
    return jsonError(`担当保護者の取得に失敗しました: ${grantsInfoError.message}`, 500);
  }

  // Group grant IDs by guardian
  const guardianGroups = new Map<string, string[]>();
  for (const grant of (grantsInfo ?? []) as GrantGrantedBy[]) {
    const gId = grant.granted_by_user_id;
    if (!gId) continue;
    if (!guardianGroups.has(gId)) guardianGroups.set(gId, []);
    guardianGroups.get(gId)!.push(grant.id);
  }

  if (guardianGroups.size === 0) {
    return jsonError("引き出すお小遣いの担当保護者を特定できませんでした。", 500);
  }

  // Fetch guardian profiles for notification
  const guardianIds = [...guardianGroups.keys()];
  const { data: profiles } = await adminClient
    .from("profiles")
    .select("id, email, display_name")
    .in("id", guardianIds);

  const profileMap = new Map<string, GuardianProfile>();
  for (const p of (profiles ?? []) as GuardianProfile[]) {
    profileMap.set(p.id, p);
  }

  // Create one cashout request per guardian and send individual notifications
  const cashoutResults: CashoutRequest[] = [];

  for (const [guardianId, guardianGrantIds] of guardianGroups) {
    const { data, error } = await userClient.rpc("request_cashout_for_allowances", {
      target_allowance_grant_ids: guardianGrantIds,
    });

    if (error) {
      return jsonError(`引き出し申請に失敗しました: ${error.message}`, 500);
    }

    const cashoutRequest = Array.isArray(data)
      ? (data[0] as CashoutRequest | undefined)
      : undefined;

    if (!cashoutRequest) continue;

    cashoutResults.push(cashoutRequest);

    const guardian = profileMap.get(guardianId);
    const guardianEmail = guardian?.email;

    if (guardianEmail) {
      const amountFormatted = formatCurrency(cashoutRequest.requested_amount_jpy);
      await sendNotificationEmail({
        to: [guardianEmail],
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
        await adminClient.from("allowance_notification_logs").insert({
          family_id: cashoutRequest.family_id,
          notification_type: "cashout_requested",
          recipient_email: guardianEmail,
          subject: "【ファミマネ】支払い申請が届きました",
          status: "failed",
          error_message: emailError instanceof Error ? emailError.message : "unknown error",
        });
      });
    }
  }

  return NextResponse.json({ cashoutRequests: cashoutResults });
}
