"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import useElementaryMode from "@/app/components/use-elementary-mode";
import { getSafeSession } from "@/lib/client-auth";
import { supabase } from "@/lib/supabase";
import { FAMILY_UPDATED_EVENT } from "@/lib/family-events";
import EmptyState from "@/app/components/ui/empty-state";
import PrimaryButton from "@/app/components/ui/primary-button";
import SecondaryButton from "@/app/components/ui/secondary-button";
import SectionCard from "@/app/components/ui/section-card";
import SelectInput from "@/app/components/ui/select-input";
import StatusBadge from "@/app/components/ui/status-badge";
import TextInput from "@/app/components/ui/text-input";

type FamilyMembership = {
  family_id: string;
  role: string;
};

type FamilyMember = {
  family_id: string;
  user_id: string;
  role: string;
  email: string | null;
  display_name: string | null;
  display_label: string;
};

type AllowanceGrant = {
  id: string;
  family_id: string;
  child_user_id: string;
  child_email: string | null;
  child_display_label: string;
  granted_by_user_id: string;
  granted_by_email: string | null;
  granted_by_display_label: string;
  amount_jpy: number;
  note: string | null;
  granted_at: string;
  decision_status: "pending" | "immediate_cash_requested" | "invested";
  decision_asset_id: string | null;
  decision_asset_code: string | null;
  decision_asset_name: string | null;
  investment_price_date: string | null;
  investment_unit_price_jpy: number | null;
  investment_units: number | string | null;
  latest_price_date: string | null;
  latest_unit_price_jpy: number | null;
  current_value_jpy: number | null;
  unrealized_gain_jpy: number | null;
  unrealized_gain_rate: number | string | null;
  cashout_request_id: string | null;
  cashout_status: "requested" | "paid" | null;
  cashout_requested_amount_jpy: number | null;
  cashout_requested_at: string | null;
  cashout_paid_at: string | null;
  decided_at: string | null;
  created_at: string;
};

type InvestmentAssetOption = {
  asset_id: string;
  asset_code: string;
  asset_name: string;
  asset_category_code: InvestmentCategoryCode;
  description: string | null;
  latest_price_date: string | null;
  latest_unit_price_jpy: number | null;
  previous_price_date: string | null;
  previous_unit_price_jpy: number | null;
  daily_change_jpy: number | null;
  daily_change_rate: number | string | null;
};

type AllowanceState = {
  loading: boolean;
  isAuthenticated: boolean;
  submitting: boolean;
  requestingCashout: boolean;
  markingPaidRequestId: string | null;
  requestingCashGrantId: string | null;
  requestingInvestmentGrantId: string | null;
  error: string;
  successMessage: string;
  userId: string | null;
  membership: FamilyMembership | null;
  members: FamilyMember[];
  grants: AllowanceGrant[];
  investmentAssets: InvestmentAssetOption[];
  priceRefreshInfo: PriceRefreshInfo | null;
};

type PendingChoice =
  | { type: "immediate_cash"; grantId: string }
  | { type: "grant_create" }
  | { type: "investment_category_select"; grantId: string }
  | { type: "investment_select"; grantId: string; categoryCode: InvestmentCategoryCode }
  | {
      type: "investment_confirm";
      grantId: string;
      assetId: string;
      categoryCode: InvestmentCategoryCode;
    }
  | { type: "cashout_confirm" }
  | { type: "cashout_sent"; guardianNames: string[] }
  | { type: "paid_confirm"; requestId: string }
  | null;

type RubyToken = {
  text: string;
  reading?: string;
};

type CashoutRequestGroup = {
  requestId: string;
  status: "requested" | "paid";
  childLabel: string;
  amountJpy: number;
  requestedAt: string | null;
  paidAt: string | null;
  grants: AllowanceGrant[];
};

type PriceRefreshInfo = {
  checkedAt: string;
  status: "updated" | "skipped" | "failed";
  reason?: string;
  sourcePriceDate?: string;
  storedPriceDate?: string;
  expectedBusinessDate?: string;
  message?: string;
};

type InvestmentCategoryCode = "index_stock" | "single_stock" | "resource" | "crypto";

type InvestmentCategory = {
  code: InvestmentCategoryCode;
  name: string;
  description: string;
  elementaryName: string;
  elementaryDescription: string;
};

const investmentCategories: InvestmentCategory[] = [
  {
    code: "index_stock",
    name: "インデックス株式",
    description:
      "世界のいろいろな会社に広く分けて投資するジャンルです。1つにしぼらず、まとめて応援するイメージです。",
    elementaryName: "インデックスかぶしき",
    elementaryDescription:
      "せかいの いろいろな かいしゃに ひろく わけて とうしする ジャンルです。ひとつに しぼらず、まとめて おうえんする イメージです。",
  },
  {
    code: "single_stock",
    name: "個別株式",
    description:
      "会社の価値を応援するように、その会社そのものへ投資するジャンルです。会社ごとの良し悪しが出やすいです。",
    elementaryName: "こべつかぶしき",
    elementaryDescription:
      "ひとつの かいしゃ そのものに とうしする ジャンルです。かいしゃごとに よしあしが でやすいです。",
  },
  {
    code: "resource",
    name: "現物・資源",
    description:
      "金や銀などの現物資産や、資源に関係するジャンルです。世界の出来事や景気で動きやすい特徴があります。",
    elementaryName: "げんぶつ・しげん",
    elementaryDescription:
      "きんや ぎんなどの げんぶつしさんや、しげんに かんけいする ジャンルです。せかいのできごとで うごきやすい とくちょうが あります。",
  },
  {
    code: "crypto",
    name: "仮想通貨",
    description:
      "インターネット上でやりとりされるデジタル資産のジャンルです。値動きが大きい特徴があります。",
    elementaryName: "かそうつうか",
    elementaryDescription:
      "ネットの うえで やりとりされる デジタルの しさんです。ねだんの うごきが おおきい とくちょうが あります。",
  },
];

async function getAccessToken() {
  const {
    data: { session },
    error,
  } = await getSafeSession(supabase);

  if (error || !session?.access_token) {
    throw new Error("ログイン状態を確認できませんでした。");
  }

  return session.access_token;
}

async function parseApiError(response: Response, fallbackMessage: string) {
  let body: unknown = null;

  try {
    body = await response.json();
  } catch {
    return fallbackMessage;
  }

  if (typeof body === "object" && body !== null && "error" in body) {
    return String(body.error);
  }

  return fallbackMessage;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatGuardianGrantStatus(status: AllowanceGrant["decision_status"]) {
  switch (status) {
    case "pending":
      return "未選択";
    case "immediate_cash_requested":
      return "すぐにもらう選択済み";
    case "invested":
      return "投資する選択済み";
    default:
      return "未選択";
  }
}

function guardianGrantStatusTone(
  status: AllowanceGrant["decision_status"],
  cashoutStatus: AllowanceGrant["cashout_status"]
) {
  if (cashoutStatus === "paid") {
    return "success" as const;
  }

  switch (status) {
    case "pending":
      return "warning" as const;
    case "immediate_cash_requested":
      return "info" as const;
    case "invested":
      return "success" as const;
    default:
      return "neutral" as const;
  }
}

function todayDateValue() {
  return new Date().toISOString().slice(0, 10);
}

function formatGainRate(rate: number | string) {
  return new Intl.NumberFormat("ja-JP", {
    maximumFractionDigits: 2,
  }).format(Number(rate));
}

function formatSignedCurrency(amount: number) {
  return `${amount >= 0 ? "+" : "-"}${formatCurrency(Math.abs(amount))}`;
}

function formatSignedPercent(rate: number | string) {
  const numericRate = Number(rate);
  return `${numericRate >= 0 ? "+" : "-"}${formatGainRate(Math.abs(numericRate))}%`;
}

function formatAssetDailyChange(asset: InvestmentAssetOption, elementaryMode = false) {
  if (asset.daily_change_jpy === null || asset.daily_change_rate === null) {
    return elementaryMode ? "きのうとの ちがいは まだありません" : "前日比なし";
  }

  const sign = asset.daily_change_jpy >= 0 ? "+" : "";

  return `${sign}${formatCurrency(asset.daily_change_jpy)}（${sign}${formatGainRate(
    asset.daily_change_rate
  )}%）`;
}

function getGrantMarketValue(grant: AllowanceGrant) {
  if (grant.cashout_status) {
    return 0;
  }

  if (grant.decision_status === "invested" && grant.current_value_jpy !== null) {
    return grant.current_value_jpy;
  }

  return grant.amount_jpy;
}

function getGrantGain(grant: AllowanceGrant) {
  if (grant.cashout_status) {
    return 0;
  }

  if (grant.decision_status === "invested" && grant.unrealized_gain_jpy !== null) {
    return grant.unrealized_gain_jpy;
  }

  return 0;
}

function groupCashoutRequests(grants: AllowanceGrant[]) {
  const groups = new Map<string, CashoutRequestGroup>();

  grants.forEach((grant) => {
    if (!grant.cashout_request_id || !grant.cashout_status) {
      return;
    }

    const existingGroup = groups.get(grant.cashout_request_id);

    if (existingGroup) {
      existingGroup.grants.push(grant);
      return;
    }

    groups.set(grant.cashout_request_id, {
      requestId: grant.cashout_request_id,
      status: grant.cashout_status,
      childLabel: grant.child_display_label,
      amountJpy: grant.cashout_requested_amount_jpy ?? getGrantMarketValue(grant),
      requestedAt: grant.cashout_requested_at,
      paidAt: grant.cashout_paid_at,
      grants: [grant],
    });
  });

  return Array.from(groups.values());
}

function isCashoutReadyInvestment(grant: AllowanceGrant) {
  return grant.decision_status === "invested" && !grant.cashout_status;
}

function clampPage(page: number, pageCount: number) {
  return Math.min(Math.max(page, 1), Math.max(pageCount, 1));
}

function paginate<T>(items: T[], page: number, perPage = 10) {
  const pageCount = Math.max(Math.ceil(items.length / perPage), 1);
  const currentPage = clampPage(page, pageCount);
  const startIndex = (currentPage - 1) * perPage;

  return {
    currentPage,
    pageCount,
    items: items.slice(startIndex, startIndex + perPage),
  };
}

function PaginationControls({
  currentPage,
  pageCount,
  onPageChange,
}: {
  currentPage: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}) {
  if (pageCount <= 1) {
    return null;
  }

  return (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm font-bold text-[var(--text-primary)]">
      <button
        type="button"
        className="rounded-full border border-[var(--border-soft)] px-3 py-1 disabled:opacity-40"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
      >
        &lt;
      </button>
      {Array.from({ length: pageCount }, (_, index) => index + 1).map((page) => (
        <button
          key={page}
          type="button"
          className={`rounded-full border px-3 py-1 ${
            page === currentPage
              ? "border-[var(--brand-blue)] bg-[rgba(76,163,104,0.18)]"
              : "border-[var(--border-soft)]"
          }`}
          onClick={() => onPageChange(page)}
        >
          {page}
        </button>
      ))}
      <button
        type="button"
        className="rounded-full border border-[var(--border-soft)] px-3 py-1 disabled:opacity-40"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= pageCount}
      >
        &gt;
      </button>
    </div>
  );
}

function RubyText({
  tokens,
  className = "",
}: {
  tokens: RubyToken[];
  className?: string;
}) {
  return (
    <span className={className}>
      {tokens.map((token, index) =>
        token.reading ? (
          <ruby key={`${token.text}-${index}`} className="ruby">
            {token.text}
            <rp>（</rp>
            <rt className="text-[0.55em] font-medium">{token.reading}</rt>
            <rp>）</rp>
          </ruby>
        ) : (
          <span key={`${token.text}-${index}`}>{token.text}</span>
        )
      )}
    </span>
  );
}

