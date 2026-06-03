"use client";

import { useEffect, useRef, useState } from "react";
import { getSafeSession } from "@/lib/client-auth";
import { supabase } from "@/lib/supabase";
import { FAMILY_UPDATED_EVENT } from "@/lib/family-events";
import MemberAvatar from "@/app/components/ui/member-avatar";
import SecondaryButton from "@/app/components/ui/secondary-button";

const EMOJI_OPTIONS = [
  "👸", "🤴", "👼", "🎅", "🤶", "🧙", "🦸", "🦹", "💂", "👮",
  "😊", "😄", "🥰", "😎", "😇", "🤗", "😋", "🥳", "🤩", "😆",
  "🐶", "🐱", "🐰", "🐻", "🦁", "⭐", "🌟", "🌈", "🎀", "👑",
];

type MyProfile = {
  userId: string;
  familyId: string;
  displayName: string;
  avatarPath: string | null;
  avatarEmoji: string | null;
  displayLabel: string;
};

export default function ChildSettingsPanel() {
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [savingEmoji, setSavingEmoji] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  // Increment to force MemberAvatar to re-mount and re-fetch signed URL after save
  const [avatarKey, setAvatarKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadProfile = async (isActive: { current: boolean }) => {
    const {
      data: { session },
      error: sessionError,
    } = await getSafeSession(supabase);

    if (!isActive.current) return;

    if (sessionError || !session?.user) {
      setLoading(false);
      return;
    }

    const userId = session.user.id;

    const [{ data: membership }, { data: prof }] = await Promise.all([
      supabase
        .from("family_memberships")
        .select("family_id, avatar_path, avatar_emoji")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("display_name")
        .eq("id", userId)
        .maybeSingle(),
    ]);

    if (!isActive.current) return;

    const displayName =
      typeof prof?.display_name === "string" ? prof.display_name.trim() : "";
    const displayLabel =
      displayName || (session.user.email?.split("@")[0] ?? "?");

    setProfile({
      userId,
      familyId: membership?.family_id ?? "",
      displayName,
      avatarPath: membership?.avatar_path ?? null,
      avatarEmoji: membership?.avatar_emoji ?? null,
      displayLabel,
    });
    setLoading(false);
  };

  useEffect(() => {
    const isActive = { current: true };

    void loadProfile(isActive);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void loadProfile(isActive);
    });

    const onFamilyUpdated = () => void loadProfile(isActive);
    window.addEventListener(FAMILY_UPDATED_EVENT, onFamilyUpdated);

    return () => {
      isActive.current = false;
      subscription.unsubscribe();
      window.removeEventListener(FAMILY_UPDATED_EVENT, onFamilyUpdated);
    };
  }, []);

  const getToken = async (): Promise<string | null> => {
    const {
      data: { session },
      error,
    } = await getSafeSession(supabase);
    if (error || !session?.access_token) return null;
    return session.access_token;
  };

  const handleSaveEmoji = async (emoji: string) => {
    if (!profile) return;
    const token = await getToken();
    if (!token) {
      setError("ログイン状態の確認に失敗しました。");
      return;
    }

    setSavingEmoji(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/family-members/${profile.userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ avatarEmoji: emoji }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "アイコンの保存に失敗しました。");
        return;
      }

      setProfile((prev) =>
        prev ? { ...prev, avatarEmoji: emoji, avatarPath: null } : prev
      );
      setAvatarKey((k) => k + 1);
      setSuccess("アイコンを保存しました。");
      setShowEmojiPicker(false);
      window.dispatchEvent(new Event(FAMILY_UPDATED_EVENT));
    } finally {
      setSavingEmoji(false);
    }
  };

  const handleUploadPhoto = async (file: File) => {
    if (!profile) return;
    const token = await getToken();
    if (!token) {
      setError("ログイン状態の確認に失敗しました。");
      return;
    }

    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      setError("jpeg / png / webp 形式の画像を選んでください。");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("ファイルサイズは5MB以下にしてください。");
      return;
    }

    setUploading(true);
    setError("");
    setSuccess("");

    try {
      const ext =
        file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const path = `family-members/${profile.familyId}/${profile.userId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("family-member-avatars")
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) {
        setError(`写真のアップロードに失敗しました: ${uploadError.message}`);
        return;
      }

      const res = await fetch(`/api/family-members/${profile.userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ avatarPath: path }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "写真の保存に失敗しました。");
        return;
      }

      setProfile((prev) =>
        prev ? { ...prev, avatarPath: path, avatarEmoji: null } : prev
      );
      setAvatarKey((k) => k + 1);
      setSuccess("写真を保存しました。");
      window.dispatchEvent(new Event(FAMILY_UPDATED_EVENT));
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <p className="py-10 text-center text-sm text-[var(--text-secondary)]">
        読み込み中...
      </p>
    );
  }

  if (!profile) {
    return (
      <p className="py-10 text-center text-sm text-[var(--danger)]">
        ログイン情報の取得に失敗しました。
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {/* Icon card */}
      <section className="rounded-[28px] border border-[var(--border-soft)] bg-[var(--surface-card-strong)] p-5 shadow-[var(--shadow-card)]">
        <p className="text-lg font-extrabold text-[var(--text-primary)]">アイコン</p>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          絵文字アイコンか写真を選べます。
        </p>

        {success ? (
          <p className="mt-3 text-sm font-semibold text-[var(--success)]">{success}</p>
        ) : null}
        {error ? (
          <p className="mt-3 text-sm font-semibold text-[var(--danger)]">{error}</p>
        ) : null}

        <div className="mt-5 flex flex-col items-center gap-5">
          {/* Current avatar — large display */}
          <div className="rounded-[26px] ring-2 ring-[#F8A9A0]">
            <MemberAvatar
              key={avatarKey}
              avatarPath={profile.avatarPath}
              avatarEmoji={profile.avatarEmoji}
              displayLabel={profile.displayLabel}
              fallbackBgClass="bg-[#FDE8E4]"
              size="lg"
              className="h-24 w-24 rounded-[24px] text-5xl"
            />
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            <SecondaryButton
              type="button"
              size="sm"
              onClick={() => {
                setShowEmojiPicker((v) => !v);
                setError("");
                setSuccess("");
              }}
            >
              {showEmojiPicker ? "閉じる" : "絵文字を選ぶ"}
            </SecondaryButton>
            <SecondaryButton
              type="button"
              size="sm"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? "アップロード中..." : "写真をアップロード"}
            </SecondaryButton>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleUploadPhoto(file);
              e.target.value = "";
            }}
          />
        </div>

        {/* Emoji picker */}
        {showEmojiPicker ? (
          <div className="mt-5">
            <p className="mb-3 text-sm font-semibold text-[var(--text-secondary)]">
              絵文字を選んでください
            </p>
            <div className="grid grid-cols-6 gap-2 sm:grid-cols-10">
              {EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  disabled={savingEmoji}
                  className="flex h-11 w-full items-center justify-center rounded-[12px] border border-[var(--border-soft)] bg-white text-2xl transition hover:bg-[var(--surface-accent)] disabled:opacity-50"
                  onClick={() => void handleSaveEmoji(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {/* Name card (read-only) */}
      <section className="rounded-[28px] border border-[var(--border-soft)] bg-[var(--surface-card-strong)] p-5 shadow-[var(--shadow-card)]">
        <p className="text-lg font-extrabold text-[var(--text-primary)]">名前</p>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          名前の変更はパパ・ママにお願いしてください。
        </p>
        <div className="mt-4 rounded-[18px] bg-[var(--surface-accent)] px-4 py-3">
          <p className="text-sm font-bold text-[var(--text-primary)]">
            {profile.displayName !== "" ? (
              profile.displayName
            ) : (
              <span className="text-[var(--text-muted)]">（未設定）</span>
            )}
          </p>
        </div>
      </section>

      {/* Spacer for footer nav */}
      <div className="h-16" />
    </div>
  );
}
