import { NextResponse } from "next/server";
import {
  createAuthenticatedServerClient,
  createServiceRoleServerClient,
  hasServerSupabaseEnv,
} from "@/lib/server-supabase";
import { sendNotificationEmail, buildGuardianPaymentRequestHtml } from "@/lib/email-notifications";

export const runtime = "nodejs";

type ImmediateCashGrant = {
  id: string;
  family_id: string;
  child_display_label: string;
  amount_jpy: number;
  granted_by_user_id: string | null;
  granted_by_email: string | null;
  granted_by_display_label: string;
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
  "https://www.miramane.me";

async function fetchEmailByUserId(userId: string): Promise<string | null> {
  const adminClient = createServiceRoleServerClient();
  const { data } = await adminClient
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .single();
  return data?.email ?? null;
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
    const guardianEmail =
      grant.granted_by_email ??
      (grant.granted_by_user_id ? await fetchEmailByUserId(grant.granted_by_user_id) : null);

    if (guardianEmail) {
      const amountFormatted = formatCurrency(grant.amount_jpy);
      await sendNotificationEmail({
        to: [guardianEmail],
        subject: "【ミラマネ】支払い申請が届きました",
        text: [
          `${grant.child_display_label}さんから払い出し申請が来ました！`,
          "",
          `子ども：${grant.child_display_label}`,
          `金額：${amountFormatted}`,
          "内容：すぐもらう",
          "",
          `${grant.child_display_label}さんにお金を渡したら、`,
          "ミラマネで「渡した」ボタンを押してください。",
          "",
          "また、お金を渡すだけでなく、",
          "どうして今払い出しを行ったのかを話し合ってみてください。",
          "",
          siteUrl,
          "",
          "家族と学ぶお金学習アプリ",
          "〜〜 ミラマネ 〜〜",
        ].join("\n"),
        html: buildGuardianPaymentRequestHtml({
          childName: grant.child_display_label,
          amount: amountFormatted,
          requestType: "すぐもらう",
          appUrl: siteUrl,
        }),
      }).catch(() => {
        // 操作成功を優先し、メール失敗ではUI操作を失敗扱いにしません。
      });
    }
  }

  return NextResponse.json({ grant });
}
