"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { getSafeSession } from "@/lib/client-auth";
import { supabase } from "@/lib/supabase";
import { FAMILY_UPDATED_EVENT } from "@/lib/family-events";
import EmptyState from "@/app/components/ui/empty-state";
import MemberAvatar from "@/app/components/ui/member-avatar";
import PrimaryButton from "@/app/components/ui/primary-button";
import SecondaryButton from "@/app/components/ui/secondary-button";
import SectionCard from "@/app/components/ui/section-card";
import StatusBadge from "@/app/components/ui/status-badge";
import { familyRoleTone, formatFamilyRole } from "@/app/components/ui/family-labels";

const EMOJI_OPTIONS = [
  "👸","🤴","👼","🎅","🤶","🧙","🦸","🦹","💂","👮",
  "😊","😄","🥰","😎","😇","🤗","😋","🥳","🤩","😆",
  "🐶","🐱","🐰","🐻","🦁","⭐","🌟","🌈","🎀","👑",
];

type FamilyMember = {
  family_id: string;
  user_id: string;
  role: string;
  email: string | null;
  display_name: string | null;
  display_label: string;
  avatar_path: string | null;
  avatar_emoji: string | null;
};

type FamilyMembersState = {
  loading: boolean;
  savingUserId: string | null;
  error: string;
  successMessage: string;
  members: FamilyMember[];
};

