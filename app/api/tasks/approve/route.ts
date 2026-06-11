import { NextResponse } from "next/server";
import {
  createAuthenticatedServerClient,
  createServiceRoleServerClient,
  hasServerSupabaseEnv,
} from "@/lib/server-supabase";
import { sendPushToUser } from "@/lib/push-notifications";

export const runtime = "nodejs";

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

// 保護者が承認したとき: 承認RPCを呼び、成功後に子へプッシュ通知する。
// 通知の失敗は操作の成功を妨げない（プッシュは付随処理）。
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

  const taskId =
    typeof body === "object" && body !== null && "taskId" in body ? String(body.taskId) : "";
  if (!taskId) {
    return jsonError("やることIDが指定されていません。");
  }

  const userClient = createAuthenticatedServerClient(authorization);
  const { data: rewardGrantId, error } = await userClient.rpc("approve_family_task", {
    target_task_id: taskId,
  });

  if (error) {
    return jsonError(`承認に失敗しました: ${error.message}`, 500);
  }

  // 成功後: 子へ通知（service role でタスク情報を取得）
  try {
    const admin = createServiceRoleServerClient();

    const { data: task } = await admin
      .from("family_tasks")
      .select("child_user_id, title, reward_amount_jpy")
      .eq("id", taskId)
      .single();

    if (task?.child_user_id) {
      const hasReward =
        typeof task.reward_amount_jpy === "number" && task.reward_amount_jpy > 0;
      await sendPushToUser(task.child_user_id, {
        title: "ミラマネ",
        body: hasReward
          ? `「${task.title}」が しょうにんされました！${formatCurrency(task.reward_amount_jpy)} が お小遣いに ふえたよ`
          : `「${task.title}」が しょうにんされました！`,
        url: "/allowance",
        type: "task_completed",
      });
    }
  } catch {
    // 通知失敗は無視（操作自体は成功）
  }

  return NextResponse.json({ rewardGrantId: rewardGrantId ?? null });
}
