import { NextResponse } from "next/server";
import {
  createServiceRoleServerClient,
  hasServerSupabaseEnv,
} from "@/lib/server-supabase";

export const runtime = "nodejs";
// アップデート情報は頻繁には変わらないため短時間キャッシュ
export const revalidate = 0;

type PublicAnnouncement = {
  id: string;
  title: string;
  body: string;
  published_at: string;
};

// 公開LP向け: app_announcements の RLS は authenticated 限定のため、
// service role で読み取り、匿名訪問者にも見せられる安全な項目だけ返す。
// 新規テーブル・新規カラムは作成しない。
export async function GET() {
  if (!hasServerSupabaseEnv()) {
    // 環境変数が無い場合はセクションを静かに非表示にする
    return NextResponse.json({ announcements: [] as PublicAnnouncement[] });
  }

  try {
    const client = createServiceRoleServerClient();
    const nowIso = new Date().toISOString();

    const { data, error } = await client
      .from("app_announcements")
      .select("id, title, body, published_at")
      // 公開ページなので全員向けのお知らせのみ表示する
      .eq("active", true)
      .eq("visible_to", "all")
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .order("published_at", { ascending: false })
      .limit(3);

    if (error) {
      return NextResponse.json({ announcements: [] as PublicAnnouncement[] });
    }

    return NextResponse.json({
      announcements: (data ?? []) as PublicAnnouncement[],
    });
  } catch {
    return NextResponse.json({ announcements: [] as PublicAnnouncement[] });
  }
}
