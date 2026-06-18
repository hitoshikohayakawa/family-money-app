// PWA アプリアイコンの数字バッジ（Badging API）ユーティリティ。
// 未対応ブラウザでは何もせず、エラーも投げない（graceful degradation）。

// navigator.setAppBadge / clearAppBadge は標準 DOM 型にまだ含まれないため拡張する。
type AppBadgeNavigator = Navigator & {
  setAppBadge?: (contents?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

export function isAppBadgeSupported(): boolean {
  if (typeof navigator === "undefined") return false;
  return "setAppBadge" in navigator && "clearAppBadge" in navigator;
}

export async function setAppBadgeCount(count: number): Promise<void> {
  if (typeof navigator === "undefined") return;
  const nav = navigator as AppBadgeNavigator;
  if (typeof nav.setAppBadge !== "function") return;
  try {
    await nav.setAppBadge(Math.max(0, Math.floor(count)));
  } catch {
    // 未対応・権限なし等は無視
  }
}

export async function clearAppBadgeCount(): Promise<void> {
  if (typeof navigator === "undefined") return;
  const nav = navigator as AppBadgeNavigator;
  if (typeof nav.clearAppBadge !== "function") return;
  try {
    await nav.clearAppBadge();
  } catch {
    // 未対応・権限なし等は無視
  }
}
