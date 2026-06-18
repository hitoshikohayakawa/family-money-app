"use client";

import { useState } from "react";
import usePushNotifications from "@/app/components/hooks/use-push-notifications";

export const PUSH_PROMPT_KEY = "miramane_push_permission_prompt_shown";

/**
 * 通知許可案内モーダルを自動表示してよいかを同期的に判定する。
 * permission === "default" のときのみ true になり得る（= 未購読が確定するため
 * isSubscribed の非同期判定を待たずに重複表示を防げる）。
 *
 * - Android: Push対応ブラウザなら standalone 問わず表示
 * - iOS: standalone 起動時のみ表示（通常Safariでは Web Push 不可のため出さない）
 */
export function shouldShowPushPrompt(): boolean {
  try {
    if (typeof window === "undefined" || typeof navigator === "undefined") {
      return false;
    }
    const supported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    if (!supported) return false;
    if (Notification.permission !== "default") return false;
    if (localStorage.getItem(PUSH_PROMPT_KEY) !== null) return false;

    const ua = navigator.userAgent;
    const isIos = /iPhone|iPad|iPod/.test(ua);
    const isAndroid = /Android/.test(ua);
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    if (isAndroid) return true;
    if (isIos && isStandalone) return true;
    return false;
  } catch {
    return false;
  }
}

export function markPushPromptShown(): void {
  try {
    localStorage.setItem(PUSH_PROMPT_KEY, "true");
  } catch {
    // ignore
  }
}

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function PushPermissionPromptModal({ open, onClose }: Props) {
  const { subscribe, isLoading } = usePushNotifications();
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  // ボタン押下（ユーザー操作）に紐づけて Notification.requestPermission() を呼ぶ。
  const handleAllow = async () => {
    setError(null);
    try {
      await subscribe();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "通知の許可に失敗しました");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[400px] rounded-[24px] bg-white p-6 shadow-[0_24px_60px_rgba(31,45,32,0.28)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#E8F5E9]">
            <svg
              viewBox="0 0 24 24"
              className="h-7 w-7 text-[#4BAF57]"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </span>

          <h2 className="mt-4 text-lg font-extrabold text-[#1F2D20]">
            通知を許可しましょう
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#516251]">
            通知を許可いただけると、お小遣いの払い出しやニュースの配信など、大切なお知らせの見逃しを防げます。
          </p>
        </div>

        {error ? (
          <p className="mt-4 rounded-[14px] bg-[#FDECEC] px-4 py-3 text-center text-sm font-semibold text-[#C0392B]">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            className="rounded-[14px] bg-[var(--brand-primary)] px-4 py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
            disabled={isLoading}
            onClick={() => void handleAllow()}
          >
            {isLoading ? "処理中..." : "通知を許可する"}
          </button>
          <button
            type="button"
            className="rounded-[14px] border border-[var(--border-soft)] bg-white px-4 py-3 text-sm font-bold text-[var(--text-secondary)] transition hover:bg-[var(--surface-accent)] disabled:opacity-50"
            disabled={isLoading}
            onClick={onClose}
          >
            あとで
          </button>
        </div>
      </div>
    </div>
  );
}