export default function FamilyMembersList() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [editingNameMember, setEditingNameMember] = useState<FamilyMember | null>(null);
  const [draftDisplayNames, setDraftDisplayNames] = useState<Record<string, string>>({});
  const [emojiPickerUserId, setEmojiPickerUserId] = useState<string | null>(null);
  const [savingAvatarUserId, setSavingAvatarUserId] = useState<string | null>(null);
  const [uploadingUserId, setUploadingUserId] = useState<string | null>(null);
  const [menuOpenUserId, setMenuOpenUserId] = useState<string | null>(null);
  const [deleteConfirmMember, setDeleteConfirmMember] = useState<FamilyMember | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [state, setState] = useState<FamilyMembersState>({
    loading: true,
    savingUserId: null,
    error: "",
    successMessage: "",
    members: [],
  });

  useEffect(() => {
    let isActive = true;

    const loadMembers = async () => {
      const {
        data: { session },
        error: sessionError,
      } = await getSafeSession(supabase);

      if (!isActive) return;

      if (sessionError) {
        setCurrentUserId(null);
        setCurrentUserRole(null);
        setState({ loading: false, savingUserId: null, error: "ログイン状態の確認に失敗しました。", successMessage: "", members: [] });
        return;
      }

      if (!session?.user) {
        setCurrentUserId(null);
        setCurrentUserRole(null);
        setState({ loading: false, savingUserId: null, error: "", successMessage: "", members: [] });
        return;
      }

      setCurrentUserId(session.user.id);

      const { data: membership } = await supabase
        .from("family_memberships")
        .select("role")
        .eq("status", "active")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!isActive) return;

      setCurrentUserRole(typeof membership?.role === "string" ? membership.role : null);

      const { data, error } = await supabase.rpc("list_family_members_for_current_user");

      if (!isActive) return;

      if (error) {
        setState({ loading: false, savingUserId: null, error: `家族メンバー一覧の取得に失敗しました: ${error.message}`, successMessage: "", members: [] });
        return;
      }

      const members = Array.isArray(data) ? (data as FamilyMember[]) : [];

      setDraftDisplayNames((current) => {
        const next = { ...current };
        for (const member of members) {
          next[member.user_id] = member.display_name ?? "";
        }
        return next;
      });

      setState({ loading: false, savingUserId: null, error: "", successMessage: "", members });
    };

    void loadMembers();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => void loadMembers());

    const handleFamilyUpdated = () => void loadMembers();
    window.addEventListener(FAMILY_UPDATED_EVENT, handleFamilyUpdated);

    return () => {
      isActive = false;
      subscription.unsubscribe();
      window.removeEventListener(FAMILY_UPDATED_EVENT, handleFamilyUpdated);
    };
  }, []);

  // Close ... menu on outside click
  useEffect(() => {
    if (!menuOpenUserId) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenUserId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpenUserId]);

  const canEditChildNames = currentUserRole === "guardian_admin" || currentUserRole === "guardian";

  const getToken = async () => {
    const { data: { session }, error } = await getSafeSession(supabase);
    if (error || !session?.access_token) return null;
    return session.access_token;
  };

  const handleSaveDisplayName = async (event: FormEvent<HTMLFormElement>, member: FamilyMember) => {
    event.preventDefault();
    const draftName = draftDisplayNames[member.user_id] ?? "";
    const token = await getToken();
    if (!token) {
      setState((s) => ({ ...s, error: "ログイン状態の確認に失敗しました。", successMessage: "" }));
      return;
    }

    setState((s) => ({ ...s, savingUserId: member.user_id, error: "", successMessage: "" }));

    try {
      const response = await fetch(`/api/family-members/${member.user_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ displayName: draftName }),
      });

      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { error?: string } | null;
        setState((s) => ({ ...s, savingUserId: null, error: result?.error ?? "表示名の保存に失敗しました。", successMessage: "" }));
        return;
      }
    } catch {
      setState((s) => ({ ...s, savingUserId: null, error: "表示名の保存に失敗しました。", successMessage: "" }));
      return;
    }

    const { data, error } = await supabase.rpc("list_family_members_for_current_user");
    const members = Array.isArray(data) ? (data as FamilyMember[]) : [];
    const msg = member.role === "child" ? "子どもの呼び名を保存しました。" : "表示名を保存しました。";

    setState((s) => ({
      ...s,
      savingUserId: null,
      error: error ? `表示名は保存されましたが再取得に失敗しました: ${error.message}` : "",
      successMessage: msg,
      members: error ? s.members : members,
    }));
    setEditingNameMember(null);
    window.dispatchEvent(new Event(FAMILY_UPDATED_EVENT));
  };

  const handleSaveEmoji = async (member: FamilyMember, emoji: string) => {
    const token = await getToken();
    if (!token) {
      setState((s) => ({ ...s, error: "ログイン状態の確認に失敗しました。", successMessage: "" }));
      return;
    }

    setSavingAvatarUserId(member.user_id);
    try {
      const response = await fetch(`/api/family-members/${member.user_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ avatarEmoji: emoji }),
      });

      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { error?: string } | null;
        setState((s) => ({ ...s, error: result?.error ?? "アイコンの保存に失敗しました。", successMessage: "" }));
        return;
      }

      const { data } = await supabase.rpc("list_family_members_for_current_user");
      const members = Array.isArray(data) ? (data as FamilyMember[]) : [];
      setState((s) => ({ ...s, error: "", successMessage: "アイコンを保存しました。", members }));
      setEmojiPickerUserId(null);
      window.dispatchEvent(new Event(FAMILY_UPDATED_EVENT));
    } finally {
      setSavingAvatarUserId(null);
    }
  };

  const handleUploadPhoto = async (member: FamilyMember, file: File) => {
    const token = await getToken();
    if (!token) {
      setState((s) => ({ ...s, error: "ログイン状態の確認に失敗しました。", successMessage: "" }));
      return;
    }

    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      setState((s) => ({ ...s, error: "jpeg / png / webp 形式の画像を選んでください。", successMessage: "" }));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setState((s) => ({ ...s, error: "ファイルサイズは5MB以下にしてください。", successMessage: "" }));
      return;
    }

    setUploadingUserId(member.user_id);
    try {
      const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const path = `family-members/${member.family_id}/${member.user_id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("family-member-avatars")
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) {
        setState((s) => ({ ...s, error: `写真のアップロードに失敗しました: ${uploadError.message}`, successMessage: "" }));
        return;
      }

      const response = await fetch(`/api/family-members/${member.user_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ avatarPath: path }),
      });

      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { error?: string } | null;
        setState((s) => ({ ...s, error: result?.error ?? "写真パスの保存に失敗しました。", successMessage: "" }));
        return;
      }

      const { data } = await supabase.rpc("list_family_members_for_current_user");
      const members = Array.isArray(data) ? (data as FamilyMember[]) : [];
      setState((s) => ({ ...s, error: "", successMessage: "写真を保存しました。", members }));
      window.dispatchEvent(new Event(FAMILY_UPDATED_EVENT));
    } finally {
      setUploadingUserId(null);
    }
  };

  const handleDeleteMember = async (member: FamilyMember) => {
    const token = await getToken();
    if (!token) {
      setState((s) => ({ ...s, error: "ログイン状態の確認に失敗しました。", successMessage: "" }));
      return;
    }

    setDeletingUserId(member.user_id);
    try {
      const response = await fetch(`/api/family-members/${member.user_id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { error?: string } | null;
        setState((s) => ({ ...s, error: result?.error ?? "削除に失敗しました。", successMessage: "" }));
        return;
      }

      const { data } = await supabase.rpc("list_family_members_for_current_user");
      const members = Array.isArray(data) ? (data as FamilyMember[]) : [];
      setState((s) => ({ ...s, error: "", successMessage: `${member.display_label} をファミリーから削除しました。`, members }));
      setDeleteConfirmMember(null);
      window.dispatchEvent(new Event(FAMILY_UPDATED_EVENT));
    } finally {
      setDeletingUserId(null);
    }
  };

  return (
    <>
      <SectionCard
        title="家族のみんな"
        description="だれが一緒に使っているかを、ひと目で見られます。"
      >
        {state.loading ? (
          <p className="text-sm text-[var(--text-secondary)]">読み込み中です。</p>
        ) : state.error ? (
          <p className="text-sm text-[var(--danger)]">{state.error}</p>
        ) : state.members.length === 0 ? (
          <EmptyState
            title="まだ家族メンバーがいません"
            description="招待をつくると、ここに家族が並びます。"
          />
        ) : (
          <div className="space-y-4">
            {state.successMessage ? (
              <p className="text-sm text-[var(--success)]">{state.successMessage}</p>
            ) : null}
            {state.error ? (
              <p className="text-sm text-[var(--danger)]">{state.error}</p>
            ) : null}

            <div className="grid gap-3">
              {state.members.map((member) => {
                const isCurrentUser = member.user_id === currentUserId;
                const canEditMember = isCurrentUser || (canEditChildNames && member.role === "child");
                const canDelete = currentUserRole === "guardian_admin" && !isCurrentUser;

                return (
                  <div
                    key={member.user_id}
                    className={`overflow-hidden rounded-[26px] border bg-[var(--surface-card-strong)] p-4 shadow-[0_10px_22px_rgba(51,101,63,0.08)] ${
                      isCurrentUser ? "border-[rgba(76,163,104,0.28)]" : "border-[var(--border-soft)]"
                    }`}
                  >
                    {/* Header: avatar + name/email | role badge + ... menu */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <MemberAvatar
                          avatarPath={member.avatar_path}
                          avatarEmoji={member.avatar_emoji}
                          displayLabel={member.display_label}
                          size="md"
                        />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="text-base font-bold text-[var(--text-primary)] sm:text-lg break-all">
                              {member.display_label}
                              {isCurrentUser ? "（あなた）" : ""}
                            </p>
                            {canEditMember ? (
                              <button
                                type="button"
                                aria-label="名前を編集"
                                className="flex-shrink-0 rounded-full p-1 text-[var(--text-muted)] transition hover:bg-[var(--surface-accent)] hover:text-[var(--brand-primary)]"
                                onClick={() => {
                                  setDraftDisplayNames((d) => ({ ...d, [member.user_id]: member.display_name ?? "" }));
                                  setEditingNameMember(member);
                                }}
                              >
                                ✏️
                              </button>
                            ) : null}
                          </div>
                          <p className="mt-0.5 text-xs text-[var(--text-muted)] break-all">
                            {member.email ?? "メールアドレス未登録"}
                          </p>
                        </div>
                      </div>

                      {/* Right: role badge + ... menu */}
                      <div className="flex flex-shrink-0 items-center gap-2">
                        <StatusBadge tone={familyRoleTone(member.role)}>
                          {formatFamilyRole(member.role)}
                        </StatusBadge>
                        {canDelete ? (
                          <div className="relative" ref={menuOpenUserId === member.user_id ? menuRef : undefined}>
                            <button
                              type="button"
                              aria-label="メニューを開く"
                              className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--text-muted)] transition hover:bg-[var(--surface-accent)] hover:text-[var(--text-primary)]"
                              onClick={() =>
                                setMenuOpenUserId(menuOpenUserId === member.user_id ? null : member.user_id)
                              }
                            >
                              <span className="text-lg leading-none tracking-wider">•••</span>
                            </button>
                            {menuOpenUserId === member.user_id ? (
                              <div className="absolute right-0 top-9 z-30 min-w-[120px] overflow-hidden rounded-[16px] border border-[var(--border-soft)] bg-white shadow-lg">
                                <button
                                  type="button"
                                  className="w-full px-4 py-3 text-left text-sm font-semibold text-red-500 transition hover:bg-red-50"
                                  onClick={() => {
                                    setMenuOpenUserId(null);
                                    setDeleteConfirmMember(member);
                                  }}
                                >
                                  削除する
                                </button>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {/* Avatar / emoji edit section */}
                    {canEditMember ? (
                      <div className="mt-4 rounded-[20px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.76)] px-4 py-4">
                        <p className="text-sm font-bold text-[var(--text-primary)]">写真・アイコン</p>
                        <p className="mt-1 text-sm text-[var(--text-secondary)]">写真またはアイコンを設定できます。</p>
                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          <MemberAvatar
                            avatarPath={member.avatar_path}
                            avatarEmoji={member.avatar_emoji}
                            displayLabel={member.display_label}
                            size="lg"
                          />
                          <div className="flex flex-wrap gap-2">
                            <SecondaryButton
                              type="button"
                              size="sm"
                              onClick={() =>
                                setEmojiPickerUserId(emojiPickerUserId === member.user_id ? null : member.user_id)
                              }
                            >
                              アイコンを選ぶ
                            </SecondaryButton>
                            <SecondaryButton
                              type="button"
                              size="sm"
                              disabled={uploadingUserId === member.user_id}
                              onClick={() => fileInputRefs.current[member.user_id]?.click()}
                            >
                              {uploadingUserId === member.user_id ? "アップロード中..." : "写真を選ぶ"}
                            </SecondaryButton>
                            <input
                              ref={(el) => { fileInputRefs.current[member.user_id] = el; }}
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) void handleUploadPhoto(member, file);
                                e.target.value = "";
                              }}
                            />
                          </div>
                        </div>

                        {emojiPickerUserId === member.user_id ? (
                          <div className="mt-3">
                            <p className="mb-2 text-xs font-semibold text-[var(--text-secondary)]">アイコンを選んでください</p>
                            <div className="flex flex-wrap gap-2">
                              {EMOJI_OPTIONS.map((emoji) => (
                                <button
                                  key={emoji}
                                  type="button"
                                  className="flex h-10 w-10 items-center justify-center rounded-[12px] border border-[var(--border-soft)] bg-white text-xl transition hover:bg-[var(--surface-accent)] disabled:opacity-50"
                                  disabled={savingAvatarUserId === member.user_id}
                                  onClick={() => void handleSaveEmoji(member, emoji)}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </SectionCard>

      {/* Name edit modal */}
      {editingNameMember ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-[28px] bg-white p-6 shadow-2xl">
            <p className="text-lg font-extrabold text-[var(--text-primary)]">
              {editingNameMember.role === "child" ? "子どもの呼び名を編集" : "表示名を編集"}
            </p>
            <form
              className="mt-4 space-y-4"
              onSubmit={(e) => void handleSaveDisplayName(e, editingNameMember)}
            >
              <input
                className="w-full rounded-[18px] border border-[var(--border-soft)] bg-white px-4 py-3 text-base text-[var(--text-primary)] outline-none focus:border-[var(--brand-primary)] focus:ring-4 focus:ring-[var(--focus-ring)]"
                value={draftDisplayNames[editingNameMember.user_id] ?? ""}
                onChange={(e) =>
                  setDraftDisplayNames((d) => ({ ...d, [editingNameMember.user_id]: e.target.value }))
                }
                placeholder={editingNameMember.role === "child" ? "例: なぎ" : "例: ママ"}
                autoFocus
              />
              <div className="flex gap-2">
                <PrimaryButton
                  type="submit"
                  size="sm"
                  fullWidth={false}
                  disabled={state.savingUserId === editingNameMember.user_id}
                >
                  {state.savingUserId === editingNameMember.user_id ? "保存中..." : "保存する"}
                </PrimaryButton>
                <SecondaryButton
                  type="button"
                  size="sm"
                  onClick={() => setEditingNameMember(null)}
                  disabled={state.savingUserId === editingNameMember.user_id}
                >
                  キャンセル
                </SecondaryButton>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Delete confirmation modal */}
      {deleteConfirmMember ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-[28px] bg-white p-6 shadow-2xl">
            <p className="text-lg font-extrabold text-[var(--text-primary)]">
              {deleteConfirmMember.display_label} を削除しますか？
            </p>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              ファミリーから削除されます。この操作は取り消せません。
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-[18px] bg-red-500 py-3 text-sm font-bold text-white transition hover:bg-red-600 disabled:opacity-50"
                disabled={deletingUserId === deleteConfirmMember.user_id}
                onClick={() => void handleDeleteMember(deleteConfirmMember)}
              >
                {deletingUserId === deleteConfirmMember.user_id ? "削除中..." : "削除する"}
              </button>
              <SecondaryButton
                type="button"
                size="sm"
                onClick={() => setDeleteConfirmMember(null)}
                disabled={deletingUserId === deleteConfirmMember.user_id}
              >
                キャンセル
              </SecondaryButton>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