function DashboardIcon({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const toneClasses =
    tone === "success"
      ? "bg-[rgba(76,163,104,0.14)] text-[var(--success)]"
      : tone === "warning"
        ? "bg-[rgba(241,201,116,0.18)] text-[rgb(154,112,17)]"
        : tone === "danger"
          ? "bg-[rgba(239,172,192,0.18)] text-[var(--danger)]"
          : "bg-[var(--surface-accent)] text-[var(--brand-primary-strong)]";

  return (
    <span
      className={`inline-flex h-11 w-11 items-center justify-center rounded-[16px] ${toneClasses}`}
      aria-hidden="true"
    >
      {children}
    </span>
  );
}

function getInvestmentCategoryCodeForGrant(
  grant: AllowanceGrant,
  investmentAssets: InvestmentAssetOption[]
): InvestmentCategoryCode | null {
  const matchedAsset =
    investmentAssets.find((asset) => asset.asset_id === grant.decision_asset_id) ??
    investmentAssets.find((asset) => asset.asset_code === grant.decision_asset_code);

  return matchedAsset?.asset_category_code ?? null;
}

function InvestmentCategoryIcon({
  categoryCode,
}: {
  categoryCode: InvestmentCategoryCode | null;
}) {
  const toneClasses =
    categoryCode === "index_stock"
      ? "bg-[rgba(106,164,219,0.16)] text-[#2F79BA]"
      : categoryCode === "single_stock"
        ? "bg-[rgba(228,163,94,0.18)] text-[#B46B1E]"
        : categoryCode === "resource"
          ? "bg-[rgba(241,201,116,0.2)] text-[#A67519]"
          : categoryCode === "crypto"
            ? "bg-[rgba(146,123,210,0.18)] text-[#7A57C1]"
            : "bg-[rgba(76,163,104,0.14)] text-[var(--brand-primary-strong)]";

  return (
    <div
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] ${toneClasses}`}
    >
      {categoryCode === "index_stock" ? (
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8">
          <path d="M4 18h16" />
          <path d="M7 15V9" />
          <path d="M12 15V6" />
          <path d="M17 15v-3" />
          <path d="m5 11 4-3 3 1 5-4 2 1" />
        </svg>
      ) : categoryCode === "single_stock" ? (
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8">
          <path d="M4 20h16" />
          <path d="M6 20V9l6-4 6 4v11" />
          <path d="M10 12h4" />
          <path d="M10 16h4" />
        </svg>
      ) : categoryCode === "resource" ? (
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8">
          <ellipse cx="12" cy="8" rx="5" ry="2.5" />
          <path d="M7 8v5c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5V8" />
          <path d="M7 13v3c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5v-3" />
        </svg>
      ) : categoryCode === "crypto" ? (
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8">
          <path d="M12 3v18" />
          <path d="M8.5 7.5h5a2.5 2.5 0 1 1 0 5h-5Z" />
          <path d="M8.5 12.5H14a2.75 2.75 0 1 1 0 5.5H8.5Z" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8">
          <path d="M12 21V10" />
          <path d="M7 14c0-3 2.2-5 5-5s5 2 5 5" />
          <path d="M6 5h12" />
        </svg>
      )}
    </div>
  );
}

function ChildSectionTitle({
  icon,
  title,
  description,
  tone = "default",
}: {
  icon: ReactNode;
  title: ReactNode;
  description: string;
  tone?: "default" | "success" | "warning";
}) {
  return (
    <div className="flex items-start gap-4">
      <DashboardIcon tone={tone}>
        <span className="h-6 w-6">{icon}</span>
      </DashboardIcon>
      <div>
        <p className="text-xl font-extrabold text-[var(--text-primary)]">{title}</p>
        <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">{description}</p>
      </div>
    </div>
  );
}

function ChildAllowanceGraphic() {
  return (
    <div className="relative ml-auto h-28 w-28 shrink-0 sm:h-36 sm:w-36 lg:h-40 lg:w-full lg:max-w-[220px]" aria-hidden="true">
      <div className="absolute left-6 top-4 h-24 w-24 rounded-full bg-[rgba(76,163,104,0.12)] blur-2xl" />
      <div className="absolute right-5 top-8 h-20 w-20 rounded-full bg-[rgba(241,201,116,0.16)] blur-2xl" />
      <svg viewBox="0 0 240 180" className="h-full w-full">
        <defs>
          <linearGradient id="heroBag" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#60ba74" />
            <stop offset="100%" stopColor="#2f7f4a" />
          </linearGradient>
          <linearGradient id="heroCoin" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffd45f" />
            <stop offset="100%" stopColor="#f0aa1b" />
          </linearGradient>
        </defs>
        <ellipse cx="122" cy="150" rx="72" ry="12" fill="rgba(35,74,47,0.08)" />
        <path
          d="M88 64c8 10 20 15 32 15s24-5 32-15c20 7 33 26 33 49 0 33-28 47-65 47s-65-14-65-47c0-23 13-42 33-49Z"
          fill="url(#heroBag)"
        />
        <path
          d="M104 49c3 8 9 13 16 13s13-5 16-13"
          fill="none"
          stroke="#25643a"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <rect x="100" y="34" width="40" height="14" rx="7" fill="#3e9158" />
        <text
          x="120"
          y="122"
          textAnchor="middle"
          fontSize="52"
          fontWeight="800"
          fill="white"
        >
          ¥
        </text>
        <g transform="translate(30 110)">
          <ellipse cx="26" cy="32" rx="24" ry="6" fill="rgba(35,74,47,0.06)" />
          <ellipse cx="26" cy="24" rx="24" ry="7" fill="url(#heroCoin)" />
          <path d="M2 24v8c0 4 11 7 24 7s24-3 24-7v-8" fill="#f7b627" />
          <ellipse cx="26" cy="16" rx="24" ry="7" fill="url(#heroCoin)" />
          <path d="M2 16v8c0 4 11 7 24 7s24-3 24-7v-8" fill="#ffc43b" />
          <ellipse cx="26" cy="8" rx="24" ry="7" fill="url(#heroCoin)" />
        </g>
        <g transform="translate(170 26)">
          <circle cx="18" cy="18" r="18" fill="url(#heroCoin)" />
          <text
            x="18"
            y="24"
            textAnchor="middle"
            fontSize="20"
            fontWeight="800"
            fill="#fff6d3"
          >
            ¥
          </text>
        </g>
        <g fill="#dcefdc">
          <path d="M58 42l4 8 8 4-8 4-4 8-4-8-8-4 8-4z" />
          <path d="M196 70l3 6 6 3-6 3-3 6-3-6-6-3 6-3z" />
          <circle cx="183" cy="53" r="5" />
          <circle cx="197" cy="96" r="4" />
        </g>
      </svg>
    </div>
  );
}

function ChoiceModal({
  title,
  children,
  footer,
  contentClassName = "",
  onClose,
}: {
  title: RubyToken[];
  children: ReactNode;
  footer?: ReactNode;
  contentClassName?: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(16,28,54,0.36)] px-4 py-4 sm:px-4 sm:py-6"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex max-h-[90dvh] w-full max-w-xl flex-col overflow-hidden rounded-[32px] border border-[var(--border-soft)] bg-[var(--surface-card-strong)] p-4 shadow-[0_24px_70px_rgba(26,44,82,0.28)] sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-xl font-bold leading-9 text-[var(--text-primary)]">
            <RubyText tokens={title} />
          </h3>
          <button
            type="button"
            className="rounded-full border border-[var(--border-soft)] px-3 py-1 text-sm text-[var(--text-secondary)]"
            onClick={onClose}
          >
            とじる
          </button>
        </div>
        <div className={`mt-4 min-h-0 flex-1 overflow-y-auto pr-1 ${contentClassName}`}>
          {children}
        </div>
        {footer ? (
          <div className="mt-4 border-t border-[var(--border-soft)] bg-[var(--surface-card-strong)] pt-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function immediateCashTitle(elementaryMode: boolean): RubyToken[] {
  if (elementaryMode) {
    return [{ text: "いますぐ もらいますか？" }];
  }

  return [
    { text: "今", reading: "いま" },
    { text: "すぐもらうでよろしいですか？" },
  ];
}

function investmentSelectTitle(elementaryMode: boolean): RubyToken[] {
  if (elementaryMode) {
    return [{ text: "とうしの ジャンルを えらんでください。" }];
  }

  return [
    { text: "投資", reading: "とうし" },
    { text: "ジャンルを" },
    { text: "選択", reading: "せんたく" },
    { text: "してください。" },
  ];
}

function investmentAssetSelectTitle(elementaryMode: boolean): RubyToken[] {
  if (elementaryMode) {
    return [{ text: "とうしさきを えらんでください。" }];
  }

  return [
    { text: "投資先", reading: "とうしさき" },
    { text: "を" },
    { text: "選択", reading: "せんたく" },
    { text: "してください。" },
  ];
}

function investmentConfirmTitle(assetName: string, elementaryMode: boolean): RubyToken[] {
  if (elementaryMode) {
    return [{ text: `${assetName}に とうしします。よろしいですか？` }];
  }

  return [
    { text: assetName },
    { text: "に" },
    { text: "投資", reading: "とうし" },
    { text: "します。よろしいですか？" },
  ];
}

function yesTokens(): RubyToken[] {
  return [{ text: "はい" }];
}

function cancelTokens(): RubyToken[] {
  return [{ text: "やめる" }];
}

function backTokens(): RubyToken[] {
  return [{ text: "もどる" }];
}

async function fetchAllowanceGrants() {
  const { data, error } = await supabase.rpc("list_allowance_grants_for_current_user");

  return {
    data: Array.isArray(data) ? (data as AllowanceGrant[]) : [],
    error,
  };
}

async function fetchFamilyMembers() {
  const { data, error } = await supabase.rpc("list_family_members_for_current_user");

  return {
    data: Array.isArray(data) ? (data as FamilyMember[]) : [],
    error,
  };
}

async function fetchInvestmentAssets() {
  const { data, error } = await supabase.rpc("list_investment_assets_for_current_user");

  return {
    data: Array.isArray(data) ? (data as InvestmentAssetOption[]) : [],
    error,
  };
}

async function refreshInvestmentPricesOnAccess() {
  const accessToken = await getAccessToken();
  const response = await fetch("/api/investment-prices/refresh", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const message = await parseApiError(response, "価格の更新に失敗しました。");
    throw new Error(message);
  }

  const body = (await response.json()) as Omit<PriceRefreshInfo, "checkedAt">;
  return {
    checkedAt: new Date().toISOString(),
    ...body,
  } as PriceRefreshInfo;
}

function formatGrantDateLabel(value: string) {
  return new Date(value).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
}

type AllowanceGrantsPanelProps = {
  viewMode?: "main" | "history";
};

export default function AllowanceGrantsPanel({
  viewMode = "main",
}: AllowanceGrantsPanelProps) {
  const { elementaryMode } = useElementaryMode();
  const router = useRouter();
  const pathname = usePathname();
  const [selectedChildId, setSelectedChildId] = useState("");
  const [amountJpy, setAmountJpy] = useState("");
  const [grantDate, setGrantDate] = useState(todayDateValue);
  const [note, setNote] = useState("");
  const [selectedInvestmentCategories, setSelectedInvestmentCategories] = useState<
    Record<string, InvestmentCategoryCode>
  >({});
  const [selectedInvestmentAssets, setSelectedInvestmentAssets] = useState<
    Record<string, string>
  >({});
  const [selectedCashoutGrantIds, setSelectedCashoutGrantIds] = useState<string[]>([]);
  const [expandedInvestmentGrantIds, setExpandedInvestmentGrantIds] = useState<string[]>([]);
  const [expandedGuardianGrantIds, setExpandedGuardianGrantIds] = useState<string[]>([]);
  const [pendingChoice, setPendingChoice] = useState<PendingChoice>(null);
  const [grantSentModal, setGrantSentModal] = useState<{
    amountJpy: number;
    childLabel: string;
  } | null>(null);
  const [activePage, setActivePage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [state, setState] = useState<AllowanceState>({
    loading: true,
    isAuthenticated: false,
    submitting: false,
    requestingCashout: false,
    markingPaidRequestId: null,
    requestingCashGrantId: null,
    requestingInvestmentGrantId: null,
    error: "",
    successMessage: "",
    userId: null,
    membership: null,
    members: [],
    grants: [],
    investmentAssets: [],
    priceRefreshInfo: null,
  });

  useEffect(() => {
    let isActive = true;

    const loadAllowanceContext = async () => {
      const {
        data: { session },
        error: sessionError,
      } = await getSafeSession(supabase);

      if (!isActive) {
        return;
      }

      if (sessionError) {
        setState({
          loading: false,
          isAuthenticated: false,
          submitting: false,
          requestingCashout: false,
          markingPaidRequestId: null,
          requestingCashGrantId: null,
          requestingInvestmentGrantId: null,
          error: "ログイン状態の確認に失敗しました。",
          successMessage: "",
          userId: null,
          membership: null,
          members: [],
          grants: [],
          investmentAssets: [],
          priceRefreshInfo: null,
        });
        return;
      }

      if (!session?.user) {
        setState({
          loading: false,
          isAuthenticated: false,
          submitting: false,
          requestingCashout: false,
          markingPaidRequestId: null,
          requestingCashGrantId: null,
          requestingInvestmentGrantId: null,
          error: "",
          successMessage: "",
          userId: null,
          membership: null,
          members: [],
          grants: [],
          investmentAssets: [],
          priceRefreshInfo: null,
        });
        return;
      }

      let priceRefreshInfo: PriceRefreshInfo | null = null;

      try {
        priceRefreshInfo = await refreshInvestmentPricesOnAccess();
      } catch (error) {
        console.warn("Investment price refresh on access failed.", error);
        priceRefreshInfo = {
          checkedAt: new Date().toISOString(),
          status: "failed",
          message: error instanceof Error ? error.message : "価格の更新に失敗しました。",
        };
      }

      const [
        { data: membership, error: membershipError },
        membersResult,
        grantsResult,
        investmentAssetsResult,
      ] = await Promise.all([
          supabase
            .from("family_memberships")
            .select("family_id, role")
            .eq("status", "active")
            .eq("user_id", session.user.id)
            .maybeSingle(),
          fetchFamilyMembers(),
          fetchAllowanceGrants(),
          fetchInvestmentAssets(),
        ]);

      if (!isActive) {
        return;
      }

      if (membershipError) {
        setState({
          loading: false,
          isAuthenticated: true,
          submitting: false,
          requestingCashout: false,
          markingPaidRequestId: null,
          requestingCashGrantId: null,
          requestingInvestmentGrantId: null,
          error: `家族情報の取得に失敗しました: ${membershipError.message}`,
          successMessage: "",
          userId: session.user.id,
          membership: null,
          members: [],
          grants: [],
          investmentAssets: [],
          priceRefreshInfo,
        });
        return;
      }

      if (membersResult.error) {
        setState({
          loading: false,
          isAuthenticated: true,
          submitting: false,
          requestingCashout: false,
          markingPaidRequestId: null,
          requestingCashGrantId: null,
          requestingInvestmentGrantId: null,
          error: `家族メンバーの取得に失敗しました: ${membersResult.error.message}`,
          successMessage: "",
          userId: session.user.id,
          membership: membership as FamilyMembership | null,
          members: [],
          grants: [],
          investmentAssets: [],
          priceRefreshInfo,
        });
        return;
      }

      if (grantsResult.error) {
        setState({
          loading: false,
          isAuthenticated: true,
          submitting: false,
          requestingCashout: false,
          markingPaidRequestId: null,
          requestingCashGrantId: null,
          requestingInvestmentGrantId: null,
          error: `お小遣い一覧の取得に失敗しました: ${grantsResult.error.message}`,
          successMessage: "",
          userId: session.user.id,
          membership: membership as FamilyMembership | null,
          members: membersResult.data,
          grants: [],
          investmentAssets: [],
          priceRefreshInfo,
        });
        return;
      }

      if (investmentAssetsResult.error) {
        setState({
          loading: false,
          isAuthenticated: true,
          submitting: false,
          requestingCashout: false,
          markingPaidRequestId: null,
          requestingCashGrantId: null,
          requestingInvestmentGrantId: null,
          error: `投資先一覧の取得に失敗しました: ${investmentAssetsResult.error.message}`,
          successMessage: "",
          userId: session.user.id,
          membership: membership as FamilyMembership | null,
          members: membersResult.data,
          grants: grantsResult.data,
          investmentAssets: [],
          priceRefreshInfo,
        });
        return;
      }

      const childMembers = membersResult.data.filter((member) => member.role === "child");
      const firstChildId = childMembers[0]?.user_id ?? "";

      setSelectedChildId((currentValue) =>
        childMembers.some((member) => member.user_id === currentValue)
          ? currentValue
          : firstChildId
      );
      setState((currentState) => ({
        ...currentState,
        loading: false,
        isAuthenticated: true,
        error: "",
        userId: session.user.id,
        membership: membership as FamilyMembership | null,
        members: membersResult.data,
        grants: grantsResult.data,
        investmentAssets: investmentAssetsResult.data,
        priceRefreshInfo,
      }));
    };

    void loadAllowanceContext();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void loadAllowanceContext();
    });

    const handleFamilyUpdated = () => {
      void loadAllowanceContext();
    };

    window.addEventListener(FAMILY_UPDATED_EVENT, handleFamilyUpdated);

    return () => {
      isActive = false;
      subscription.unsubscribe();
      window.removeEventListener(FAMILY_UPDATED_EVENT, handleFamilyUpdated);
    };
  }, []);

  useEffect(() => {
    if (state.loading || state.isAuthenticated) {
      return;
    }

    const nextPath = pathname && pathname.startsWith("/") ? pathname : "/";
    router.replace(`/login?next=${encodeURIComponent(nextPath)}`);
  }, [pathname, router, state.isAuthenticated, state.loading]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const submittedChildId = String(formData.get("childUserId") ?? "");
    const parsedAmount = Number.parseInt(amountJpy, 10);
    const targetChildId =
      submittedChildId ||
      selectedChildId ||
      state.members.find((member) => member.role === "child")?.user_id ||
      "";

    if (!targetChildId) {
      setState((currentState) => ({
        ...currentState,
        error: "お小遣いを渡す子どもを選んでください。",
        successMessage: "",
      }));
      return;
    }

    if (!Number.isInteger(parsedAmount) || parsedAmount <= 0) {
      setState((currentState) => ({
        ...currentState,
        error: "お小遣いの金額は1円以上で入力してください。",
        successMessage: "",
      }));
      return;
    }

    setState((currentState) => ({
      ...currentState,
      submitting: true,
      error: "",
      successMessage: "",
    }));

    let accessToken = "";

    try {
      accessToken = await getAccessToken();
    } catch (error) {
      setState((currentState) => ({
        ...currentState,
        submitting: false,
        error: error instanceof Error ? error.message : "ログイン状態を確認できませんでした。",
        successMessage: "",
      }));
      return;
    }

    let response: Response;

    try {
      response = await fetch("/api/allowance-grants", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          childUserId: targetChildId,
          amountJpy: parsedAmount,
          note,
          grantedAt: `${grantDate}T00:00:00+09:00`,
        }),
      });
    } catch (error) {
      setState((currentState) => ({
        ...currentState,
        submitting: false,
        error:
          error instanceof Error
            ? `お小遣いの作成に失敗しました: ${error.message}`
            : "お小遣いの作成に失敗しました。",
        successMessage: "",
      }));
      return;
    }

    if (!response.ok) {
      const message = await parseApiError(response, "お小遣いの送信に失敗しました。");
      setState((currentState) => ({
        ...currentState,
        submitting: false,
        error: message,
        successMessage: "",
      }));
      return;
    }

    const sentGrant = await response.json().catch(() => null) as {
      grant?: { amount_jpy: number; child_display_label: string };
    } | null;

    const { data: grants, error: grantsError } = await fetchAllowanceGrants();

    setAmountJpy("");
    setNote("");
    setGrantDate(todayDateValue());

    if (grantsError) {
      setState((currentState) => ({
        ...currentState,
        submitting: false,
        error: `お小遣いは送りましたが一覧の再取得に失敗しました: ${grantsError.message}`,
        successMessage: "",
      }));
      if (sentGrant?.grant) {
        setGrantSentModal({
          amountJpy: sentGrant.grant.amount_jpy,
          childLabel: sentGrant.grant.child_display_label,
        });
      }
      return;
    }

    setState((currentState) => ({
      ...currentState,
      submitting: false,
      requestingCashGrantId: null,
      requestingInvestmentGrantId: null,
      error: "",
      successMessage: "",
      grants,
    }));
    setPendingChoice((currentValue) =>
      currentValue?.type === "grant_create" ? null : currentValue
    );
    if (sentGrant?.grant) {
      setGrantSentModal({
        amountJpy: sentGrant.grant.amount_jpy,
        childLabel: sentGrant.grant.child_display_label,
      });
    }
  };

  const executeRequestImmediateCash = async (grantId: string) => {
    setState((currentState) => ({
      ...currentState,
      requestingCashGrantId: grantId,
      requestingInvestmentGrantId: null,
      error: "",
      successMessage: "",
    }));

    let response: Response;

    try {
      const accessToken = await getAccessToken();
      response = await fetch("/api/allowance-decisions/immediate-cash", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ grantId }),
      });
    } catch (error) {
      setState((currentState) => ({
        ...currentState,
        requestingCashGrantId: null,
        error: error instanceof Error ? error.message : "すぐにもらう選択に失敗しました。",
        successMessage: "",
      }));
      return;
    }

    if (!response.ok) {
      const message = await parseApiError(response, "すぐにもらう選択に失敗しました。");
      setState((currentState) => ({
        ...currentState,
        requestingCashGrantId: null,
        error: message,
        successMessage: "",
      }));
      return;
    }

    const { data: grants, error: grantsError } = await fetchAllowanceGrants();

    if (grantsError) {
      setState((currentState) => ({
        ...currentState,
        requestingCashGrantId: null,
        error: `選択は保存されましたが一覧の再取得に失敗しました: ${grantsError.message}`,
        successMessage: "すぐにもらうを選びました。",
      }));
      return;
    }

    setState((currentState) => ({
      ...currentState,
      requestingCashGrantId: null,
      requestingInvestmentGrantId: null,
      error: "",
      successMessage: "すぐにもらうを選びました。家族へ通知しました。",
      grants,
    }));
    setPendingChoice(null);
  };

  const executeRequestInvestment = async (grantId: string, assetId: string) => {
    if (!assetId) {
      setState((currentState) => ({
        ...currentState,
        error: "投資先を選んでください。",
        successMessage: "",
      }));
      return;
    }

    setState((currentState) => ({
      ...currentState,
      requestingCashGrantId: null,
      requestingInvestmentGrantId: grantId,
      error: "",
      successMessage: "",
    }));

    const { error } = await supabase.rpc("request_investment_for_allowance", {
      target_allowance_grant_id: grantId,
      target_asset_id: assetId,
    });

    if (error) {
      setState((currentState) => ({
        ...currentState,
        requestingInvestmentGrantId: null,
        error: `投資する選択に失敗しました: ${error.message}`,
        successMessage: "",
      }));
      return;
    }

    const { data: grants, error: grantsError } = await fetchAllowanceGrants();

    if (grantsError) {
      setState((currentState) => ({
        ...currentState,
        requestingInvestmentGrantId: null,
        error: `選択は保存されましたが一覧の再取得に失敗しました: ${grantsError.message}`,
        successMessage: "投資するを選びました。",
      }));
      return;
    }

    setState((currentState) => ({
      ...currentState,
      requestingInvestmentGrantId: null,
      error: "",
      successMessage: "投資するを選びました。これから増え方を見られるようにしていきます。",
      grants,
    }));
    setPendingChoice(null);
  };

  const toggleCashoutGrant = (grantId: string) => {
    setSelectedCashoutGrantIds((currentValue) =>
      currentValue.includes(grantId)
        ? currentValue.filter((id) => id !== grantId)
        : [...currentValue, grantId]
    );
  };

  const toggleExpandedInvestmentGrant = (grantId: string) => {
    setExpandedInvestmentGrantIds((currentValue) =>
      currentValue.includes(grantId)
        ? currentValue.filter((id) => id !== grantId)
        : [...currentValue, grantId]
    );
  };

  const toggleExpandedGuardianGrant = (grantId: string) => {
    setExpandedGuardianGrantIds((currentValue) =>
      currentValue.includes(grantId)
        ? currentValue.filter((id) => id !== grantId)
        : [...currentValue, grantId]
    );
  };

  const executeRequestCashout = async () => {
    if (selectedCashoutGrantIds.length === 0) {
      setState((currentState) => ({
        ...currentState,
        error: "引き出すお小遣いを選んでください。",
        successMessage: "",
      }));
      return;
    }

    const guardianNames = [
      ...new Set(
        state.grants
          .filter((g) => selectedCashoutGrantIds.includes(g.id))
          .map((g) => g.granted_by_display_label)
      ),
    ];

    setState((currentState) => ({
      ...currentState,
      requestingCashout: true,
      error: "",
      successMessage: "",
    }));

    let response: Response;

    try {
      const accessToken = await getAccessToken();
      response = await fetch("/api/allowance-cashout-requests", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ grantIds: selectedCashoutGrantIds }),
      });
    } catch (error) {
      setState((currentState) => ({
        ...currentState,
        requestingCashout: false,
        error: error instanceof Error ? error.message : "引き出し申請に失敗しました。",
        successMessage: "",
      }));
      return;
    }

    if (!response.ok) {
      const message = await parseApiError(response, "引き出し申請に失敗しました。");
      setState((currentState) => ({
        ...currentState,
        requestingCashout: false,
        error: message,
        successMessage: "",
      }));
      return;
    }

    const { data: grants, error: grantsError } = await fetchAllowanceGrants();

    if (grantsError) {
      setState((currentState) => ({
        ...currentState,
        requestingCashout: false,
        error: `申請は保存されましたが一覧の再取得に失敗しました: ${grantsError.message}`,
        successMessage: "引き出し申請を送りました。",
      }));
      return;
    }

    setSelectedCashoutGrantIds([]);
    setState((currentState) => ({
      ...currentState,
      requestingCashout: false,
      error: "",
      successMessage: "",
      grants,
    }));
    setPendingChoice({ type: "cashout_sent", guardianNames });
  };

  const executeMarkCashoutPaid = async (requestId: string) => {
    setState((currentState) => ({
      ...currentState,
      markingPaidRequestId: requestId,
      error: "",
      successMessage: "",
    }));

    let response: Response;

    try {
      const accessToken = await getAccessToken();
      response = await fetch(`/api/allowance-cashout-requests/${requestId}/paid`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
    } catch (error) {
      setState((currentState) => ({
        ...currentState,
        markingPaidRequestId: null,
        error: error instanceof Error ? error.message : "支払い完了の保存に失敗しました。",
        successMessage: "",
      }));
      return;
    }

    if (!response.ok) {
      const message = await parseApiError(response, "支払い完了の保存に失敗しました。");
      setState((currentState) => ({
        ...currentState,
        markingPaidRequestId: null,
        error: message,
        successMessage: "",
      }));
      return;
    }

    const { data: grants, error: grantsError } = await fetchAllowanceGrants();

    if (grantsError) {
      setState((currentState) => ({
        ...currentState,
        markingPaidRequestId: null,
        error: `支払い完了は保存されましたが一覧の再取得に失敗しました: ${grantsError.message}`,
        successMessage: "子供にお金を払いました。",
      }));
      return;
    }

    setState((currentState) => ({
      ...currentState,
      markingPaidRequestId: null,
      error: "",
      successMessage: "支払い完了として記録しました。",
      grants,
    }));
    setPendingChoice(null);
  };

  const childMembers = state.members.filter((member) => member.role === "child");
  const canCreateGrant =
    state.membership?.role === "guardian_admin" || state.membership?.role === "guardian";
  const isChild = state.membership?.role === "child";
  const isElementaryChildMode = isChild && elementaryMode;
  const selectedGuardianChild =
    childMembers.find((member) => member.user_id === selectedChildId) ?? childMembers[0] ?? null;
  const activeGrants = state.grants.filter((grant) => !grant.cashout_status);
  const historyGrants = state.grants.filter((grant) => grant.cashout_status);
  const guardianVisibleGrants =
    !isChild && selectedGuardianChild
      ? state.grants.filter((grant) => grant.child_user_id === selectedGuardianChild.user_id)
      : state.grants;
  const guardianVisibleActiveGrants =
    !isChild && selectedGuardianChild
      ? activeGrants.filter((grant) => grant.child_user_id === selectedGuardianChild.user_id)
      : activeGrants;
  const childPendingGrants = activeGrants.filter((grant) => grant.decision_status === "pending");
  const childInvestedGrants = activeGrants.filter((grant) => grant.decision_status === "invested");
  const cashoutRequests = groupCashoutRequests(state.grants);
  const requestedCashoutGroups = cashoutRequests.filter((group) => group.status === "requested");
  const paidCashoutGroups = cashoutRequests.filter((group) => group.status === "paid");
  const guardianRequestedCashoutGroups =
    !isChild && selectedGuardianChild
      ? requestedCashoutGroups.filter((group) => {
          const forThisChild = group.grants.some(
            (grant) => grant.child_user_id === selectedGuardianChild.user_id
          );
          const ownedByMe =
            state.membership?.role === "guardian_admin" ||
            group.grants.some((grant) => grant.granted_by_user_id === state.userId);
          return forThisChild && ownedByMe;
        })
      : requestedCashoutGroups;
  const guardianPaidCashoutGroups =
    !isChild && selectedGuardianChild
      ? paidCashoutGroups.filter((group) =>
          group.grants.some((grant) => grant.child_user_id === selectedGuardianChild.user_id)
        )
      : paidCashoutGroups;
  const cashoutReadyGrants = activeGrants.filter(isCashoutReadyInvestment);
  const selectedCashoutTotal = cashoutReadyGrants
    .filter((grant) => selectedCashoutGrantIds.includes(grant.id))
    .reduce((total, grant) => total + getGrantMarketValue(grant), 0);
  const selectedCashoutGain = cashoutReadyGrants
    .filter((grant) => selectedCashoutGrantIds.includes(grant.id))
    .reduce((total, grant) => total + getGrantGain(grant), 0);
  const selectedCashoutPrincipal = cashoutReadyGrants
    .filter((grant) => selectedCashoutGrantIds.includes(grant.id))
    .reduce((total, grant) => total + grant.amount_jpy, 0);
  const pendingCount = activeGrants.filter((grant) => grant.decision_status === "pending").length;
  const guardianPendingDecisionCount = guardianVisibleActiveGrants.filter(
    (grant) => grant.decision_status === "pending"
  ).length;
  const totalMarketValue = activeGrants.reduce(
    (total, grant) => total + getGrantMarketValue(grant),
    0
  );
  const guardianTotalMarketValue = guardianVisibleActiveGrants.reduce(
    (total, grant) => total + getGrantMarketValue(grant),
    0
  );
  const investedPrincipal = activeGrants.reduce(
    (total, grant) =>
      grant.decision_status === "invested" ? total + grant.amount_jpy : total,
    0
  );
  const totalInvestmentGain = activeGrants.reduce(
    (total, grant) => total + getGrantGain(grant),
    0
  );
  const guardianInvestmentGain = guardianVisibleActiveGrants.reduce(
    (total, grant) => total + getGrantGain(grant),
    0
  );
  const totalInvestmentGainRate =
    investedPrincipal > 0 ? (totalInvestmentGain / investedPrincipal) * 100 : 0;
  const guardianVisibleInvestedPrincipal = guardianVisibleActiveGrants.reduce(
    (total, grant) =>
      grant.decision_status === "invested" ? total + grant.amount_jpy : total,
    0
  );
  const guardianInvestmentGainRate =
    guardianVisibleInvestedPrincipal > 0
      ? (guardianInvestmentGain / guardianVisibleInvestedPrincipal) * 100
      : 0;
  const totalInvestmentGainSign = totalInvestmentGain >= 0 ? "+" : "";
  const guardianInvestmentGainSign = guardianInvestmentGain >= 0 ? "+" : "";
  const guardianInvestmentGainTone =
    guardianInvestmentGain >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]";
  const guardianPaidTotal = guardianPaidCashoutGroups.reduce(
    (total, group) => total + group.amountJpy,
    0
  );
  const guardianInvestedTotal = guardianVisibleActiveGrants
    .filter((grant) => grant.decision_status === "invested")
    .reduce((total, grant) => total + getGrantMarketValue(grant), 0);
  const guardianImmediateCashTotal = guardianVisibleActiveGrants
    .filter((grant) => grant.decision_status === "immediate_cash_requested")
    .reduce((total, grant) => total + getGrantMarketValue(grant), 0);
  const historyPagination = paginate(historyGrants, historyPage);
  const guardianGrantsPagination = paginate(guardianVisibleGrants, activePage);
  const confirmingPaidGroup =
    pendingChoice?.type === "paid_confirm"
      ? guardianRequestedCashoutGroups.find((group) => group.requestId === pendingChoice.requestId) ??
        null
      : null;
  const selectedCashoutGainSign = selectedCashoutGain >= 0 ? "+" : "";
  const selectedCashoutGainTone =
    selectedCashoutGain >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]";
  const selectedCashoutGainRate =
    selectedCashoutPrincipal > 0 ? (selectedCashoutGain / selectedCashoutPrincipal) * 100 : 0;
  const selectedModalAsset =
    pendingChoice?.type === "investment_confirm"
      ? state.investmentAssets.find((asset) => asset.asset_id === pendingChoice.assetId) ?? null
      : null;
  const selectedInvestmentCategoryCode =
    pendingChoice?.type === "investment_category_select"
      ? selectedInvestmentCategories[pendingChoice.grantId] || "index_stock"
      : pendingChoice?.type === "investment_select" || pendingChoice?.type === "investment_confirm"
        ? pendingChoice.categoryCode
        : null;
  const availableInvestmentCategories = investmentCategories.filter((category) =>
    state.investmentAssets.some((asset) => asset.asset_category_code === category.code)
  );
  const selectedInvestmentCategory =
    selectedInvestmentCategoryCode !== null
      ? investmentCategories.find((category) => category.code === selectedInvestmentCategoryCode) ??
        null
      : null;
  const filteredInvestmentAssets =
    selectedInvestmentCategoryCode !== null
      ? state.investmentAssets.filter(
          (asset) => asset.asset_category_code === selectedInvestmentCategoryCode
        )
      : [];
  const selectedInvestmentAssetId =
    pendingChoice?.type === "investment_select"
      ? selectedInvestmentAssets[pendingChoice.grantId] || filteredInvestmentAssets[0]?.asset_id || ""
      : "";
  const selectedInvestmentAsset =
    pendingChoice?.type === "investment_select"
      ? filteredInvestmentAssets.find((asset) => asset.asset_id === selectedInvestmentAssetId) ?? null
      : null;

  return (
    <>
      <SectionCard
        title={isElementaryChildMode ? "おこづかい" : "お小遣い"}
        description={isChild ? undefined : "親が子どもへお小遣いを渡し、子どもはあとで受け取り方を選べます。"}
      >
      {state.loading ? (
        <p className="text-sm text-[var(--text-secondary)]">読み込み中です。</p>
      ) : !state.isAuthenticated ? (
        <div className="rounded-[28px] border border-[var(--border-soft)] bg-[linear-gradient(145deg,rgba(255,255,255,0.99),rgba(241,250,243,0.96))] p-5 shadow-[0_14px_30px_rgba(51,101,63,0.08)]">
          <div className="flex items-start gap-4">
            <DashboardIcon>
              <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current" strokeWidth="1.8">
                <path d="M7 10.5V7.8A4.8 4.8 0 0 1 11.8 3h.4A4.8 4.8 0 0 1 17 7.8v2.7" />
                <rect x="5" y="10" width="14" height="11" rx="2" />
                <path d="M12 14v3" />
              </svg>
            </DashboardIcon>
            <div>
              <p className="text-xl font-extrabold text-[var(--text-primary)]">
                ログイン画面へ移動しています
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                うまく切り替わらない場合は、少し待ってからもう一度お試しください。
              </p>
            </div>
          </div>
        </div>
      ) : !state.membership ? (
        <div className="rounded-[28px] border border-[var(--border-soft)] bg-[linear-gradient(145deg,rgba(255,255,255,0.99),rgba(241,250,243,0.96))] p-5 shadow-[0_14px_30px_rgba(51,101,63,0.08)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <DashboardIcon>
                <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current" strokeWidth="1.8">
                  <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-5.5h-5V21H5a1 1 0 0 1-1-1z" />
                </svg>
              </DashboardIcon>
              <div>
                <p className="text-xl font-extrabold text-[var(--text-primary)]">
                  まずは家族設定をはじめましょう
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                  家族を作って子どもを追加すると、お小遣いの管理や投資の見守りを始められます。
                </p>
              </div>
            </div>
            <Link
              href="/family"
              className="inline-flex min-h-12 items-center justify-center rounded-[20px] bg-[var(--brand-primary)] px-5 py-3 text-base font-bold text-white shadow-[0_10px_24px_rgba(51,101,63,0.2)]"
            >
              家族設定を開く
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {state.successMessage ? (
            <p className="text-sm text-[var(--success)]">{state.successMessage}</p>
          ) : null}

          {state.error ? (
            <p className="text-sm text-[var(--danger)]">{state.error}</p>
          ) : null}

          {viewMode === "main" && !isChild ? (
            <>
              {childMembers.length === 0 ? (
                <div className="rounded-[28px] border border-[var(--border-soft)] bg-[linear-gradient(145deg,rgba(255,255,255,0.99),rgba(241,250,243,0.96))] p-5 shadow-[0_14px_30px_rgba(51,101,63,0.08)]">
                  <div className="flex items-start gap-4">
                    <DashboardIcon>
                      <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current" strokeWidth="1.8">
                        <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" />
                        <path d="M4 20a8 8 0 0 1 16 0" />
                        <path d="M18.5 8.5h4m-2-2v4" />
                      </svg>
                    </DashboardIcon>
                    <div className="min-w-0 flex-1">
                      <p className="text-xl font-extrabold text-[var(--text-primary)]">
                        子どもをまだ追加していません
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                        普段の名前の編集や子どもの追加はメニューの「家族設定」にまとめています。最初の準備だけ、ここから始められます。
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Link
                          href="/family"
                          className="inline-flex min-h-11 items-center justify-center rounded-[18px] border border-[var(--border-soft)] bg-white px-4 py-2.5 text-sm font-bold text-[var(--text-primary)] shadow-[0_8px_18px_rgba(47,127,74,0.08)]"
                        >
                          家族設定を開く
                        </Link>
                        <Link
                          href="/family/invites"
                          className="inline-flex min-h-11 items-center justify-center rounded-[18px] bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-bold text-white shadow-[0_10px_24px_rgba(51,101,63,0.2)]"
                        >
                          子どもを追加する
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-[26px] border border-[var(--border-soft)] bg-[var(--surface-card-strong)] p-4 shadow-[0_14px_30px_rgba(51,101,63,0.08)]">
                  <div className="flex items-start gap-4">
                    <DashboardIcon>
                      <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current" strokeWidth="1.8">
                        <path d="M4 7h16M4 12h10M4 17h7" />
                        <circle cx="18" cy="12" r="2.5" />
                      </svg>
                    </DashboardIcon>
                    <div className="min-w-0 flex-1">
                      <p className="text-lg font-extrabold text-[var(--text-primary)]">
                        子どもを切り替える
                      </p>
                      <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
                        いま見たい子の状況だけを、ここで切り替えて確認できます。
                      </p>
                      <div className="-mx-1 mt-4 overflow-x-auto pb-1">
                        <div className="flex min-w-max gap-2 px-1">
                          {childMembers.map((member) => {
                            const isSelected = selectedGuardianChild?.user_id === member.user_id;

                            return (
                              <button
                                key={member.user_id}
                                type="button"
                                className={`rounded-full px-4 py-2.5 text-sm font-bold transition ${
                                  isSelected
                                    ? "bg-[var(--brand-primary)] text-white shadow-[0_10px_24px_rgba(51,101,63,0.2)]"
                                    : "border border-[var(--border-soft)] bg-white text-[var(--text-primary)]"
                                }`}
                                onClick={() => {
                                  setSelectedChildId(member.user_id);
                                  setActivePage(1);
                                }}
                              >
                                {member.display_label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      {canCreateGrant ? (
                        <div className="mt-4">
                          <PrimaryButton
                            type="button"
                            size="sm"
                            fullWidth={false}
                            onClick={() => setPendingChoice({ type: "grant_create" })}
                          >
                            ＋ お小遣いをあげる
                          </PrimaryButton>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              )}

              {childMembers.length === 0 ? (
                <EmptyState
                  title="まだ子どもメンバーがいません"
                  description="子どもを招待して参加が完了すると、ここが管理ダッシュボードになります。"
                />
              ) : selectedGuardianChild ? (
                <>
                  <div className="rounded-[28px] border border-[rgba(76,163,104,0.16)] bg-[linear-gradient(145deg,rgba(233,248,239,0.98),rgba(255,255,255,0.98))] p-5 shadow-[0_16px_36px_rgba(51,101,63,0.1)]">
                    <div className="flex items-start gap-4">
                      <DashboardIcon tone="success">
                        <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current" strokeWidth="1.8">
                          <path d="M4 8h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
                          <path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </DashboardIcon>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold tracking-[0.04em] text-[var(--text-secondary)]">
                          {selectedGuardianChild.display_label}のお小遣い
                        </p>
                        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-[var(--text-secondary)]">現在の総額</p>
                            <p className="mt-2 text-[2.8rem] font-black leading-none text-[var(--text-primary)]">
                              {formatCurrency(guardianTotalMarketValue)}
                            </p>
                          </div>
                          <div className="rounded-[20px] bg-white/75 px-4 py-3 lg:min-w-[240px]">
                            <p className="text-xs font-semibold tracking-[0.08em] text-[var(--text-muted)]">
                              評価損益
                            </p>
                            <p className={`mt-1 text-2xl font-black ${guardianInvestmentGainTone}`}>
                              {guardianInvestmentGainSign}
                              {formatCurrency(guardianInvestmentGain)}
                            </p>
                            <p className={`mt-1 text-base font-bold ${guardianInvestmentGainTone}`}>
                              {guardianInvestmentGainSign}
                              {formatGainRate(guardianInvestmentGainRate)}%
                            </p>
                          </div>
                        </div>
                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                          <div className="rounded-[18px] bg-white/72 px-4 py-3">
                            <p className="text-xs font-semibold tracking-[0.08em] text-[var(--text-muted)]">
                              内訳: 投資中
                            </p>
                            <p className="mt-2 text-xl font-bold text-[var(--text-primary)]">
                              {formatCurrency(guardianInvestedTotal)}
                            </p>
                          </div>
                          <div className="rounded-[18px] bg-white/72 px-4 py-3">
                            <p className="text-xs font-semibold tracking-[0.08em] text-[var(--text-muted)]">
                              内訳: すぐにもらう予定
                            </p>
                            <p className="mt-2 text-xl font-bold text-[var(--text-primary)]">
                              {formatCurrency(guardianImmediateCashTotal)}
                            </p>
                          </div>
                          <div className="rounded-[18px] bg-white/72 px-4 py-3">
                            <p className="text-xs font-semibold tracking-[0.08em] text-[var(--text-muted)]">
                              内訳: 支払い済み
                            </p>
                            <p className="mt-2 text-xl font-bold text-[var(--text-primary)]">
                              {formatCurrency(guardianPaidTotal)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {guardianRequestedCashoutGroups.length > 0 || state.priceRefreshInfo?.status === "failed" ? (
                    <div className="rounded-[28px] border border-[rgba(239,172,192,0.28)] bg-[linear-gradient(135deg,rgba(255,239,245,0.98),rgba(255,250,238,0.98))] p-5 shadow-[0_18px_44px_rgba(168,72,101,0.16)]">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex items-start gap-4">
                          <DashboardIcon tone="danger">
                            <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current" strokeWidth="1.8">
                              <path d="M12 9v4" />
                              <path d="M12 17h.01" />
                              <path d="M10.3 4.8 3.8 16a2 2 0 0 0 1.7 3h13a2 2 0 0 0 1.7-3L13.7 4.8a2 2 0 0 0-3.4 0Z" />
                            </svg>
                          </DashboardIcon>
                          <p className="text-xl font-black text-[var(--danger)]">やること</p>
                          <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
                            親がいま対応したいものだけをまとめています。
                          </p>
                        </div>
                        <StatusBadge tone="danger">
                          {guardianRequestedCashoutGroups.length +
                            (state.priceRefreshInfo?.status === "failed" ? 1 : 0)}
                          件
                        </StatusBadge>
                      </div>
                      <div className="mt-4 grid gap-3">
                        {guardianRequestedCashoutGroups.map((group) => (
                          <div
                            key={group.requestId}
                            className="rounded-[22px] border border-[rgba(239,172,192,0.24)] bg-[rgba(255,255,255,0.82)] px-4 py-4"
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="text-base font-bold text-[var(--text-primary)]">
                                  {group.childLabel}から引き出し申請
                                </p>
                                <p className="mt-1 text-2xl font-black text-[var(--text-primary)]">
                                  {formatCurrency(group.amountJpy)}
                                </p>
                                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                                  申請日: {group.requestedAt ? formatGrantDateLabel(group.requestedAt) : "未取得"}
                                </p>
                              </div>
                              <PrimaryButton
                                type="button"
                                size="sm"
                                fullWidth={false}
                                onClick={() =>
                                  setPendingChoice({ type: "paid_confirm", requestId: group.requestId })
                                }
                                disabled={state.markingPaidRequestId === group.requestId}
                              >
                                {state.markingPaidRequestId === group.requestId
                                  ? "記録中..."
                                  : "支払い済みにする"}
                              </PrimaryButton>
                            </div>
                          </div>
                        ))}
                        {state.priceRefreshInfo?.status === "failed" ? (
                          <div className="rounded-[22px] border border-[rgba(239,172,192,0.24)] bg-[rgba(255,255,255,0.82)] px-4 py-4">
                            <p className="text-base font-bold text-[var(--text-primary)]">
                              価格更新の確認が失敗しました
                            </p>
                            <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
                              {state.priceRefreshInfo.message ?? "次のアクセス時に再確認されます。"}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {guardianPendingDecisionCount > 0 ? (
                    <div className="rounded-[24px] border border-[rgba(241,201,116,0.28)] bg-[linear-gradient(145deg,rgba(255,249,235,0.98),rgba(255,255,255,0.98))] p-4 shadow-[0_14px_30px_rgba(188,148,61,0.08)]">
                      <div className="flex items-start gap-4">
                        <DashboardIcon tone="warning">
                          <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current" strokeWidth="1.8">
                            <path d="M12 8v5" />
                            <path d="M12 17h.01" />
                            <circle cx="12" cy="12" r="9" />
                          </svg>
                        </DashboardIcon>
                        <div>
                          <p className="text-lg font-extrabold text-[var(--text-primary)]">お知らせ</p>
                          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                            {selectedGuardianChild.display_label}
                            がまだ受け取り方を決めていないお小遣いが
                            {guardianPendingDecisionCount}件あります。
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="rounded-[26px] border border-[var(--border-soft)] bg-[var(--surface-card-strong)] p-4 shadow-[0_14px_30px_rgba(51,101,63,0.08)]">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                      <div className="flex items-start gap-4">
                        <DashboardIcon>
                          <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current" strokeWidth="1.8">
                            <path d="M5 6h14" />
                            <path d="M5 12h14" />
                            <path d="M5 18h10" />
                          </svg>
                        </DashboardIcon>
                        <p className="text-xl font-extrabold text-[var(--text-primary)]">
                          詳細
                        </p>
                      </div>
                      <div className="sm:max-w-[360px]">
                        <p className="text-sm leading-6 text-[var(--text-secondary)]">
                          必要なときだけ開ける一覧です。状態と評価額をコンパクトにまとめています。
                        </p>
                      </div>
                      <div className="rounded-[18px] bg-[var(--surface-soft)] px-4 py-3">
                        <p className="text-xs font-semibold tracking-[0.08em] text-[var(--text-muted)]">
                          この子にあげたお小遣い
                        </p>
                        <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">
                          {guardianVisibleGrants.length}件
                        </p>
                      </div>
                    </div>

                    {guardianVisibleGrants.length === 0 ? (
                      <div className="mt-4">
                        <EmptyState
                          title="まだこの子へのお小遣いがありません"
                          description="「＋ お小遣いをあげる」から追加すると、ここに並びます。"
                        />
                      </div>
                    ) : (
                      <div className="mt-4 grid gap-3">
                        {guardianGrantsPagination.items.map((grant) => {
                          const isExpanded = expandedGuardianGrantIds.includes(grant.id);
                          const currentValue =
                            grant.cashout_status === "paid"
                              ? grant.cashout_requested_amount_jpy ?? getGrantMarketValue(grant)
                              : getGrantMarketValue(grant);
                          const gain =
                            grant.cashout_status === "paid"
                              ? (grant.cashout_requested_amount_jpy ?? getGrantMarketValue(grant)) -
                                grant.amount_jpy
                              : getGrantGain(grant);
                          const gainRate = grant.amount_jpy > 0 ? (gain / grant.amount_jpy) * 100 : 0;
                          const gainTone =
                            gain >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]";
                          const statusLabel =
                            grant.cashout_status === "paid"
                              ? "支払い済み"
                              : formatGuardianGrantStatus(grant.decision_status);

                          return (
                            <div
                              key={grant.id}
                              className="overflow-hidden rounded-[22px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.86)]"
                            >
                              <div className="grid gap-3 px-4 py-4">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="text-xl font-black text-[var(--text-primary)]">
                                        {formatCurrency(grant.amount_jpy)}
                                      </p>
                                      <StatusBadge
                                        tone={guardianGrantStatusTone(
                                          grant.decision_status,
                                          grant.cashout_status
                                        )}
                                      >
                                        {statusLabel}
                                      </StatusBadge>
                                    </div>
                                    <p className="mt-1 text-sm text-[var(--text-secondary)]">
                                      付与日: {formatGrantDateLabel(grant.granted_at)}
                                    </p>
                                  </div>

                                  <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[340px]">
                                    <div>
                                      <p className="text-xs font-semibold tracking-[0.08em] text-[var(--text-muted)]">
                                        現在の評価額
                                      </p>
                                      <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">
                                        {formatCurrency(currentValue)}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-xs font-semibold tracking-[0.08em] text-[var(--text-muted)]">
                                        損益
                                      </p>
                                      <p className={`mt-1 text-lg font-bold ${gainTone}`}>
                                        {formatSignedCurrency(gain)}
                                        {" / "}
                                        {formatSignedPercent(gainRate)}
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  className="flex w-full items-center justify-between rounded-[16px] border border-[var(--border-soft)] bg-[rgba(243,251,244,0.72)] px-4 py-3 text-left text-sm font-semibold text-[var(--text-primary)]"
                                  onClick={() => toggleExpandedGuardianGrant(grant.id)}
                                  aria-expanded={isExpanded}
                                >
                                  <span>{isExpanded ? "詳細を閉じる" : "詳細を見る"}</span>
                                  <span className="text-base">{isExpanded ? "▲" : "▼"}</span>
                                </button>
                              </div>

                              {isExpanded ? (
                                <div className="border-t border-[rgba(84,130,95,0.12)] bg-[rgba(243,251,244,0.54)] px-4 py-4">
                                  <div className="grid gap-3 md:grid-cols-2">
                                    <div className="rounded-[18px] bg-white/80 px-4 py-3">
                                      <p className="text-xs font-semibold tracking-[0.08em] text-[var(--text-muted)]">
                                        基本情報
                                      </p>
                                      <div className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]">
                                        <p>付与日: {formatGrantDateLabel(grant.granted_at)}</p>
                                        <p>作成者: {grant.granted_by_display_label}</p>
                                        <p>状態: {statusLabel}</p>
                                        {grant.decision_asset_name ? (
                                          <p>投資先: {grant.decision_asset_name}</p>
                                        ) : null}
                                      </div>
                                    </div>
                                    <div className="rounded-[18px] bg-white/80 px-4 py-3">
                                      <p className="text-xs font-semibold tracking-[0.08em] text-[var(--text-muted)]">
                                        価格と評価
                                      </p>
                                      <div className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]">
                                        <p>
                                          元の価格:{" "}
                                          {grant.investment_unit_price_jpy !== null
                                            ? formatCurrency(grant.investment_unit_price_jpy)
                                            : "未取得"}
                                        </p>
                                        <p>
                                          現在の価格:{" "}
                                          {grant.latest_unit_price_jpy !== null
                                            ? formatCurrency(grant.latest_unit_price_jpy)
                                            : "未取得"}
                                        </p>
                                        <p>現在の評価額: {formatCurrency(currentValue)}</p>
                                        <p className={gainTone}>
                                          損益: {formatSignedCurrency(gain)} / {formatSignedPercent(gainRate)}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                  {grant.note ? (
                                    <div className="mt-3 rounded-[18px] bg-white/80 px-4 py-3">
                                      <p className="text-xs font-semibold tracking-[0.08em] text-[var(--text-muted)]">
                                        メモ
                                      </p>
                                      <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                                        {grant.note}
                                      </p>
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                        <PaginationControls
                          currentPage={guardianGrantsPagination.currentPage}
                          pageCount={guardianGrantsPagination.pageCount}
                          onPageChange={setActivePage}
                        />
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </>
          ) : null}

          {viewMode === "main" && isChild ? (
            <div className="space-y-5">
              <div className="overflow-hidden rounded-[32px] border border-[rgba(76,163,104,0.18)] bg-[linear-gradient(145deg,rgba(233,248,239,0.98),rgba(255,255,255,0.98))] p-5 shadow-[0_16px_36px_rgba(51,101,63,0.1)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold tracking-[0.04em] text-[var(--text-secondary)]">
                      {isElementaryChildMode ? "いまの おこづかい" : "いまのお小遣い"}
                    </p>
                    <p className="mt-2 text-[2.6rem] font-black leading-none text-[var(--text-primary)] sm:text-[3.2rem]">
                      {formatCurrency(totalMarketValue)}
                    </p>
                    <div className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-black whitespace-nowrap ${
                      totalInvestmentGain >= 0
                        ? "bg-[rgba(76,163,104,0.14)] text-[var(--success)]"
                        : "bg-[rgba(239,172,192,0.18)] text-[var(--danger)]"
                    }`}>
                      <span>{totalInvestmentGain >= 0 ? "↗" : "↘"}</span>
                      <span>{formatSignedCurrency(totalInvestmentGain)}</span>
                      <span>({totalInvestmentGainSign}{formatGainRate(totalInvestmentGainRate)}%)</span>
                    </div>
                  </div>
                  <div className="shrink-0">
                    <ChildAllowanceGraphic />
                  </div>
                </div>
              </div>

              {childPendingGrants.length === 0 && childInvestedGrants.length === 0 ? (
                <EmptyState
                  title={isElementaryChildMode ? "まだ おこづかいが ありません" : "まだお小遣いがありません"}
                  description={
                    isElementaryChildMode
                      ? "おやから おこづかいが とどくと、ここに でます。"
                      : "親からお小遣いが届くと、ここに表示されます。"
                  }
                />
              ) : null}

              {childPendingGrants.length > 0 && (
                <div className="space-y-3">
                  <div className="rounded-[26px] border border-[rgba(241,201,116,0.28)] bg-[linear-gradient(145deg,rgba(255,249,235,0.98),rgba(255,255,255,0.98))] p-4 shadow-[0_14px_30px_rgba(188,148,61,0.08)]">
                    <ChildSectionTitle
                      tone="warning"
                      icon={
                        <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current" strokeWidth="1.8">
                          <path d="M12 3 4 7v6c0 5 3.4 7.9 8 9 4.6-1.1 8-4 8-9V7Z" />
                          <path d="M12 9v4" />
                          <path d="M12 16h.01" />
                        </svg>
                      }
                      title={
                        isElementaryChildMode ? "まだ やっていないこと" : "まだやっていないこと"
                      }
                      description={
                        isElementaryChildMode
                          ? `まだ やることを きめていない おこづかいが ${pendingCount}けん あります。`
                          : `まだやることを決めていないお小遣いが${pendingCount}件あります。`
                      }
                    />
                  </div>
                  <div className="grid gap-3">
                    {childPendingGrants.map((grant) => (
                      <div
                        key={grant.id}
                        className="overflow-hidden rounded-[22px] border border-[rgba(241,201,116,0.22)] bg-white shadow-[0_10px_22px_rgba(188,148,61,0.08)]"
                      >
                        <div className="px-4 py-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <div className="mt-1 flex h-11 w-11 items-center justify-center rounded-[16px] bg-[rgba(241,201,116,0.16)] text-[rgb(154,112,17)]">
                                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8">
                                  <path d="M6 8h12v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2Z" />
                                  <path d="M9 8V6a3 3 0 0 1 6 0v2" />
                                </svg>
                              </div>
                              <div>
                              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                                {isElementaryChildMode ? "おこづかい" : "お小遣い"}
                              </p>
                              <p className="mt-1 text-2xl font-black text-[var(--text-primary)]">
                                {formatCurrency(grant.amount_jpy)}
                              </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                                {isElementaryChildMode ? "もらった ひ" : "付与日"}
                              </p>
                              <p className="mt-1 text-sm font-bold text-[var(--text-primary)]">
                                {formatGrantDateLabel(grant.granted_at)}
                              </p>
                            </div>
                          </div>
                          {grant.note ? (
                            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                              {grant.note}
                            </p>
                          ) : null}
                          <div className="mt-4 grid grid-cols-2 gap-2">
                            <PrimaryButton
                              type="button"
                              size="sm"
                              fullWidth={false}
                              onClick={() =>
                                setPendingChoice({ type: "immediate_cash", grantId: grant.id })
                              }
                              disabled={
                                state.requestingCashGrantId === grant.id ||
                                state.requestingInvestmentGrantId === grant.id
                              }
                            >
                              {state.requestingCashGrantId === grant.id ? (
                                isElementaryChildMode ? "えらんでいます..." : "選択中..."
                                ) : (
                                  <RubyText
                                    tokens={[
                                      { text: "すぐもらう" },
                                    ]}
                                  />
                                )}
                              </PrimaryButton>
                            <SecondaryButton
                              type="button"
                              size="sm"
                              onClick={() =>
                                setPendingChoice({
                                  type: "investment_category_select",
                                  grantId: grant.id,
                                })
                              }
                              disabled={
                                state.requestingCashGrantId === grant.id ||
                                state.requestingInvestmentGrantId === grant.id ||
                                state.investmentAssets.length === 0
                              }
                            >
                              {state.requestingInvestmentGrantId === grant.id ? (
                                isElementaryChildMode ? "えらんでいます..." : "選択中..."
                              ) : (
                                <RubyText
                                  tokens={
                                    isElementaryChildMode
                                      ? [{ text: "とうしする" }]
                                      : [
                                          { text: "投資", reading: "とうし" },
                                          { text: "する" },
                                        ]
                                  }
                                />
                              )}
                            </SecondaryButton>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-[26px] border border-[rgba(76,163,104,0.18)] bg-[rgba(243,251,244,0.72)] p-4 shadow-[0_12px_28px_rgba(51,101,63,0.08)]">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <ChildSectionTitle
                    tone="success"
                    icon={
                      <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current" strokeWidth="1.8">
                        <path d="M4 12h16" />
                        <path d="m13 5 7 7-7 7" />
                      </svg>
                    }
                    title={isElementaryChildMode ? "ひきだす とうしを えらぶ" : "引き出す投資を選ぶ"}
                    description={
                      isElementaryChildMode
                        ? "チェックした とうしぶんを、おやへ うけとりの おねがいに できます。"
                        : "チェックした投資分を、親へ受け取り申請できます。"
                    }
                  />
                  <div className="rounded-[20px] bg-white/80 px-4 py-3 sm:min-w-[220px]">
                    <p className="text-xs font-semibold tracking-[0.08em] text-[var(--text-muted)]">
                      {isElementaryChildMode ? "えらんでいる きんがく" : "選択中の金額"}
                    </p>
                    <p className="mt-1 text-2xl font-black text-[var(--text-primary)]">
                      {formatCurrency(selectedCashoutTotal)}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <PrimaryButton
                    type="button"
                    size="sm"
                    fullWidth={false}
                    onClick={() => setPendingChoice({ type: "cashout_confirm" })}
                    disabled={state.requestingCashout || selectedCashoutGrantIds.length === 0}
                  >
                    {state.requestingCashout
                      ? isElementaryChildMode
                        ? "おねがい中..."
                        : "申請中..."
                      : isElementaryChildMode
                        ? "えらんだ ものを ひきだす"
                        : "チェックしたものを引き出す"}
                  </PrimaryButton>
                </div>
              </div>

              {childInvestedGrants.length > 0 ? (
                <div className="space-y-3">
                  <ChildSectionTitle
                    icon={
                      <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current" strokeWidth="1.8">
                        <path d="M12 21V10" />
                        <path d="M7 14c0-3 2.2-5 5-5s5 2 5 5" />
                        <path d="M6 5h12" />
                      </svg>
                    }
                    title={
                      <RubyText
                        tokens={
                          isElementaryChildMode
                            ? [{ text: "とうししているもの" }]
                            : [
                                { text: "投資", reading: "とうし" },
                                { text: "中", reading: "ちゅう" },
                                { text: "のもの" },
                              ]
                        }
                      />
                    }
                    description={
                      isElementaryChildMode
                        ? "いま とうししていて、ふえたり へったりを みられる おこづかいです。"
                        : "いま投資していて、増え方や減り方を見られるお小遣いです。"
                    }
                  />
                  <div className="grid gap-3">
                    {childInvestedGrants.map((grant) => (
                      <div
                        key={grant.id}
                        className="overflow-hidden rounded-[24px] border border-[var(--border-soft)] bg-[var(--surface-card-strong)] shadow-[0_10px_22px_rgba(51,101,63,0.08)]"
                      >
                        {(() => {
                          const isExpanded = expandedInvestmentGrantIds.includes(grant.id);
                          const currentValue = grant.current_value_jpy ?? grant.amount_jpy;
                          const categoryCode = getInvestmentCategoryCodeForGrant(
                            grant,
                            state.investmentAssets
                          );
                          const gainTone =
                            grant.unrealized_gain_jpy !== null && grant.unrealized_gain_jpy < 0
                              ? "text-[var(--danger)]"
                              : "text-[var(--success)]";

                          return (
                            <>
                              <div className="px-4 py-4">
                                <div className="flex items-start gap-3">
                                  {isCashoutReadyInvestment(grant) ? (
                                    <label className="mt-1 flex shrink-0 cursor-pointer items-center justify-center">
                                      <input
                                        type="checkbox"
                                        className="h-6 w-6 rounded-md border border-[var(--border-soft)] accent-[var(--brand-blue)]"
                                        checked={selectedCashoutGrantIds.includes(grant.id)}
                                        onChange={() => toggleCashoutGrant(grant.id)}
                                        aria-label={
                                          isElementaryChildMode
                                            ? "この とうしを ひきだすものに いれる"
                                            : "この投資を引き出す候補に入れる"
                                        }
                                      />
                                    </label>
                                  ) : (
                                    <div className="h-6 w-6 shrink-0" />
                                  )}

                                  <div className="min-w-0 flex-1">
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-3">
                                        <InvestmentCategoryIcon categoryCode={categoryCode} />
                                        <div className="min-w-0">
                                          <p className="truncate text-[1.05rem] font-extrabold text-[var(--text-primary)]">
                                            {grant.decision_asset_name ?? "投資先"}
                                          </p>
                                          <p className="mt-0.5 text-[0.75rem] text-[var(--text-muted)]">
                                            {isElementaryChildMode ? "くれたひと" : "くれたひと"}：{grant.granted_by_display_label}
                                          </p>
                                        </div>
                                      </div>

                                      <div className="mt-3 grid grid-cols-[auto_1fr] items-end gap-x-4 gap-y-2 rounded-[18px] bg-[rgba(244,251,245,0.72)] px-3 py-3">
                                        <p className="text-[0.78rem] font-semibold text-[var(--text-secondary)]">
                                          {isElementaryChildMode ? "いまの きんがく" : "現在の価格"}
                                        </p>
                                        <p className="text-right text-[2rem] font-black leading-none text-[var(--text-primary)]">
                                          {formatCurrency(currentValue)}
                                        </p>
                                        <p className="text-[0.78rem] font-semibold text-[var(--text-secondary)]">
                                          {isElementaryChildMode ? "ふえた・へった" : "増減金額"}
                                        </p>
                                        <p className={`text-right text-base font-black ${gainTone}`}>
                                          {grant.unrealized_gain_jpy !== null
                                            ? formatSignedCurrency(grant.unrealized_gain_jpy)
                                            : "未取得"}
                                          {grant.unrealized_gain_rate !== null
                                            ? ` (${formatSignedPercent(grant.unrealized_gain_rate)})`
                                            : ""}
                                        </p>
                                      </div>

                                      <button
                                        type="button"
                                        className="mt-3 flex w-full items-center justify-between rounded-[16px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.72)] px-3 py-3 text-left text-sm font-semibold text-[var(--text-primary)]"
                                        onClick={() => toggleExpandedInvestmentGrant(grant.id)}
                                        aria-expanded={isExpanded}
                                      >
                                        <span>
                                          {isExpanded
                                            ? isElementaryChildMode
                                              ? "くわしい じょうほうを とじる"
                                              : "詳細を閉じる"
                                            : isElementaryChildMode
                                              ? "くわしい じょうほうを みる"
                                              : "詳細を見る"}
                                        </span>
                                        <span className="text-base">{isExpanded ? "▲" : "▼"}</span>
                                      </button>
                                    </div>

                                    {isExpanded ? (
                                      <div className="mt-3 space-y-3 rounded-[18px] bg-[linear-gradient(180deg,rgba(76,163,104,0.14),rgba(76,163,104,0.08))] px-3 py-3 text-sm text-[var(--text-secondary)]">
                                        {grant.note ? (
                                          <div className="rounded-[14px] bg-white/70 px-3 py-3">
                                            <p className="text-xs font-semibold tracking-[0.08em] text-[var(--text-muted)]">
                                              {isElementaryChildMode ? "メモ" : "投資説明"}
                                            </p>
                                            <p className="mt-1 leading-6 text-[var(--text-primary)]">
                                              {grant.note}
                                            </p>
                                          </div>
                                        ) : null}

                                        <div className="grid gap-3 lg:grid-cols-2">
                                          <div className="rounded-[16px] bg-white/75 px-3 py-3">
                                            <p className="text-xs font-semibold tracking-[0.08em] text-[var(--text-muted)]">
                                              {isElementaryChildMode
                                                ? "ねだんの くわしい ようす"
                                                : "価格推移の詳細"}
                                            </p>
                                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                              <div>
                                                <p className="text-xs font-semibold text-[var(--text-muted)]">
                                                  {isElementaryChildMode
                                                    ? "もらった ひ"
                                                    : "もらった年月日"}
                                                </p>
                                                <p className="mt-1 text-base font-bold text-[var(--text-primary)]">
                                                  {formatGrantDateLabel(grant.granted_at)}
                                                </p>
                                              </div>
                                              <div>
                                                <p className="text-xs font-semibold text-[var(--text-muted)]">
                                                  {isElementaryChildMode
                                                    ? "はじめの ねだん"
                                                    : "取得した日の価格"}
                                                </p>
                                                <p className="mt-1 text-base font-bold text-[var(--text-primary)]">
                                                  {grant.investment_unit_price_jpy !== null
                                                    ? formatCurrency(grant.investment_unit_price_jpy)
                                                    : "未取得"}
                                                </p>
                                                <p className="mt-1 text-xs text-[var(--text-muted)]">
                                                  {grant.investment_price_date
                                                    ? formatGrantDateLabel(grant.investment_price_date)
                                                    : "価格日なし"}
                                                </p>
                                              </div>
                                              <div>
                                                <p className="text-xs font-semibold text-[var(--text-muted)]">
                                                  {isElementaryChildMode ? "いまの ねだん" : "現在の価格"}
                                                </p>
                                                <p className="mt-1 text-base font-bold text-[var(--text-primary)]">
                                                  {grant.latest_unit_price_jpy !== null
                                                    ? formatCurrency(grant.latest_unit_price_jpy)
                                                    : "未取得"}
                                                </p>
                                                <p className="mt-1 text-xs text-[var(--text-muted)]">
                                                  {grant.latest_price_date
                                                    ? formatGrantDateLabel(grant.latest_price_date)
                                                    : "価格日なし"}
                                                </p>
                                              </div>
                                            </div>
                                          </div>

                                          <div className="rounded-[16px] bg-white/75 px-3 py-3">
                                            <p className="text-xs font-semibold tracking-[0.08em] text-[var(--text-muted)]">
                                              {isElementaryChildMode
                                                ? "あなたのおかねの くわしい ようす"
                                                : "投資額の詳細"}
                                            </p>
                                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                              <div>
                                                <p className="text-xs font-semibold text-[var(--text-muted)]">
                                                  {isElementaryChildMode
                                                    ? "いれた おかね"
                                                    : "入れた金額"}
                                                </p>
                                                <p className="mt-1 text-base font-bold text-[var(--text-primary)]">
                                                  {formatCurrency(grant.amount_jpy)}
                                                </p>
                                              </div>
                                              <div>
                                                <p className="text-xs font-semibold text-[var(--text-muted)]">
                                                  {isElementaryChildMode
                                                    ? "いまの ねだん"
                                                    : "現在の評価額"}
                                                </p>
                                                <p className="mt-1 text-base font-bold text-[var(--text-primary)]">
                                                  {formatCurrency(currentValue)}
                                                </p>
                                              </div>
                                            </div>
                                          </div>
                                        </div>

                                        <div className="rounded-[16px] border border-[rgba(84,130,95,0.12)] bg-white/70 px-3 py-3">
                                          <p className="text-xs font-semibold tracking-[0.08em] text-[var(--text-muted)]">
                                            {isElementaryChildMode
                                              ? "ほそく じょうほう"
                                              : "その他の補足情報"}
                                          </p>
                                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                            <div>
                                              <p className="text-xs font-semibold text-[var(--text-muted)]">
                                                {isElementaryChildMode
                                                  ? "さくせいした ひと"
                                                  : "作成者"}
                                              </p>
                                              <p className="mt-1 font-semibold text-[var(--text-primary)]">
                                                {grant.granted_by_display_label}
                                              </p>
                                            </div>
                                            <div>
                                              <p className="text-xs font-semibold text-[var(--text-muted)]">
                                                {isElementaryChildMode
                                                  ? "けいさんの もと"
                                                  : "評価額の計算"}
                                              </p>
                                              <p className="mt-1 font-semibold text-[var(--text-primary)]">
                                                {isElementaryChildMode
                                                  ? "いちばん あたらしい ねだんを つかっています"
                                                  : "最新価格を使って計算しています"}
                                              </p>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {viewMode === "history" && isChild && historyGrants.length === 0 ? (
            <EmptyState
              title={isElementaryChildMode ? "まだ うけとりきろくが ありません" : "まだ受け取り履歴がありません"}
              description={
                isElementaryChildMode
                  ? "とうしの ひきだしや うけとりが おわると、ここに でます。"
                  : "投資の引き出し申請や受け取りが完了すると、ここに履歴が表示されます。"
              }
            />
          ) : null}

          {viewMode === "history" && isChild && historyGrants.length > 0 ? (
            <div
              id="allowance-history"
              className="rounded-[28px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.68)] p-4"
            >
              <p className="text-lg font-bold text-[var(--text-primary)]">
                {isElementaryChildMode ? "これまでの うけとりきろく" : "過去の受け取り履歴"}
              </p>
              <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
                {isElementaryChildMode
                  ? "しんせいしたものや、うけとったものを ここで みられます。"
                  : "申請したもの、受け取り済みになったものをここで見られます。"}
              </p>
              <div className="mt-4 grid gap-3">
                {historyPagination.items.map((grant) => (
                  <div
                    key={grant.id}
                    className="rounded-[22px] border border-[var(--border-soft)] bg-[rgba(243,251,244,0.58)] px-4 py-3"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-[var(--text-secondary)]">
                          {grant.decision_asset_name
                            ? `${isElementaryChildMode ? "とうし" : "投資"}: ${grant.decision_asset_name}`
                            : isElementaryChildMode
                              ? "すぐもらう"
                              : "すぐにもらう"}
                        </p>
                        <p className="mt-1 text-xl font-bold text-[var(--text-primary)]">
                          {formatCurrency(
                            grant.cashout_requested_amount_jpy ?? getGrantMarketValue(grant)
                          )}
                        </p>
                      </div>
                      <StatusBadge tone={grant.cashout_status === "paid" ? "success" : "warning"}>
                        {grant.cashout_status === "paid"
                          ? isElementaryChildMode
                            ? "うけとった"
                            : "受け取り済み"
                          : isElementaryChildMode
                            ? "おねがい中"
                            : "申請中"}
                      </StatusBadge>
                    </div>
                  </div>
                ))}
              </div>
              <PaginationControls
                currentPage={historyPagination.currentPage}
                pageCount={historyPagination.pageCount}
                onPageChange={setHistoryPage}
              />
            </div>
          ) : null}

        </div>
      )}
      </SectionCard>

      {pendingChoice?.type === "grant_create" ? (
        <ChoiceModal
          title={[{ text: "お" }, { text: "小遣", reading: "こづか" }, { text: "いをあげる" }]}
          onClose={() => setPendingChoice(null)}
        >
          {childMembers.length === 0 ? (
            <EmptyState
              title="子どもメンバーがまだいません"
              description="子どもを招待して参加が完了すると、お小遣いを作成できます。"
            />
          ) : (
            <form onSubmit={handleSubmit} className="grid gap-4">
              <div>
                <p className="text-base font-bold text-[var(--text-primary)]">
                  だれに、いくら渡すかを決めます
                </p>
                <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
                  作成したお小遣いは、子どもがあとで「すぐにもらう / 投資する」を選べます。
                </p>
              </div>

              <SelectInput
                label="渡す子ども"
                name="childUserId"
                value={selectedChildId || childMembers[0]?.user_id || ""}
                onChange={(event) => setSelectedChildId(event.target.value)}
                required
              >
                {childMembers.map((member) => (
                  <option key={member.user_id} value={member.user_id}>
                    {member.display_label}
                  </option>
                ))}
              </SelectInput>

              <div className="grid gap-4 sm:grid-cols-2">
                <TextInput
                  label="金額"
                  hint="1円以上の整数で入力します。"
                  type="number"
                  min="1"
                  inputMode="numeric"
                  value={amountJpy}
                  onChange={(event) => setAmountJpy(event.target.value)}
                  placeholder="例: 1000"
                  required
                />
                <TextInput
                  label="付与日"
                  type="date"
                  value={grantDate}
                  onChange={(event) => setGrantDate(event.target.value)}
                  required
                />
              </div>

              <label className="flex flex-col gap-2 text-sm font-medium text-[var(--text-primary)]">
                <span>メモ</span>
                <span className="text-xs text-[var(--text-muted)]">
                  例: 5月分のお小遣い、読書チャレンジ達成など
                </span>
                <textarea
                  className="min-h-24 rounded-[var(--radius-md)] border border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,250,243,0.96))] px-4 py-3 text-[var(--text-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:ring-4 focus:ring-[var(--focus-ring)]"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="メモは空でも大丈夫です。"
                />
              </label>

              <div className="grid gap-2 sm:grid-cols-2">
                <PrimaryButton
                  type="submit"
                  disabled={state.submitting || amountJpy.trim().length === 0}
                >
                  {state.submitting ? "送っています..." : "お小遣いを送る"}
                </PrimaryButton>
                <SecondaryButton type="button" onClick={() => setPendingChoice(null)}>
                  キャンセル
                </SecondaryButton>
              </div>
            </form>
          )}
        </ChoiceModal>
      ) : null}

      {pendingChoice?.type === "cashout_confirm" ? (
        <ChoiceModal
          title={[
            { text: "引", reading: "ひ" },
            { text: "き" },
            { text: "出", reading: "だ" },
            { text: "しを" },
            { text: "申請", reading: "しんせい" },
            { text: "しますか？" },
          ]}
          onClose={() => setPendingChoice(null)}
        >
          <div className="space-y-4">
            <div className="rounded-[22px] bg-[rgba(243,251,244,0.82)] px-4 py-4">
              <p className="text-sm font-semibold text-[var(--text-secondary)]">申請する金額</p>
              <p className="mt-1 text-3xl font-black text-[var(--text-primary)]">
                {formatCurrency(selectedCashoutTotal)}
              </p>
              <div className="mt-3 rounded-[18px] bg-[rgba(255,255,255,0.76)] px-4 py-3">
                <p className="text-xs font-semibold text-[var(--text-muted)]">
                  投資で増えた分・減った分
                </p>
                <p className={`mt-1 text-2xl font-black ${selectedCashoutGainTone}`}>
                  {selectedCashoutGainSign}
                  {formatCurrency(selectedCashoutGain)}
                  {" "}
                  ({selectedCashoutGainSign}
                  {formatGainRate(selectedCashoutGainRate)}%)
                </p>
              </div>
            </div>
            <div className="max-h-48 space-y-2 overflow-auto rounded-[20px] border border-[var(--border-soft)] p-3">
              {cashoutReadyGrants
                .filter((grant) => selectedCashoutGrantIds.includes(grant.id))
                .map((grant) => {
                  const gain = getGrantGain(grant);
                  const gainSign = gain >= 0 ? "+" : "";
                  const gainTone = gain >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]";

                  return (
                    <div
                      key={grant.id}
                      className="rounded-[16px] bg-[rgba(255,255,255,0.72)] px-3 py-2 text-sm"
                    >
                      <p className="font-bold text-[var(--text-primary)]">
                        {grant.decision_asset_name ?? "投資"}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                        くれたひと：{grant.granted_by_display_label}
                      </p>
                      <p className="mt-1 text-[var(--text-secondary)]">
                        申請額: {formatCurrency(getGrantMarketValue(grant))}
                      </p>
                      <p className={`mt-1 font-bold ${gainTone}`}>
                        差分: {gainSign}
                        {formatCurrency(gain)}
                      </p>
                    </div>
                  );
                })}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <PrimaryButton
                type="button"
                onClick={executeRequestCashout}
                disabled={state.requestingCashout || selectedCashoutGrantIds.length === 0}
              >
                {state.requestingCashout ? "申請中..." : "はい"}
              </PrimaryButton>
              <SecondaryButton type="button" onClick={() => setPendingChoice(null)}>
                <RubyText tokens={cancelTokens()} />
              </SecondaryButton>
            </div>
          </div>
        </ChoiceModal>
      ) : null}

      {pendingChoice?.type === "cashout_sent" ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-4 sm:items-center sm:pb-0">
          <div className="w-full max-w-sm rounded-[32px] bg-white p-6 shadow-[0_24px_64px_rgba(0,0,0,0.18)] sm:p-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-[var(--surface-accent)]">
              <svg viewBox="0 0 24 24" className="h-8 w-8 fill-none stroke-[var(--brand-primary-strong)]" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M8 12l3 3 5-5" />
              </svg>
            </div>
            <h2 className="mt-4 text-xl font-bold text-[var(--text-primary)]">
              {isElementaryChildMode ? "ひきだし しんせいを しました" : "引き出し申請をしました"}
            </h2>
            <div className="mt-3 rounded-[20px] bg-[var(--surface-soft)] px-4 py-3">
              <p className="text-sm leading-6 text-[var(--text-secondary)]">
                {isElementaryChildMode
                  ? `つうちは いっていますが、まずは ${pendingChoice.guardianNames.join("・")} さんに しんせいしたことを つたえましょう。`
                  : `通知は行っていますが、まずは ${pendingChoice.guardianNames.join("・")} さんに申請したことを伝えましょう。`}
              </p>
            </div>
            <div className="mt-5">
              <PrimaryButton onClick={() => setPendingChoice(null)}>
                とじる
              </PrimaryButton>
            </div>
          </div>
        </div>
      ) : null}

      {pendingChoice?.type === "paid_confirm" && confirmingPaidGroup ? (
        <ChoiceModal
          title={[
            { text: "支払", reading: "しはら" },
            { text: "い" },
            { text: "完了", reading: "かんりょう" },
            { text: "として" },
            { text: "記録", reading: "きろく" },
            { text: "しますか？" },
          ]}
          onClose={() => setPendingChoice(null)}
        >
          <div className="space-y-4">
            <div className="rounded-[22px] bg-[linear-gradient(135deg,rgba(255,239,245,0.96),rgba(255,255,255,0.94))] px-4 py-4">
              <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center">
                <div className="overflow-hidden rounded-[18px] bg-white/70">
                  <Image
                    src="/assets/lp/payment-handover.png"
                    alt="親が子どもにお金を手渡ししているイメージ"
                    width={640}
                    height={320}
                    className="h-auto w-full object-cover"
                  />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--text-secondary)]">
                    {confirmingPaidGroup.childLabel} への支払い
                  </p>
                  <p className="mt-1 text-3xl font-black text-[var(--text-primary)]">
                    {formatCurrency(confirmingPaidGroup.amountJpy)}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                    実際に子どもへお金を渡したあとに押してください。押すと支払い実績へ移動します。
                  </p>
                </div>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <PrimaryButton
                type="button"
                onClick={() => executeMarkCashoutPaid(confirmingPaidGroup.requestId)}
                disabled={state.markingPaidRequestId === confirmingPaidGroup.requestId}
              >
                {state.markingPaidRequestId === confirmingPaidGroup.requestId
                  ? "記録中..."
                  : "はい、支払い済みにする"}
              </PrimaryButton>
              <SecondaryButton type="button" onClick={() => setPendingChoice(null)}>
                <RubyText tokens={cancelTokens()} />
              </SecondaryButton>
            </div>
          </div>
        </ChoiceModal>
      ) : null}

      {pendingChoice?.type === "immediate_cash" ? (
        <ChoiceModal
          title={immediateCashTitle(isElementaryChildMode)}
          onClose={() => setPendingChoice(null)}
        >
          <div className="space-y-4">
            <p className="text-sm leading-7 text-[var(--text-secondary)]">
              {isElementaryChildMode ? (
                "この おこづかいを いますぐ もらうことに します。"
              ) : (
                <RubyText
                  tokens={[
                    { text: "このお" },
                    { text: "小遣", reading: "こづか" },
                    { text: "いを" },
                    { text: "今", reading: "いま" },
                    { text: "すぐもらう" },
                    { text: "方法", reading: "ほうほう" },
                    { text: "で" },
                    { text: "決", reading: "き" },
                    { text: "めます。" },
                  ]}
                />
              )}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <PrimaryButton
                type="button"
                onClick={() => executeRequestImmediateCash(pendingChoice.grantId)}
                disabled={state.requestingCashGrantId === pendingChoice.grantId}
              >
                {state.requestingCashGrantId === pendingChoice.grantId ? (
                  "保存中..."
                ) : (
                  <RubyText tokens={yesTokens()} />
                )}
              </PrimaryButton>
              <SecondaryButton type="button" onClick={() => setPendingChoice(null)}>
                <RubyText tokens={cancelTokens()} />
              </SecondaryButton>
            </div>
          </div>
        </ChoiceModal>
      ) : null}

      {pendingChoice?.type === "investment_category_select" ? (
        <ChoiceModal
          title={investmentSelectTitle(isElementaryChildMode)}
          footer={
            <div className="grid gap-2 sm:grid-cols-2">
              <PrimaryButton
                type="button"
                disabled={!selectedInvestmentCategory}
                onClick={() => {
                  if (!selectedInvestmentCategory) {
                    return;
                  }

                  setPendingChoice({
                    type: "investment_select",
                    grantId: pendingChoice.grantId,
                    categoryCode: selectedInvestmentCategory.code,
                  });
                }}
              >
                <RubyText
                  tokens={
                    isElementaryChildMode
                      ? [{ text: "この ジャンルを みる" }]
                      : [
                          { text: "この" },
                          { text: "ジャンルを" },
                          { text: "見", reading: "み" },
                          { text: "る" },
                        ]
                  }
                />
              </PrimaryButton>
              <SecondaryButton type="button" onClick={() => setPendingChoice(null)}>
                <RubyText tokens={cancelTokens()} />
              </SecondaryButton>
            </div>
          }
          onClose={() => setPendingChoice(null)}
        >
          <div className="space-y-4">
            <div className="grid gap-3">
              {availableInvestmentCategories.map((category) => {
                const isSelected = selectedInvestmentCategoryCode === category.code;

                return (
                  <button
                    key={category.code}
                    type="button"
                    className={`rounded-[20px] border px-4 py-3 text-left transition ${
                      isSelected
                        ? "border-[var(--brand-blue)] bg-[rgba(76,163,104,0.16)]"
                        : "border-[var(--border-soft)] bg-[rgba(255,255,255,0.72)]"
                    }`}
                    onClick={() =>
                      setSelectedInvestmentCategories((currentValue) => ({
                        ...currentValue,
                        [pendingChoice.grantId]: category.code,
                      }))
                    }
                  >
                    <p className="font-bold text-[var(--text-primary)]">
                      {isElementaryChildMode ? category.elementaryName : category.name}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
                      {isElementaryChildMode
                        ? category.elementaryDescription
                        : category.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </ChoiceModal>
      ) : null}

      {pendingChoice?.type === "investment_select" ? (
        <ChoiceModal
          title={investmentAssetSelectTitle(isElementaryChildMode)}
          footer={
            <div className="grid gap-2 sm:grid-cols-2">
              <PrimaryButton
                type="button"
                disabled={!selectedInvestmentAsset}
                onClick={() => {
                  if (!selectedInvestmentAsset) {
                    return;
                  }

                  setPendingChoice({
                    type: "investment_confirm",
                    grantId: pendingChoice.grantId,
                    assetId: selectedInvestmentAsset.asset_id,
                    categoryCode: pendingChoice.categoryCode,
                  });
                }}
              >
                <RubyText
                  tokens={
                    isElementaryChildMode
                      ? [{ text: "この とうしさきを えらぶ" }]
                      : [
                          { text: "この" },
                          { text: "投資先", reading: "とうしさき" },
                          { text: "を" },
                          { text: "選", reading: "えら" },
                          { text: "ぶ" },
                        ]
                  }
                />
              </PrimaryButton>
              <SecondaryButton
                type="button"
                onClick={() =>
                  setPendingChoice({
                    type: "investment_category_select",
                    grantId: pendingChoice.grantId,
                  })
                }
              >
                <RubyText tokens={backTokens()} />
              </SecondaryButton>
            </div>
          }
          onClose={() => setPendingChoice(null)}
        >
          <div className="space-y-4">
            {selectedInvestmentCategory ? (
              <div className="rounded-[20px] bg-[rgba(76,163,104,0.12)] px-4 py-3 text-sm text-[var(--text-secondary)]">
                <p className="font-bold text-[var(--text-primary)]">
                  {isElementaryChildMode
                    ? selectedInvestmentCategory.elementaryName
                    : selectedInvestmentCategory.name}
                </p>
                <p className="mt-1 leading-6">
                  {isElementaryChildMode
                    ? selectedInvestmentCategory.elementaryDescription
                    : selectedInvestmentCategory.description}
                </p>
              </div>
            ) : null}
            <div className="grid gap-3">
              {filteredInvestmentAssets.map((asset) => {
                const isSelected = selectedInvestmentAssetId === asset.asset_id;

                return (
                  <button
                    key={asset.asset_id}
                    type="button"
                    className={`rounded-[20px] border px-4 py-3 text-left transition ${
                      isSelected
                        ? "border-[var(--brand-blue)] bg-[rgba(76,163,104,0.16)]"
                        : "border-[var(--border-soft)] bg-[rgba(255,255,255,0.72)]"
                    }`}
                    onClick={() =>
                      setSelectedInvestmentAssets((currentValue) => ({
                        ...currentValue,
                        [pendingChoice.grantId]: asset.asset_id,
                      }))
                    }
                  >
                    <p className="font-bold text-[var(--text-primary)]">{asset.asset_name}</p>
                    {asset.description ? (
                      <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                        {asset.description}
                      </p>
                    ) : null}
                    <div className="mt-2 grid gap-2 text-sm text-[var(--text-secondary)] sm:grid-cols-3">
                      <p>
                        <RubyText
                          tokens={
                            isElementaryChildMode
                              ? [{ text: "いまの ねだん" }]
                              : [
                                  { text: "今", reading: "いま" },
                                  { text: "の" },
                                  { text: "価格", reading: "かかく" },
                                ]
                          }
                        />
                        :{" "}
                        {asset.latest_unit_price_jpy !== null
                          ? formatCurrency(asset.latest_unit_price_jpy)
                          : "未取得"}
                      </p>
                      <p>
                        <RubyText
                          tokens={
                            isElementaryChildMode
                              ? [{ text: "きのうとの ちがい" }]
                              : [{ text: "前日比", reading: "ぜんじつひ" }]
                          }
                        />:{" "}
                        {formatAssetDailyChange(asset, isElementaryChildMode)}
                      </p>
                      <p>
                        <RubyText
                          tokens={
                            isElementaryChildMode
                              ? [{ text: "ねだんの ひ" }]
                              : [{ text: "価格日", reading: "かかくび" }]
                          }
                        />:{" "}
                        {asset.latest_price_date
                          ? new Date(asset.latest_price_date).toLocaleDateString("ja-JP")
                          : "未取得"}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </ChoiceModal>
      ) : null}

      {pendingChoice?.type === "investment_confirm" && selectedModalAsset ? (
        <ChoiceModal
          title={investmentConfirmTitle(selectedModalAsset.asset_name, isElementaryChildMode)}
          footer={
            <div className="grid gap-2 sm:grid-cols-2">
              <PrimaryButton
                type="button"
                onClick={() =>
                  executeRequestInvestment(pendingChoice.grantId, pendingChoice.assetId)
                }
                disabled={state.requestingInvestmentGrantId === pendingChoice.grantId}
              >
                {state.requestingInvestmentGrantId === pendingChoice.grantId ? (
                  "保存中..."
                ) : (
                  <RubyText tokens={yesTokens()} />
                )}
              </PrimaryButton>
              <SecondaryButton
                type="button"
                onClick={() =>
                  setPendingChoice({
                    type: "investment_select",
                    grantId: pendingChoice.grantId,
                    categoryCode: pendingChoice.categoryCode,
                  })
                }
              >
                <RubyText tokens={backTokens()} />
              </SecondaryButton>
            </div>
          }
          onClose={() => setPendingChoice(null)}
        >
          <div className="space-y-4">
            <div className="rounded-[20px] bg-[rgba(76,163,104,0.12)] px-4 py-3 text-sm text-[var(--text-secondary)]">
              <p className="font-bold text-[var(--text-primary)]">{selectedModalAsset.asset_name}</p>
              {selectedModalAsset.description ? (
                <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                  {selectedModalAsset.description}
                </p>
              ) : null}
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <p>
                  <RubyText
                    tokens={
                      isElementaryChildMode
                        ? [{ text: "いまの ねだん" }]
                        : [
                            { text: "今", reading: "いま" },
                            { text: "の" },
                            { text: "価格", reading: "かかく" },
                          ]
                    }
                  />
                  :{" "}
                  {selectedModalAsset.latest_unit_price_jpy !== null
                    ? formatCurrency(selectedModalAsset.latest_unit_price_jpy)
                    : "未取得"}
                </p>
                <p>
                  <RubyText
                    tokens={
                      isElementaryChildMode
                        ? [{ text: "きのうとの ちがい" }]
                        : [{ text: "前日比", reading: "ぜんじつひ" }]
                    }
                  />:{" "}
                  {formatAssetDailyChange(selectedModalAsset, isElementaryChildMode)}
                </p>
              </div>
            </div>
          </div>
        </ChoiceModal>
      ) : null}

      {grantSentModal ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-4 sm:items-center sm:pb-0">
          <div className="w-full max-w-sm rounded-[32px] bg-white p-6 shadow-[0_24px_64px_rgba(0,0,0,0.18)] sm:p-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-[var(--surface-accent)]">
              <svg viewBox="0 0 24 24" className="h-8 w-8 fill-none stroke-[var(--brand-primary-strong)]" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M8 12l3 3 5-5" />
              </svg>
            </div>
            <h2 className="mt-4 text-xl font-bold text-[var(--text-primary)]">
              お小遣いを送りました
            </h2>
            <div className="mt-3 rounded-[20px] bg-[var(--surface-soft)] px-4 py-3">
              <p className="text-sm text-[var(--text-secondary)]">
                {grantSentModal.childLabel} さんに
              </p>
              <p className="mt-1 text-2xl font-black text-[var(--text-primary)]">
                {formatCurrency(grantSentModal.amountJpy)}
              </p>
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
              子どもが「すぐにもらう」か「投資する」かを選ぶと通知が届きます。
            </p>
            <div className="mt-5">
              <PrimaryButton onClick={() => setGrantSentModal(null)}>
                とじる
              </PrimaryButton>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
