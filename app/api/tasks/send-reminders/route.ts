import { NextResponse } from "next/server";
import { createServiceRoleServerClient, hasServerSupabaseEnv } from "@/lib/server-supabase";
import { sendPushToUser } from "@/lib/push-notifications";

export const runtime = "nodejs";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// JST(UTC+9) の当日0時・翌日0時を UTC の Date で返す
function jstDayBoundaries(now: Date) {
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const startOfToday = new Date(
    Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate(), 0, 0, 0) -
      9 * 60 * 60 * 1000
  );
  const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
  return { startOfToday, startOfTomorrow };
}

type ReminderTask = {
  id: string;
  child_user_id: string;
  title: string;
  due_at: string;
};

// GitHub Actions cron から x-cron-secret 付きで叩かれる想定。
// 期限が今日以前・未完了(open)・本日未リマインドのタスクを抽出し、子へプッシュする。
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return jsonError("CRON_SECRET is not configured.", 500);
  }
  if (request.headers.get("x-cron-secret") !== secret) {
    return jsonError("Unauthorized", 401);
  }
  if (!hasServerSupabaseEnv()) {
    return jsonError("Supabase のサーバー環境変数が不足しています。", 500);
  }

  const admin = createServiceRoleServerClient();
  const now = new Date();
  const { startOfToday, startOfTomorrow } = jstDayBoundaries(now);
  const dueCutoffIso = startOfTomorrow.toISOString(); // due_at < 翌日0時 = 今日以前
  const remindedCutoffIso = startOfToday.toISOString(); // reminded_at < 当日0時 or null

  const { data: tasksRaw, error } = await admin
    .from("family_tasks")
    .select("id, child_user_id, title, due_at")
    .eq("status", "open")
    .not("due_at", "is", null)
    .lt("due_at", dueCutoffIso)
    .or(`reminded_at.is.null,reminded_at.lt.${remindedCutoffIso}`);

  if (error) {
    return jsonError(`リマインド対象の取得に失敗しました: ${error.message}`, 500);
  }

  const tasks = (tasksRaw ?? []) as ReminderTask[];
  if (tasks.length === 0) {
    return NextResponse.json({ remindedTasks: 0, childrenNotified: 0 });
  }

  // 子どもごとにまとめて1通だけ送る（複数件は件数で要約）
  const byChild = new Map<string, ReminderTask[]>();
  for (const task of tasks) {
    const list = byChild.get(task.child_user_id) ?? [];
    list.push(task);
    byChild.set(task.child_user_id, list);
  }

  let childrenNotified = 0;
  await Promise.all(
    Array.from(byChild.entries()).map(async ([childId, childTasks]) => {
      const overdue = childTasks.some((t) => new Date(t.due_at) < startOfToday);
      const body =
        childTasks.length === 1
          ? overdue
            ? `「${childTasks[0].title}」の きげんが すぎているよ`
            : `きょうの やること「${childTasks[0].title}」があるよ`
          : `きょうの やることが ${childTasks.length}こ あるよ！`;

      try {
        await sendPushToUser(childId, {
          title: "ミラマネ",
          body,
          url: "/",
          type: "task_reminder",
        });
        childrenNotified += 1;
      } catch {
        // プッシュ失敗は無視（reminded_at は更新して当日の再送は止める）
      }
    })
  );

  // 本日リマインド済みとして記録（1日1回に制限）
  const remindedIds = tasks.map((t) => t.id);
  const { error: updateError } = await admin
    .from("family_tasks")
    .update({ reminded_at: now.toISOString() })
    .in("id", remindedIds);

  if (updateError) {
    return jsonError(`reminded_at の更新に失敗しました: ${updateError.message}`, 500);
  }

  return NextResponse.json({
    remindedTasks: tasks.length,
    childrenNotified,
  });
}
