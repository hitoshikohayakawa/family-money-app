import { supabase } from "@/lib/supabase";
import { getSafeSession } from "@/lib/client-auth";

// ヘッダーのベル通知と同じデータ源から「未読・未対応件数」を集計する。
//   - 未読のお知らせ（app_announcements、ロール別表示 ＋ localStorage 既読を除外）
//   - 未対応の払い出し申請（保護者宛て requested）
//   - 未決定のお小遣い（保護者: 家族内の pending / 子ども: 自分宛て pending）
// 取得に失敗した場合は 0 を返す（アプリ全体を壊さない）。

type BadgeGrantRow = {
  child_user_id: string;
  granted_by_user_id: string;
  decision_status: string;
  cashout_status: string | null;
};

type BadgeAnnouncement = {
  id: string;
  visible_to: string;
};

function readReadAnnouncementIds(): Set<string> {
  try {
    const stored = localStorage.getItem("miramane_read_announcements");
    if (stored) return new Set(JSON.parse(stored) as string[]);
  } catch {
    // ignore
  }
  return new Set();
}

export async function getBadgeCount(): Promise<number> {
  try {
    const {
      data: { session },
    } = await getSafeSession(supabase);
    if (!session?.user) return 0;
    const userId = session.user.id;

    const [{ data: membership }, { data: grantsRaw }, { data: announcementsRaw }] =
      await Promise.all([
        supabase
          .from("family_memberships")
          .select("role")
          .eq("status", "active")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase.rpc("list_allowance_grants_for_current_user"),
        supabase.from("app_announcements").select("id, visible_to"),
      ]);

    const role = typeof membership?.role === "string" ? membership.role : null;
    const isGuardian = role === "guardian_admin" || role === "guardian";
    const isChild = role === "child";

    // 未読お知らせ
    const roleForFilter = isGuardian ? "guardian" : isChild ? "child" : null;
    const announcements = Array.isArray(announcementsRaw)
      ? (announcementsRaw as BadgeAnnouncement[])
      : [];
    const readIds = readReadAnnouncementIds();
    const unreadAnnouncements = announcements.filter(
      (a) =>
        (a.visible_to === "all" || a.visible_to === roleForFilter) &&
        !readIds.has(a.id)
    ).length;

    // 未対応のお小遣い・払い出し
    const grants = Array.isArray(grantsRaw) ? (grantsRaw as BadgeGrantRow[]) : [];
    const activeGrants = grants.filter((g) => !g.cashout_status);

    const pendingCashouts = isGuardian
      ? grants.filter(
          (g) =>
            g.cashout_status === "requested" && g.granted_by_user_id === userId
        ).length
      : 0;

    const pendingDecisions = isGuardian
      ? activeGrants.filter((g) => g.decision_status === "pending").length
      : isChild
        ? activeGrants.filter(
            (g) =>
              g.decision_status === "pending" && g.child_user_id === userId
          ).length
        : 0;

    return unreadAnnouncements + pendingCashouts + pendingDecisions;
  } catch {
    return 0;
  }
}
