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
    await sendNotificationEmail({
      to: [grant.child_email],
      subject: "ファミマネ: お小遣いが届きました",
      text: [
        "ファミマネからのお知らせです。",
        "",
        `${grant.granted_by_display_label} さんから ${formatCurrency(
          grant.amount_jpy
        )} のお小遣いが届きました。`,
        "ログインして「すぐにもらう」か「投資する」を選んでください。",
      ].join("\n"),
    }).catch(async (emailError: unknown) => {
      await adminClient.from("allowance_notification_logs").insert({
        family_id: grant.family_id,
        notification_type: "allowance_granted",
        recipient_email: grant.child_email,
        subject: "ファミマネ: お小遣いが届きました",
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
