import { NextResponse } from "next/server";
import {
  createAuthenticatedServerClient,
  createServiceRoleServerClient,
  hasServerSupabaseEnv,
} from "@/lib/server-supabase";
import { sendPushToUsers } from "@/lib/push-notifications";

export const runtime = "nodejs";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// 子が「できた！」を押したとき: 完了報告RPCを呼び、成功後に保護者へプッシュ通知する。
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
  const { data: newStatus, error } = await userClient.rpc("submit_family_task_completion", {
    target_task_id: taskId,
  });

  if (error) {
    return jsonError(`完了の報告に失敗しました: ${error.message}`, 500);
  }

  // 成功後: 保護者へ通知（service role で関係者を取得）
  try {
    const admin = createServiceRoleServerClient();

    const { data: task } = await admin
      .from("family_tasks")
      .select("family_id, child_user_id, title")
      .eq("id", taskId)
      .single();

    if (task) {
      const [{ data: childProfile }, { data: guardians }] = await Promise.all([
        admin.from("profiles").select("display_name, email").eq("id", task.child_user_id).single(),
        admin
          .from("family_memberships")
          .select("user_id")
          .eq("family_id", task.family_id)
          .eq("status", "active")
          .in("role", ["guardian_admin", "guardian"]),
      ]);

      const childLabel =
        (childProfile?.display_name?.trim() || childProfile?.email || "お子さま") ?? "お子さま";
      const guardianIds = Array.isArray(guardians) ? guardians.map((g) => g.user_id) : [];

      if (guardianIds.length > 0) {
        const awaiting = newStatus === "submitted";
        await sendPushToUsers(guardianIds, {
          title: "ミラマネ",
          body: awaiting
            ? `${childLabel}さんが「${task.title}」を おわらせました。しょうにんしてね`
            : `${childLabel}さんが「${task.title}」を おわらせました`,
          url: "/tasks",
          type: "task_completed",
        });
      }
    }
  } catch {
    // 通知失敗は無視（操作自体は成功）
  }

  return NextResponse.json({ status: newStatus });
}
