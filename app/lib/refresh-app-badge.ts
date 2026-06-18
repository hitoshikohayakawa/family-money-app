import { getBadgeCount } from "@/app/lib/badge-count";
import {
  isAppBadgeSupported,
  setAppBadgeCount,
  clearAppBadgeCount,
} from "@/app/lib/app-badge";

function isIos(): boolean {
  return (
    typeof navigator !== "undefined" &&
    /iPhone|iPad|iPod/.test(navigator.userAgent)
  );
}

function isStandalone(): boolean {
  try {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone ===
        true
    );
  } catch {
    return false;
  }
}

/**
 * 未読・未対応件数を集計し、PWA アイコンの数字バッジを更新する。
 * 0 件ならバッジを消す。未対応ブラウザや iOS 通常 Safari では何もしない。
 */
export async function refreshAppBadge(): Promise<void> {
  try {
    if (!isAppBadgeSupported()) return;
    // iOS はホーム画面追加済み（standalone 起動）のときだけ対象
    if (isIos() && !isStandalone()) return;

    const count = await getBadgeCount();
    if (count > 0) {
      await setAppBadgeCount(count);
    } else {
      await clearAppBadgeCount();
    }
  } catch {
    // バッジ更新の失敗でアプリ全体を壊さない
  }
}
