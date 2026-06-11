"use client";

import { useState } from "react";
import usePushNotifications from "@/app/components/hooks/use-push-notifications";
import PwaGuideModal from "@/app/components/pwa-guide-modal";

export default function PushNotificationSettings() {
  const {
    isSupported,
    isStandalone,
    isIos,
    permission,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
    sendTestNotification,
  } = usePushNotifications();

  const [testMsg, setTestMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [pwaModalOpen, setPwaModalOpen] = useState(false);

  const handleSubscribe = async () => {
    try {
      await subscribe();
      setTestMsg(null);
    } catch (err: unknown) {
      setTestMsg({
        text: err instanceof Error ? err.message : "通知の許可に失敗しました",
        ok: false,
      });
    }
  };

  const handleUnsubscribe = async () => {
    await unsubscribe();
    setTestMsg(null);
  };

  const handleTest = async () => {
    setTestMsg(null);
    const result = await sendTestNotification();
    setTestMsg({
      text: result.ok
        ? "テスト通知を送信しました"
        : result.message ?? "送信に失敗しました",
      ok: result.ok,
    });
  };

  return (
    <section className="rounded-[28px] border border-[var(--border-soft)] bg-[var(--surface-card-strong)] p-5 shadow-[var(--shadow-card)]">
      <p className="text-lg font-extrabold text-[var(--text-primary)]">プッシュ通知</p>
      <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
        お小遣いや申請のお知らせを、スマホに通知できます。
        iPhoneの場合は、ミラマネをホーム画面に追加してから利用できます。
      </p>

      <div className="mt-4">
        {/* ── 非対応ブラウザ ── */}
        {!isSupported ? (
          <p className="rounded-[16px] bg-[var(--surface-accent)] px-4 py-3 text-sm text-[var(--text-secondary)]">
            このブラウザではプッシュ通知に対応していません。
          </p>
        ) : /* ── iOS かつスタンドアロンでない ── */
        isIos && !isStandalone ? (
          <div className="rounded-[16px] bg-[#FFF8E1] px-4 py-3">
            <p className="text-sm text-[#7B6014]">
              iPhoneで通知を使うには、ミラマネをホーム画面に追加してから開いてください。
            </p>
            <button
              type="button"
              className="mt-3 rounded-[14px] border border-[#E6C000] bg-white px-4 py-2 text-sm font-bold text-[#7B6014] transition hover:bg-[#FFFDE7]"
              onClick={() => setPwaModalOpen(true)}
            >
              アプリとして利用する
            </button>
          </div>
        ) : /* ── 通知拒否済み ── */
        permission === "denied" ? (
          <p className="rounded-[16px] bg-[var(--surface-accent)] px-4 py-3 text-sm text-[var(--text-secondary)]">
            通知がブロックされています。ブラウザの設定から通知を許可してください。
          </p>
        ) : /* ── 購読済み ── */
        isSubscribed ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#E8F5E9] text-xs text-[#4BAF57]">
                ✓
              </span>
              <p className="text-sm font-bold text-[var(--text-primary)]">通知は有効です</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-[14px] bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                disabled={isLoading}
                onClick={() => void handleTest()}
              >
                テスト通知を送る
              </button>
              <button
                type="button"
                className="rounded-[14px] border border-[var(--border-soft)] bg-white px-4 py-2.5 text-sm font-bold text-[var(--text-secondary)] transition hover:bg-[var(--surface-accent)] disabled:opacity-50"
                disabled={isLoading}
                onClick={() => void handleUnsubscribe()}
              >
                通知を停止する
              </button>
            </div>
          </div>
        ) : (
          /* ── 未購読 ── */
          <button
            type="button"
            className="rounded-[14px] bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
            disabled={isLoading}
            onClick={() => void handleSubscribe()}
          >
            {isLoading ? "処理中..." : "通知を許可する"}
          </button>
        )}

        {testMsg ? (
          <p
            className={`mt-3 text-sm font-semibold ${testMsg.ok ? "text-[#4BAF57]" : "text-red-500"}`}
          >
            {testMsg.text}
          </p>
        ) : null}
      </div>

      <PwaGuideModal open={pwaModalOpen} onClose={() => setPwaModalOpen(false)} />
    </section>
  );
}
