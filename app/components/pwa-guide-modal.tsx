"use client";

import Image from "next/image";

export function detectPwaPlatform(): "ios" | "android" | null {
  if (typeof navigator === "undefined") return null;
  if (/iPhone|iPad|iPod/.test(navigator.userAgent)) return "ios";
  if (/Android/.test(navigator.userAgent)) return "android";
  return null;
}

const PWA_MODAL_KEY = "miramane_pwa_modal_shown";

export function shouldShowPwaModal(): boolean {
  try {
    return (
      detectPwaPlatform() !== null &&
      localStorage.getItem(PWA_MODAL_KEY) === null
    );
  } catch {
    return false;
  }
}

export function markPwaModalShown(): void {
  try {
    localStorage.setItem(PWA_MODAL_KEY, "true");
  } catch {
    // ignore
  }
}

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function PwaGuideModal({ open, onClose }: Props) {
  if (!open) return null;

  const platform = detectPwaPlatform();
  if (!platform) return null;

  const imageSrc =
    platform === "ios"
      ? "/images/ios_home.png"
      : "/images/android_home.png";

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        className="relative mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 閉じるボタン */}
        <button
          type="button"
          aria-label="閉じる"
          className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-sm text-white"
          onClick={onClose}
        >
          ✕
        </button>

        <Image
          src={imageSrc}
          alt="ホーム画面追加案内"
          fill={false}
          width={1024}
          height={1536}
          style={{
            width: "auto",
            height: "auto",
            maxWidth: "min(85vw, 400px)",
            maxHeight: "80vh",
            borderRadius: "12px",
            display: "block",
          }}
          priority
        />
      </div>
    </div>
  );
}
