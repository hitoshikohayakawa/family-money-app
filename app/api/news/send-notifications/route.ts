import { NextResponse } from "next/server";
import { createServiceRoleServerClient, hasServerSupabaseEnv } from "@/lib/server-supabase";
import { sendPushToUsers } from "@/lib/push-notifications";

export const runtime = "nodejs";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

type PublishedArticle = {
  id: string;
  title: string;
  published_at: string | null;
};

// GitHub Actions cron から x-cron-secret 付きで叩かれる想定。
// status=published かつ push_notified_at が未設定の記事を新着とみなし、
// 通知ON（push購読済み）の全ユーザーへ1通だけ送って push_notified_at を記録する。
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

  // 公開済みで未通知の記事（古い順）
  const { data: articlesRaw, error } = await admin
    .from("news_articles")
    .select("id, title, published_at")
    .eq("status", "published")
    .is("push_notified_at", null)
    .order("published_at", { ascending: true });

  if (error) {
    return jsonError(`未通知ニュースの取得に失敗しました: ${error.message}`, 500);
  }

  const articles = (articlesRaw ?? []) as PublishedArticle[];
  if (articles.length === 0) {
    return NextResponse.json({ notifiedArticles: 0, usersNotified: 0 });
  }

  // 通知ON（push購読済み）の全ユーザー（重複排除）
  const { data: subsRaw, error: subsError } = await admin
    .from("push_subscriptions")
    .select("user_id")
    .eq("enabled", true);

  if (subsError) {
    return jsonError(`購読者の取得に失敗しました: ${subsError.message}`, 500);
  }

  const userIds = Array.from(
    new Set((subsRaw ?? []).map((row) => row.user_id as string))
  );

  if (userIds.length > 0) {
    // 記事タイトルは長くなりがちなので固定文で通知する。
    // 遷移先は1件ならその記事、複数まとめてなら一覧。
    const url = articles.length === 1 ? `/news/${articles[0].id}` : "/news";

    await sendPushToUsers(userIds, {
      title: "【新着ニュース】",
      body: "新しいニュースがはっしんされたよ！",
      url,
      type: "news_published",
    });
  }

  // 通知済みとして記録（購読者が0でも再評価を止めるため必ず更新する）
  const ids = articles.map((article) => article.id);
  const { error: updateError } = await admin
    .from("news_articles")
    .update({ push_notified_at: new Date().toISOString() })
    .in("id", ids);

  if (updateError) {
    return jsonError(`push_notified_at の更新に失敗しました: ${updateError.message}`, 500);
  }

  return NextResponse.json({
    notifiedArticles: articles.length,
    usersNotified: userIds.length,
  });
}
