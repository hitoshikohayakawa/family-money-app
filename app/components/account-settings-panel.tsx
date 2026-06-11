"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSafeSession } from "@/lib/client-auth";
import { supabase } from "@/lib/supabase";
import { FAMILY_UPDATED_EVENT } from "@/lib/family-events";
import PrimaryButton from "@/app/components/ui/primary-button";
import SecondaryButton from "@/app/components/ui/secondary-button";
import PushNotificationSettings from "@/app/components/push-notification-settings";

type AccountState = {
  loading: boolean;
  role: string | null;
  email: string;
  familyId: string | null;
  familyName: string;
};

export default function AccountSettingsPanel() {
  const router = useRouter();
  const [account, setAccount] = useState<AccountState>({
    loading: true,
    role: null,
    email: "",
    familyId: null,
    familyName: "",
  });

  // Email form
  const [newEmail, setNewEmail] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailMsg, setEmailMsg] = useState({ text: "", ok: false });

  // Family name form
  const [newFamilyName, setNewFamilyName] = useState("");
  const [familySaving, setFamilySaving] = useState(false);
  const [familyMsg, setFamilyMsg] = useState({ text: "", ok: false });

  // Withdraw modal
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState("");

  useEffect(() => {
    let isActive = true;

    const load = async () => {
      const { data: { session } } = await getSafeSession(supabase);
      if (!isActive) return;
      if (!session?.user) { setAccount((s) => ({ ...s, loading: false })); return; }

      const [{ data: membership }, { data: family }] = await Promise.all([
        supabase
          .from("family_memberships")
          .select("family_id, role")
          .eq("user_id", session.user.id)
          .eq("status", "active")
          .maybeSingle(),
        (async () => {
          const { data: mem } = await supabase
            .from("family_memberships")
            .select("family_id")
            .eq("user_id", session.user.id)
            .eq("status", "active")
            .maybeSingle();
          if (!mem?.family_id) return { data: null };
          return supabase
            .from("families")
            .select("family_name")
            .eq("id", mem.family_id)
            .maybeSingle();
        })(),
      ]);

      if (!isActive) return;

      setAccount({
        loading: false,
        role: membership?.role ?? null,
        email: session.user.email ?? "",
        familyId: membership?.family_id ?? null,
        familyName: family?.data?.family_name ?? "",
      });
      setNewEmail(session.user.email ?? "");
      setNewFamilyName(family?.data?.family_name ?? "");
    };

    void load();
    return () => { isActive = false; };
  }, []);

  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = newEmail.trim().toLowerCase();
    if (!trimmed || trimmed === account.email) return;
    setEmailSaving(true);
    setEmailMsg({ text: "", ok: false });

    const { error } = await supabase.auth.updateUser({ email: trimmed });
    setEmailSaving(false);
    if (error) {
      setEmailMsg({ text: `変更に失敗しました: ${error.message}`, ok: false });
    } else {
      setEmailMsg({ text: "確認メールを送信しました。メールのリンクをクリックして変更を完了してください。", ok: true });
    }
  };

  const handleFamilyNameSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = newFamilyName.trim();
    if (!trimmed || trimmed === account.familyName) return;
    setFamilySaving(true);
    setFamilyMsg({ text: "", ok: false });

    const { error } = await supabase.rpc("update_family_name", { new_family_name: trimmed });
    setFamilySaving(false);
    if (error) {
      setFamilyMsg({ text: `変更に失敗しました: ${error.message}`, ok: false });
    } else {
      setAccount((s) => ({ ...s, familyName: trimmed }));
      setFamilyMsg({ text: "ファミリー名を変更しました。", ok: true });
      window.dispatchEvent(new Event(FAMILY_UPDATED_EVENT));
    }
  };

  const handleWithdraw = async () => {
    setWithdrawing(true);
    setWithdrawError("");

    const { error } = await supabase.rpc("withdraw_family");
    if (error) {
      setWithdrawError(`退会処理に失敗しました: ${error.message}`);
      setWithdrawing(false);
      return;
    }

    await supabase.auth.signOut();
    router.replace("/");
  };

  const isGuardianAdmin = account.role === "guardian_admin";

  if (account.loading) {
    return <p className="py-10 text-center text-sm text-[var(--text-secondary)]">読み込み中...</p>;
  }

  return (
    <>
      <div className="space-y-5">

        {/* Email */}
        <section className="rounded-[28px] border border-[var(--border-soft)] bg-[var(--surface-card-strong)] p-5 shadow-[var(--shadow-card)]">
          <p className="text-lg font-extrabold text-[var(--text-primary)]">メールアドレス</p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            変更すると確認メールが届きます。リンクをクリックして完了してください。
          </p>
          <form className="mt-4 space-y-3" onSubmit={(e) => void handleEmailSubmit(e)}>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="w-full rounded-[18px] border border-[var(--border-soft)] bg-white px-4 py-3 text-base text-[var(--text-primary)] outline-none focus:border-[var(--brand-primary)] focus:ring-4 focus:ring-[var(--focus-ring)]"
              required
            />
            {emailMsg.text ? (
              <p className={`text-sm font-semibold ${emailMsg.ok ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                {emailMsg.text}
              </p>
            ) : null}
            <PrimaryButton
              type="submit"
              size="sm"
              fullWidth={false}
              disabled={emailSaving || !newEmail.trim() || newEmail.trim().toLowerCase() === account.email}
            >
              {emailSaving ? "送信中..." : "変更を申請する"}
            </PrimaryButton>
          </form>
        </section>

        {/* Family name — guardian_admin only */}
        {isGuardianAdmin ? (
          <section className="rounded-[28px] border border-[var(--border-soft)] bg-[var(--surface-card-strong)] p-5 shadow-[var(--shadow-card)]">
            <p className="text-lg font-extrabold text-[var(--text-primary)]">ファミリー名</p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              ホーム画面などに表示されるファミリー名を変更できます。
            </p>
            <form className="mt-4 space-y-3" onSubmit={(e) => void handleFamilyNameSubmit(e)}>
              <input
                type="text"
                value={newFamilyName}
                onChange={(e) => setNewFamilyName(e.target.value)}
                placeholder="例: こばやかわファミリー"
                className="w-full rounded-[18px] border border-[var(--border-soft)] bg-white px-4 py-3 text-base text-[var(--text-primary)] outline-none focus:border-[var(--brand-primary)] focus:ring-4 focus:ring-[var(--focus-ring)]"
                required
              />
              {familyMsg.text ? (
                <p className={`text-sm font-semibold ${familyMsg.ok ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                  {familyMsg.text}
                </p>
              ) : null}
              <PrimaryButton
                type="submit"
                size="sm"
                fullWidth={false}
                disabled={familySaving || !newFamilyName.trim() || newFamilyName.trim() === account.familyName}
              >
                {familySaving ? "保存中..." : "変更する"}
              </PrimaryButton>
            </form>
          </section>
        ) : null}

        {/* Push notification settings */}
        <PushNotificationSettings />

        {/* Withdraw — guardian_admin only */}
        {isGuardianAdmin ? (
          <section className="rounded-[28px] border border-[rgba(220,107,90,0.22)] bg-[rgba(255,242,238,0.6)] p-5 shadow-[var(--shadow-card)]">
            <p className="text-lg font-extrabold text-[var(--text-primary)]">退会</p>
            <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
              退会するとファミリー全員のアカウントが無効になります。この操作は取り消せません。
            </p>
            <div className="mt-4">
              <button
                type="button"
                className="rounded-[18px] border border-red-300 bg-white px-5 py-2.5 text-sm font-bold text-red-500 transition hover:bg-red-50"
                onClick={() => setShowWithdrawModal(true)}
              >
                退会する
              </button>
            </div>
          </section>
        ) : null}

        <div className="h-16" />
      </div>

      {/* Withdraw confirmation modal */}
      {showWithdrawModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-[28px] bg-white p-6 shadow-2xl">
            <p className="text-lg font-extrabold text-[var(--text-primary)]">
              本当に退会しますか？
            </p>
            <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
              退会すると過去のお小遣い履歴などがすべて削除されます。<br />
              ファミリーに登録されたメンバー全員のアカウントが無効になります。<br />
              この操作は取り消せません。
            </p>
            {withdrawError ? (
              <p className="mt-3 text-sm font-semibold text-red-500">{withdrawError}</p>
            ) : null}
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                className="flex-1 rounded-[18px] bg-red-500 py-3 text-sm font-bold text-white transition hover:bg-red-600 disabled:opacity-50"
                disabled={withdrawing}
                onClick={() => void handleWithdraw()}
              >
                {withdrawing ? "処理中..." : "退会する"}
              </button>
              <SecondaryButton
                type="button"
                size="sm"
                onClick={() => { setShowWithdrawModal(false); setWithdrawError(""); }}
                disabled={withdrawing}
              >
                戻る
              </SecondaryButton>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
