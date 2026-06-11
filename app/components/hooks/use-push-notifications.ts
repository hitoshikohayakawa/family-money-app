"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getSafeSession } from "@/lib/client-auth";

type Permission = "default" | "granted" | "denied";

type UsePushNotificationsReturn = {
  isSupported: boolean;
  isStandalone: boolean;
  isIos: boolean;
  permission: Permission;
  isSubscribed: boolean;
  isLoading: boolean;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
  sendTestNotification: () => Promise<{ ok: boolean; message?: string }>;
};

async function getAuthHeader(): Promise<string | null> {
  const { data: { session } } = await getSafeSession(supabase);
  return session?.access_token ? `Bearer ${session.access_token}` : null;
}

export default function usePushNotifications(): UsePushNotificationsReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [permission, setPermission] = useState<Permission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentSubscription, setCurrentSubscription] =
    useState<PushSubscription | null>(null);

  useEffect(() => {
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    const supported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;

    setIsIos(ios);
    setIsStandalone(standalone);
    setIsSupported(supported);

    if (supported) {
      setPermission(Notification.permission as Permission);
    }

    // 既存 subscription 確認
    if (supported) {
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => {
          setCurrentSubscription(sub);
          setIsSubscribed(!!sub);
        })
        .catch(() => {});
    }
  }, []);

  const registerServiceWorker = useCallback(async () => {
    const reg = await navigator.serviceWorker.register("/sw.js");
    // activate を待つ
    await navigator.serviceWorker.ready;
    return reg;
  }, []);

  const subscribe = useCallback(async () => {
    if (!isSupported) throw new Error("Push not supported");

    // iOS はスタンドアロンのみ許可
    if (isIos && !isStandalone) {
      throw new Error("iOSではホーム画面から起動してください");
    }

    setIsLoading(true);
    try {
      const reg = await registerServiceWorker();

      const permission = await Notification.requestPermission();
      setPermission(permission as Permission);
      if (permission !== "granted") throw new Error("通知が許可されませんでした");

      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) throw new Error("VAPID public key is not configured");

      // base64url → Uint8Array 変換
      const keyBytes = urlBase64ToUint8Array(vapidPublicKey);

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes.buffer as ArrayBuffer,
      });

      setCurrentSubscription(sub);
      setIsSubscribed(true);

      // サーバーへ保存
      const authHeader = await getAuthHeader();
      if (!authHeader) throw new Error("ログインが必要です");

      const platform = isIos ? "ios" : /Android/.test(navigator.userAgent) ? "android" : "web";
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: authHeader },
        body: JSON.stringify({
          subscription: sub.toJSON(),
          userAgent: navigator.userAgent,
          platform,
        }),
      });

      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "unknown" }));
        throw new Error(error ?? "subscription の保存に失敗しました");
      }
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, isIos, isStandalone, registerServiceWorker]);

  const unsubscribe = useCallback(async () => {
    if (!currentSubscription) return;

    setIsLoading(true);
    try {
      const endpoint = currentSubscription.endpoint;

      await currentSubscription.unsubscribe();
      setCurrentSubscription(null);
      setIsSubscribed(false);

      const authHeader = await getAuthHeader();
      if (!authHeader) return;

      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: authHeader },
        body: JSON.stringify({ endpoint }),
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentSubscription]);

  const sendTestNotification = useCallback(async (): Promise<{
    ok: boolean;
    message?: string;
  }> => {
    const authHeader = await getAuthHeader();
    if (!authHeader) return { ok: false, message: "ログインが必要です" };

    const res = await fetch("/api/push/test", {
      method: "POST",
      headers: { Authorization: authHeader },
    });

    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, message: data.message ?? data.error };
  }, []);

  return {
    isSupported,
    isStandalone,
    isIos,
    permission,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
    sendTestNotification,
  };
}

// VAPID public key (base64url) → Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}
