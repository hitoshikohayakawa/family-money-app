"use client";

import { FormEvent, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { FAMILY_UPDATED_EVENT } from "@/lib/family-events";
import EmptyState from "@/app/components/ui/empty-state";
import PrimaryButton from "@/app/components/ui/primary-button";
import SectionCard from "@/app/components/ui/section-card";
import StatusBadge from "@/app/components/ui/status-badge";
import TextInput from "@/app/components/ui/text-input";
import { familyRoleTone, formatFamilyRole } from "@/app/components/ui/family-labels";

type FamilyState = {
  loading: boolean;
  creating: boolean;
  error: string;
  familyName: string | null;
  role: string | null;
};

export default function FamilySetup() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [inputFamilyName, setInputFamilyName] = useState("");
  const [state, setState] = useState<FamilyState>({
    loading: true,
    creating: false,
    error: "",
    familyName: null,
    role: null,
  });

  useEffect(() => {
    let isActive = true;

    const loadSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!isActive) {
        return;
      }

      setUser(session?.user ?? null);
      setAuthLoading(false);
    };

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isActive) {
        return;
      }

      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    const loadFamily = async () => {
      if (!user) {
        setState({
          loading: false,
          creating: false,
          error: "",
          familyName: null,
          role: null,
        });
        return;
      }

      setState((currentState) => ({
        ...currentState,
        loading: true,
        error: "",
      }));

      const { data: membership, error: membershipError } = await supabase
        .from("family_memberships")
        .select("family_id, role")
        .eq("status", "active")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!isActive) {
        return;
      }

      if (membershipError) {
        setState({
          loading: false,
          creating: false,
          error: `家族情報の確認に失敗しました: ${membershipError.message}`,
          familyName: null,
          role: null,
        });
        return;
      }

      if (!membership) {
        setState({
          loading: false,
          creating: false,
          error: "",
          familyName: null,
          role: null,
        });
        return;
      }

      const { data: family, error: familyError } = await supabase
        .from("families")
        .select("family_name")
        .eq("id", membership.family_id)
        .single();

      if (!isActive) {
        return;
      }

      if (familyError) {
        setState({
          loading: false,
          creating: false,
          error: `家族名の取得に失敗しました: ${familyError.message}`,
          familyName: null,
          role: membership.role,
        });
        return;
      }

      setState({
        loading: false,
        creating: false,
        error: "",
        familyName: family.family_name,
        role: membership.role,
      });
    };

    void loadFamily();

    return () => {
      isActive = false;
    };
  }, [user]);

  const handleCreateFamily = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user) {
      setState((currentState) => ({
        ...currentState,
        error: "ログイン後に家族を作成してください。",
      }));
      return;
    }

    setState((currentState) => ({
      ...currentState,
      creating: true,
      error: "",
    }));

    const trimmedFamilyName = inputFamilyName.trim();

    const { data, error } = await supabase.rpc(
      "create_family_with_owner_membership",
      {
        input_family_name: trimmedFamilyName,
      }
    );

    if (error) {
      setState((currentState) => ({
        ...currentState,
        creating: false,
        error: `家族の作成に失敗しました: ${error.message}`,
      }));
      return;
    }

    const createdFamily = Array.isArray(data) ? data[0] : null;

    if (!createdFamily) {
      setState((currentState) => ({
        ...currentState,
        creating: false,
        error: "家族作成の結果を取得できませんでした。",
      }));
      return;
    }

    setInputFamilyName("");
    setState({
      loading: false,
      creating: false,
      error: "",
      familyName: createdFamily.family_name,
      role: createdFamily.role,
    });

    window.dispatchEvent(new Event(FAMILY_UPDATED_EVENT));
  };

  if (authLoading || state.loading) {
    return (
      <SectionCard title="家族の準備" description="いまの所属を確認しています。" tone="playful">
        <p className="text-sm text-[var(--text-secondary)]">読み込み中です。</p>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="家族の準備"
      description="最初に家族をつくると、みんなを招待できるようになります。"
      tone="playful"
    >

      {!user ? (
        <EmptyState
          title="まずはログインしましょう"
          description="ログインすると、家族をつくる準備ができます。"
        />
      ) : state.familyName ? (
        <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr]">
          <div className="rounded-[var(--radius-lg)] bg-[var(--surface-card-strong)] px-4 py-4">
            <p className="text-sm font-semibold text-[var(--text-secondary)]">あなたの家族</p>
            <p className="mt-2 text-2xl font-bold text-[var(--text-primary)]">
              {state.familyName}
            </p>
          </div>
          <div className="rounded-[var(--radius-lg)] bg-[var(--surface-accent)] px-4 py-4">
            <p className="text-sm font-semibold text-[var(--text-secondary)]">あなたの役わり</p>
            <div className="mt-2">
              <StatusBadge tone={familyRoleTone(state.role)}>
                {formatFamilyRole(state.role)}
              </StatusBadge>
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleCreateFamily} className="mt-4 flex flex-col gap-4">
          <TextInput
            label="家族の名前"
            hint="あとで見ても分かりやすい名前にしましょう。"
            type="text"
            value={inputFamilyName}
            onChange={(event) => setInputFamilyName(event.target.value)}
            placeholder="例: こばやかわファミリー"
            required
          />

          <PrimaryButton
            type="submit"
            disabled={state.creating || inputFamilyName.trim().length === 0}
          >
            {state.creating ? "作成中..." : "家族を作成する"}
          </PrimaryButton>
        </form>
      )}

      {state.error ? (
        <p className="mt-4 text-sm text-[var(--danger)]">{state.error}</p>
      ) : null}
    </SectionCard>
  );
}