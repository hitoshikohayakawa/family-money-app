import { NextResponse } from "next/server";
import {
  createAuthenticatedServerClient,
  createServiceRoleServerClient,
  hasServerSupabaseEnv,
} from "@/lib/server-supabase";
import { sendNotificationEmail } from "@/lib/email-notifications";

export const runtime = "nodejs";

type CreatedAllowanceGrant = {
  id: string;
  family_id: string;
  child_email: string | null;
  child_display_label: string;
  amount_jpy: number;
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
  "https://famimane.me";

function escapeHtml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildAllowanceGrantedHtml({
  childName,
  parentName,
  amount,
  appUrl,
}: {
  childName: string;
  parentName: string;
  amount: string;
  appUrl: string;
}) {
  const logoUrl = `${appUrl}/assets/lp/logo.png`;

  return `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f0f7f1;font-family:'Helvetica Neue',Arial,'Hiragino Kaku Gothic ProN',sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:32px 16px;">

    <div style="text-align:center;margin-bottom:28px;">
      <img src="${logoUrl}" alt="ファミマネ" width="160" style="max-width:160px;height:auto;">
    </div>

    <div style="background:#ffffff;border-radius:24px;padding:32px 28px;box-shadow:0 4px 20px rgba(0,0,0,0.07);">

      <p style="font-size:20px;font-weight:bold;color:#1a3d1a;margin:0 0 6px 0;">
        ${escapeHtml(childName)}さん
      </p>
      <p style="font-size:14px;color:#6b7c6b;margin:0 0 24px 0;">
        ファミマネからのお知らせです
      </p>

      <p style="font-size:16px;color:#1a3d1a;line-height:1.7;margin:0 0 24px 0;">
        <strong>${escapeHtml(parentName)}</strong>よりお小遣いが届きました！
      </p>

      <div style="background:#f3fbf4;border-radius:16px;padding:8px 0 20px;text-align:center;margin:0 0 28px 0;">
        <p style="font-size:12px;font-weight:bold;color:#6b9b6b;margin:0 0 6px 0;letter-spacing:0.1em;">金　額</p>
        <div style="margin:0 20px;border-top:2px solid #c8e6c9;"></div>
        <p style="font-size:36px;font-weight:900;color:#1a3d1a;margin:10px 0 8px 0;">${escapeHtml(amount)}</p>
        <div style="margin:0 20px;border-top:2px solid #c8e6c9;"></div>
      </div>

      <p style="font-size:15px;color:#1a3d1a;line-height:1.9;margin:0 0 12px 0;">
        さっそくファミマネを開いて<br>
        「今すぐもらう」か「投資（とうし）する」かを選びましょう！
      </p>
      <p style="font-size:13px;color:#8a9d8a;line-height:1.8;margin:0 0 28px 0;">
        どうしたらいいか迷ったときは<br>パパ・ママと相談して決めてみてね！
      </p>

      <div style="text-align:center;">
        <a href="${escapeHtml(appUrl)}"
           style="display:inline-block;background:#2d7a4f;color:#ffffff;text-decoration:none;padding:14px 44px;border-radius:100px;font-size:15px;font-weight:bold;letter-spacing:0.05em;">
          ファミマネを開く
        </a>
      </div>

    </div>

    <div style="text-align:center;padding:24px 0 8px;">
      <p style="font-size:12px;color:#aab8aa;margin:0 0 4px 0;">家族と学ぶお金学習アプリ</p>
      <p style="font-size:13px;font-weight:bold;color:#9aaa9a;margin:0;">〜〜 ファミマネ 〜〜</p>
    </div>

  </div>
</body>
</html>`;
}

async function handlePost(request: Request) {
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

  const childUserId =
    typeof body === "object" && body !== null && "childUserId" in body
      ? String(body.childUserId)
      : "";
  const amountJpy =
    typeof body === "object" && body !== null && "amountJpy" in body
      ? Number(body.amountJpy)
      : 0;
  const note =
    typeof body === "object" && body !== null && "note" in body ? String(body.note) : "";
  const grantedAt =
    typeof body === "object" && body !== null && "grantedAt" in body
      ? String(body.grantedAt)
      : "";

  if (!childUserId) {
    return jsonError("お小遣いを渡す子どもを選んでください。");
  }

  if (!Number.isInteger(amountJpy) || amountJpy <= 0) {
    return jsonError("お小遣いの金額は1円以上で入力してください。");
  }

  const userClient = createAuthenticatedServerClient(authorization);
  const adminClient = createServiceRoleServerClient();

  const { data, error } = await userClient.rpc("create_allowance_grant", {
    target_child_user_id: childUserId,
    grant_amount_jpy: amountJpy,
    grant_note: note,
    grant_granted_at: grantedAt,
  });

  if (error) {
    return jsonError(`お小遣いの作成に失敗しました: ${error.message}`, 500);
  }

  const grant = Array.isArray(data) ? (data[0] as CreatedAllowanceGrant | undefined) : undefined;

  if (grant?.child_email) {
    const amountFormatted = formatCurrency(grant.amount_jpy);
    await sendNotificationEmail({
      to: [grant.child_email],
      subject: "【ファミマネ】お小遣いが届きました",
      text: [
        `${grant.child_display_label}さん`,
        "",
        `${grant.granted_by_display_label}よりお小遣いが届きました！`,
        "",
        "＝＝＝＝＝＝＝＝",
        `金額：${amountFormatted}`,
        "＝＝＝＝＝＝＝＝",
        "",
        "さっそくファミマネを開いて",
        "「今すぐもらう」か「投資（とうし）する」かを選びましょう！",
        "",
        "どうしたらいいか迷ったときはパパ・ママと相談して決めてみてね！",
        "",
        `ファミマネはこちらからアクセス`,
        siteUrl,
        "",
        "家族と学ぶお金学習アプリ",
        "〜〜 ファミマネ 〜〜",
      ].join("\n"),
      html: buildAllowanceGrantedHtml({
        childName: grant.child_display_label,
        parentName: grant.granted_by_display_label,
        amount: amountFormatted,
        appUrl: siteUrl,
      }),
    }).catch(async (emailError: unknown) => {
      await adminClient.from("allowance_notification_logs").insert({
        family_id: grant.family_id,
        notification_type: "allowance_granted",
        recipient_email: grant.child_email,
        subject: "【ファミマネ】お小遣いが届きました",
        status: "failed",
        error_message: emailError instanceof Error ? emailError.message : "unknown error",
      });
    });
  }

  return NextResponse.json({ grant });
}

export async function POST(request: Request) {
  try {
    return await handlePost(request);
  } catch (error) {
    return jsonError(
      `お小遣いの作成に失敗しました: ${
        error instanceof Error ? error.message : "予期しないエラーが発生しました。"
      }`,
      500
    );
  }
}
