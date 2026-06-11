import webpush from "web-push";
import { createServiceRoleServerClient } from "@/lib/server-supabase";

// 将来的な通知種別
export type PushNotificationType =
  | "allowance_granted"
  | "cashout_requested"
  | "cashout_approved"
  | "cashout_completed"
  | "news_published"
  | "task_reminder"
  | "task_completed"
  | "system";

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  type?: PushNotificationType;
};

let vapidInitialized = false;

function ensureVapidInit() {
  if (vapidInitialized) return;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:info@miramane.jp";

  if (!publicKey || !privateKey) {
    throw new Error(
      "VAPID keys are not configured. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY."
    );
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidInitialized = true;
}

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  subscription: webpush.PushSubscription;
};

async function fetchSubscriptions(userId: string): Promise<PushSubscriptionRow[]> {
  const client = createServiceRoleServerClient();
  const { data, error } = await client
    .from("push_subscriptions")
    .select("id, endpoint, subscription")
    .eq("user_id", userId)
    .eq("enabled", true);

  if (error) throw new Error(`Failed to fetch push subscriptions: ${error.message}`);
  return (data ?? []) as PushSubscriptionRow[];
}

async function removeSubscription(endpoint: string) {
  const client = createServiceRoleServerClient();
  await client
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint);
}

async function updateLastUsed(endpoint: string) {
  const client = createServiceRoleServerClient();
  await client
    .from("push_subscriptions")
    .update({ last_used_at: new Date().toISOString() })
    .eq("endpoint", endpoint);
}

/**
 * 単一 user_id に紐づく全 subscription へ Push 送信。
 * 410/404 の失効 subscription は自動削除する。
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  ensureVapidInit();

  const subscriptions = await fetchSubscriptions(userId);
  if (subscriptions.length === 0) return { sent: 0, failed: 0 };

  const results = await Promise.allSettled(
    subscriptions.map(async (row) => {
      try {
        await webpush.sendNotification(
          row.subscription,
          JSON.stringify(payload)
        );
        await updateLastUsed(row.endpoint);
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 410 || status === 404) {
          // 失効 subscription を削除
          await removeSubscription(row.endpoint);
        }
        throw err;
      }
    })
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;
  return { sent, failed };
}

/**
 * 複数 user_id へ一括送信。
 */
export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload
): Promise<void> {
  await Promise.allSettled(
    userIds.map((uid) => sendPushToUser(uid, payload))
  );
}

/**
 * 指定ユーザーへテスト通知を送る（本人確認済みの前提で呼ぶ）。
 */
export async function sendTestPushToCurrentUser(userId: string) {
  return sendPushToUser(userId, {
    title: "ミラマネ通知テスト",
    body: "通知が届くようになりました",
    url: "/",
    type: "system",
  });
}
