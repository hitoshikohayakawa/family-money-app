"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";
import useElementaryMode from "@/app/components/use-elementary-mode";
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
  submitting: boolean;
  requestingCashout: boolean;
  markingPaidRequestId: string | null;
  requestingCashGrantId: string | null;
  requestingInvestmentGrantId: string | null;
  error: string;
  successMessage: string;
  membership: FamilyMembership | null;
  members: FamilyMember[];
  grants: AllowanceGrant[];
  investmentAssets: InvestmentAssetOption[];
  priceRefreshInfo: PriceRefreshInfo | null;
};

type PendingChoice =
  | { type: "immediate_cash"; grantId: string }
  | { type: "investment_category_select"; grantId: string }
  | { type: "investment_select"; grantId: string; categoryCode: InvestmentCategoryCode }
  | {
      type: "investment_confirm";
      grantId: string;
      assetId: string;
      categoryCode: InvestmentCategoryCode;
    }
  | { type: "cashout_confirm" }
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

type InvestmentCategoryCode = "index_stock" | "single_stock" | "resource";

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
    name: "資源",
    description:
      "金や原油などの資源に関係するジャンルです。世界の出来事や景気で動きやすい特徴があります。",
    elementaryName: "しげん",
    elementaryDescription:
      "きんや げんゆなどの しげんに かんけいする ジャンルです。せかいのできごとで うごきやすい とくちょうが あります。",
  },
];

async function getAccessToken() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

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

function formatDecisionStatus(
  status: AllowanceGrant["decision_status"],
  elementaryMode = false
) {
  if (status === "immediate_cash_requested") {
    return elementaryMode ? "すぐもらうを えらんだ" : "すぐにもらう選択済み";
  }

  if (status === "invested") {
    return elementaryMode ? "とうしするを えらんだ" : "投資する選択済み";
  }

  return elementaryMode ? "まだ えらんでいない" : "未選択";
}

function decisionStatusTone(status: AllowanceGrant["decision_status"]) {
  if (status === "pending") {
    return "warning";
  }

  if (status === "invested") {
    return "info";
  }

  return "success";
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

function getGrantUnitPriceChange(grant: AllowanceGrant) {
  if (
    grant.decision_status !== "invested" ||
    grant.investment_unit_price_jpy === null ||
    grant.latest_unit_price_jpy === null
  ) {
    return null;
  }

  return grant.latest_unit_price_jpy - grant.investment_unit_price_jpy;
}

function getGrantUnitPriceChangeRate(grant: AllowanceGrant) {
  const unitPriceChange = getGrantUnitPriceChange(grant);

  if (unitPriceChange === null || !grant.investment_unit_price_jpy) {
    return null;
  }

  return (unitPriceChange / grant.investment_unit_price_jpy) * 100;
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

function ChoiceModal({
  title,
  children,
  onClose,
}: {
  title: RubyToken[];
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(16,28,54,0.36)] px-4 py-6"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-xl rounded-[32px] border border-[var(--border-soft)] bg-[var(--surface-card-strong)] p-5 shadow-[0_24px_70px_rgba(26,44,82,0.28)]">
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
        <div className="mt-4">{children}</div>
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

function formatDateTimeLabel(value: string) {
  return new Date(value).toLocaleString("ja-JP", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getPriceRefreshTone(info: PriceRefreshInfo) {
  if (info.status === "failed") {
    return "border-[rgba(239,172,192,0.4)] bg-[rgba(255,239,245,0.9)]";
  }

  if (info.status === "updated") {
    return "border-[rgba(133,201,162,0.4)] bg-[rgba(234,247,239,0.92)]";
  }

  return "border-[rgba(76,163,104,0.2)] bg-[rgba(244,248,255,0.9)]";
}

function getPriceRefreshLabel(info: PriceRefreshInfo, elementaryMode = false) {
  if (info.status === "failed") {
    return elementaryMode
      ? "ねだんの かくにんで エラーが ありました"
      : "価格の確認でエラーがありました";
  }

  if (info.status === "updated") {
    return elementaryMode ? "あたらしい ねだんに こうしんしました" : "最新価格を確認して更新しました";
  }

  return elementaryMode ? "あたらしい ねだんを たしかめました" : "最新価格は確認済みです";
}

function getPriceRefreshDescription(info: PriceRefreshInfo, elementaryMode = false) {
  if (info.status === "failed") {
    return elementaryMode
      ? info.message ?? "ねだんの こうしんに しっぱいしました。"
      : info.message ?? "価格の更新に失敗しました。";
  }

  if (info.status === "updated") {
    return [
      info.sourcePriceDate
        ? `${elementaryMode ? "あたらしい ねだんの ひ" : "最新価格日"}: ${info.sourcePriceDate}`
        : null,
      info.expectedBusinessDate
        ? `${elementaryMode ? "ひつような さいしんび" : "想定営業日"}: ${info.expectedBusinessDate}`
        : null,
    ]
      .filter(Boolean)
      .join(" / ");
  }

  if (info.reason === "already_up_to_date") {
    return [
      info.storedPriceDate
        ? `${elementaryMode ? "ほぞんずみの ねだんび" : "保存済み価格日"}: ${info.storedPriceDate}`
        : null,
      info.expectedBusinessDate
        ? `${elementaryMode ? "ひつような さいしんび" : "必要な最新日"}: ${info.expectedBusinessDate}`
        : null,
    ]
      .filter(Boolean)
      .join(" / ");
  }

  if (info.reason === "source_matches_latest_stored_price") {
    return [
      info.storedPriceDate
        ? `${elementaryMode ? "ほぞんずみの ねだんび" : "保存済み価格日"}: ${info.storedPriceDate}`
        : null,
      info.sourcePriceDate
        ? `${elementaryMode ? "とってきた ねだんび" : "取得ソース価格日"}: ${info.sourcePriceDate}`
        : null,
    ]
      .filter(Boolean)
      .join(" / ");
  }

  return elementaryMode ? "ねだんの とりなおしは いりませんでした。" : "価格の再取得は不要でした。";
}

type AllowanceGrantsPanelProps = {
  viewMode?: "main" | "history";
};

export default function AllowanceGrantsPanel({
  viewMode = "main",
}: AllowanceGrantsPanelProps) {
  const { elementaryMode } = useElementaryMode();
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
  const [pendingChoice, setPendingChoice] = useState<PendingChoice>(null);
  const [activePage, setActivePage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [paidPage, setPaidPage] = useState(1);
  const [state, setState] = useState<AllowanceState>({
    loading: true,
    submitting: false,
    requestingCashout: false,
    markingPaidRequestId: null,
    requestingCashGrantId: null,
    requestingInvestmentGrantId: null,
    error: "",
    successMessage: "",
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
      } = await supabase.auth.getSession();

      if (!isActive) {
        return;
      }

      if (sessionError) {
        setState({
          loading: false,
          submitting: false,
          requestingCashout: false,
          markingPaidRequestId: null,
          requestingCashGrantId: null,
          requestingInvestmentGrantId: null,
          error: "ログイン状態の確認に失敗しました。",
          successMessage: "",
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
          submitting: false,
          requestingCashout: false,
          markingPaidRequestId: null,
          requestingCashGrantId: null,
          requestingInvestmentGrantId: null,
          error: "",
          successMessage: "",
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
          submitting: false,
          requestingCashout: false,
          markingPaidRequestId: null,
          requestingCashGrantId: null,
          requestingInvestmentGrantId: null,
          error: `家族情報の取得に失敗しました: ${membershipError.message}`,
          successMessage: "",
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
          submitting: false,
          requestingCashout: false,
          markingPaidRequestId: null,
          requestingCashGrantId: null,
          requestingInvestmentGrantId: null,
          error: `家族メンバーの取得に失敗しました: ${membersResult.error.message}`,
          successMessage: "",
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
          submitting: false,
          requestingCashout: false,
          markingPaidRequestId: null,
          requestingCashGrantId: null,
          requestingInvestmentGrantId: null,
          error: `お小遣い一覧の取得に失敗しました: ${grantsResult.error.message}`,
          successMessage: "",
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
          submitting: false,
          requestingCashout: false,
          markingPaidRequestId: null,
          requestingCashGrantId: null,
          requestingInvestmentGrantId: null,
          error: `投資先一覧の取得に失敗しました: ${investmentAssetsResult.error.message}`,
          successMessage: "",
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
        error: "",
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
      const message = await parseApiError(response, "お小遣いの作成に失敗しました。");
      setState((currentState) => ({
        ...currentState,
        submitting: false,
        error: message,
        successMessage: "",
      }));
      return;
    }

    const { data: grants, error: grantsError } = await fetchAllowanceGrants();

    setAmountJpy("");
    setNote("");
    setGrantDate(todayDateValue());

    if (grantsError) {
      setState((currentState) => ({
        ...currentState,
        submitting: false,
        error: `お小遣いは作成されましたが一覧の再取得に失敗しました: ${grantsError.message}`,
        successMessage: "お小遣いを作成しました。",
      }));
      return;
    }

    setState((currentState) => ({
      ...currentState,
      submitting: false,
      requestingCashGrantId: null,
      requestingInvestmentGrantId: null,
      error: "",
      successMessage: "お小遣いを作成しました。子どもへ通知しました。",
      grants,
    }));
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

  const executeRequestCashout = async () => {
    if (selectedCashoutGrantIds.length === 0) {
      setState((currentState) => ({
        ...currentState,
        error: "引き出すお小遣いを選んでください。",
        successMessage: "",
      }));
      return;
    }

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
      successMessage: "引き出し申請を送りました。家族へ通知しました。",
      grants,
    }));
    setPendingChoice(null);
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
  const activeGrants = state.grants.filter((grant) => !grant.cashout_status);
  const historyGrants = state.grants.filter((grant) => grant.cashout_status);
  const childPendingGrants = activeGrants.filter((grant) => grant.decision_status === "pending");
  const childInvestedGrants = activeGrants.filter((grant) => grant.decision_status === "invested");
  const cashoutRequests = groupCashoutRequests(state.grants);
  const requestedCashoutGroups = cashoutRequests.filter((group) => group.status === "requested");
  const paidCashoutGroups = cashoutRequests.filter((group) => group.status === "paid");
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
  const totalMarketValue = activeGrants.reduce(
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
  const totalInvestmentGainRate =
    investedPrincipal > 0 ? (totalInvestmentGain / investedPrincipal) * 100 : 0;
  const totalInvestmentGainSign = totalInvestmentGain >= 0 ? "+" : "";
  const totalInvestmentGainTone =
    totalInvestmentGain >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]";
  const paidTotal = paidCashoutGroups.reduce((total, group) => total + group.amountJpy, 0);
  const paidPrincipal = paidCashoutGroups.reduce(
    (total, group) =>
      total + group.grants.reduce((grantTotal, grant) => grantTotal + grant.amount_jpy, 0),
    0
  );
  const paidGain = paidTotal - paidPrincipal;
  const paidGainRate = paidPrincipal > 0 ? (paidGain / paidPrincipal) * 100 : 0;
  const paidGainSign = paidGain >= 0 ? "+" : "";
  const paidGainTone = paidGain >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]";
  const activePagination = paginate(activeGrants, activePage);
  const historyPagination = paginate(historyGrants, historyPage);
  const paidPagination = paginate(paidCashoutGroups, paidPage);
  const confirmingPaidGroup =
    pendingChoice?.type === "paid_confirm"
      ? requestedCashoutGroups.find((group) => group.requestId === pendingChoice.requestId) ?? null
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
        description={
          isElementaryChildMode
            ? "おやから おこづかいが とどいたら、あとで もらいかたを えらべます。"
            : "親が子どもへお小遣いを渡し、子どもはあとで受け取り方を選べます。"
        }
      >
      {state.loading ? (
        <p className="text-sm text-[var(--text-secondary)]">読み込み中です。</p>
      ) : !state.membership ? (
        <EmptyState
          title="まだお小遣いを使えません"
          description="家族に参加すると、お小遣いの作成や確認ができるようになります。"
        />
      ) : (
        <div className="space-y-5">
          {state.priceRefreshInfo ? (
            <div
              className={`rounded-[20px] border px-4 py-3 ${getPriceRefreshTone(
                state.priceRefreshInfo
              )}`}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    {getPriceRefreshLabel(state.priceRefreshInfo, isElementaryChildMode)}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
                    {getPriceRefreshDescription(state.priceRefreshInfo, isElementaryChildMode)}
                  </p>
                </div>
                <p className="text-xs font-semibold text-[var(--text-muted)]">
                  {isElementaryChildMode ? "たしかめた じかん" : "確認時刻"}:{" "}
                  {formatDateTimeLabel(state.priceRefreshInfo.checkedAt)}
                </p>
              </div>
            </div>
          ) : null}

          {canCreateGrant && requestedCashoutGroups.length > 0 ? (
            <div className="rounded-[30px] border border-[rgba(239,172,192,0.35)] bg-[linear-gradient(135deg,rgba(255,239,245,0.98),rgba(255,250,238,0.98))] p-5 shadow-[0_18px_44px_rgba(168,72,101,0.16)]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xl font-black text-[var(--danger)]">
                    払い出し申請が届いています
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
                    子どもから受け取り申請が来ています。実際に渡したら記録しましょう。
                  </p>
                </div>
                <StatusBadge tone="danger">{requestedCashoutGroups.length}件</StatusBadge>
              </div>
              <div className="mt-4 grid gap-3">
                {requestedCashoutGroups.map((group) => (
                  <div
                    key={group.requestId}
                    className="rounded-[22px] border border-[rgba(239,172,192,0.24)] bg-[rgba(255,255,255,0.82)] px-4 py-3"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-[var(--text-secondary)]">
                          {group.childLabel}
                        </p>
                        <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">
                          {formatCurrency(group.amountJpy)}
                        </p>
                        <p className="mt-1 text-xs text-[var(--text-muted)]">
                          申請日:{" "}
                          {group.requestedAt
                            ? new Date(group.requestedAt).toLocaleDateString("ja-JP")
                            : "未取得"}
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
                          : "子供にお金を払いました"}
                      </PrimaryButton>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[22px] bg-[var(--surface-soft)] px-4 py-3">
              <p className="text-sm font-semibold text-[var(--text-secondary)]">未選択のお小遣い</p>
              <p className="mt-2 text-2xl font-bold text-[var(--text-primary)]">{pendingCount}</p>
            </div>
            <div className="rounded-[22px] bg-[var(--surface-accent)] px-4 py-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[var(--text-secondary)]">
                    今子供が貯めているお小遣い総額
                  </p>
                  <p className="mt-2 text-3xl font-bold text-[var(--text-primary)]">
                    {formatCurrency(totalMarketValue)}
                  </p>
                </div>
                <div className="rounded-[18px] bg-[rgba(255,255,255,0.68)] px-4 py-3 text-right">
                  <p className="text-xs font-semibold text-[var(--text-muted)]">評価損益</p>
                  <p className={`mt-1 text-xl font-bold ${totalInvestmentGainTone}`}>
                    {totalInvestmentGainSign}
                    {formatCurrency(totalInvestmentGain)}
                  </p>
                  <p className={`mt-0.5 text-sm font-semibold ${totalInvestmentGainTone}`}>
                    {totalInvestmentGainSign}
                    {formatGainRate(totalInvestmentGainRate)}%
                  </p>
                </div>
              </div>
            </div>
            {canCreateGrant ? (
              <div className="rounded-[22px] bg-[linear-gradient(135deg,rgba(230,247,238,0.96),rgba(243,251,244,0.96))] px-4 py-3 sm:col-span-2">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-secondary)]">
                      支払い済みのお小遣い総額
                    </p>
                    <p className="mt-2 text-3xl font-bold text-[var(--text-primary)]">
                      {formatCurrency(paidTotal)}
                    </p>
                  </div>
                  <div className="rounded-[18px] bg-[rgba(255,255,255,0.72)] px-4 py-3 text-right">
                    <p className="text-xs font-semibold text-[var(--text-muted)]">支払い時の損益</p>
                    <p className={`mt-1 text-xl font-bold ${paidGainTone}`}>
                      {paidGainSign}
                      {formatCurrency(paidGain)}
                    </p>
                    <p className={`mt-0.5 text-sm font-semibold ${paidGainTone}`}>
                      {paidGainSign}
                      {formatGainRate(paidGainRate)}%
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {canCreateGrant ? (
            <form
              onSubmit={handleSubmit}
              className="grid gap-4 rounded-[28px] border border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,250,243,0.94))] p-4 shadow-[0_14px_30px_rgba(51,101,63,0.08)]"
            >
              <div>
                <p className="text-base font-bold text-[var(--text-primary)]">子どもへお小遣いを作成</p>
                <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
                  未選択のお小遣いとして保存します。子どもはあとで「すぐにもらう / 投資する」を選べます。
                </p>
              </div>

              {childMembers.length === 0 ? (
                <EmptyState
                  title="子どもメンバーがまだいません"
                  description="子どもを招待して参加が完了すると、お小遣いを作成できます。"
                />
              ) : (
                <>
                  <SelectInput
                    label="お小遣いを渡す子ども"
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
                      className="min-h-24 rounded-[var(--radius-md)] border border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,250,243,0.96))] px-4 py-3 text-[var(--text-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--brand-blue)] focus:ring-4 focus:ring-[rgba(76,163,104,0.16)]"
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="メモは空でも大丈夫です。"
                    />
                  </label>

                  <PrimaryButton
                    type="submit"
                    disabled={state.submitting || amountJpy.trim().length === 0}
                  >
                    {state.submitting ? "お小遣いを作成しています..." : "お小遣いを作成する"}
                  </PrimaryButton>
                </>
              )}
            </form>
          ) : null}

          {state.successMessage ? (
            <p className="text-sm text-[var(--success)]">{state.successMessage}</p>
          ) : null}

          {state.error ? (
            <p className="text-sm text-[var(--danger)]">{state.error}</p>
          ) : null}

          {viewMode === "main" && isChild && cashoutReadyGrants.length > 0 ? (
            <div className="rounded-[28px] border border-[rgba(76,163,104,0.18)] bg-[rgba(243,251,244,0.72)] p-4">
              <p className="text-base font-bold text-[var(--text-primary)]">
                引き出す投資を選ぶ
              </p>
              <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
                チェックした投資分を、親へ受け取り申請できます。
              </p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  選択中: {formatCurrency(selectedCashoutTotal)}
                </p>
                <PrimaryButton
                  type="button"
                  size="sm"
                  fullWidth={false}
                  onClick={() => setPendingChoice({ type: "cashout_confirm" })}
                  disabled={state.requestingCashout || selectedCashoutGrantIds.length === 0}
                >
                  {state.requestingCashout ? "申請中..." : "チェックしたものを引き出す"}
                </PrimaryButton>
              </div>
            </div>
          ) : null}

          {viewMode === "main" && !isChild && activeGrants.length === 0 ? (
            <EmptyState
              title="まだお小遣いがありません"
              description={
                canCreateGrant
                  ? "お小遣いを作成すると、ここに履歴が並びます。"
                  : "親からお小遣いが届くと、ここに表示されます。"
              }
            />
          ) : null}

          {viewMode === "main" && !isChild ? (
            <div className="grid gap-3">
              {activePagination.items.map((grant) => (
                <div
                  key={grant.id}
                  className="overflow-hidden rounded-[24px] border border-[var(--border-soft)] bg-[var(--surface-card-strong)] shadow-[0_10px_22px_rgba(51,101,63,0.08)]"
                >
                  <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-secondary)]">
                        {canCreateGrant ? grant.child_display_label : "あなたへのお小遣い"}
                      </p>
                      <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">
                        {formatCurrency(grant.amount_jpy)}
                      </p>
                      {grant.note ? (
                        <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                          {grant.note}
                        </p>
                      ) : null}
                      {grant.decision_status === "invested" && grant.decision_asset_name ? (
                        <div className="mt-3 rounded-[20px] bg-[linear-gradient(180deg,rgba(76,163,104,0.14),rgba(76,163,104,0.08))] px-3 py-3 text-sm text-[var(--text-secondary)]">
                          <p className="font-semibold text-[var(--brand-blue)]">
                            投資先: {grant.decision_asset_name}
                          </p>
                          <div className="mt-3 grid gap-3 lg:grid-cols-2">
                            <div className="rounded-[18px] bg-[rgba(255,255,255,0.72)] px-3 py-3">
                              <p className="text-xs font-semibold tracking-[0.08em] text-[var(--text-muted)]">
                                ファンド価格の変化
                              </p>
                              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                <div>
                                  <p className="text-xs font-semibold text-[var(--text-muted)]">
                                    取得した日の価格
                                  </p>
                                  <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">
                                    {grant.investment_unit_price_jpy !== null
                                      ? formatCurrency(grant.investment_unit_price_jpy)
                                      : "未取得"}
                                  </p>
                                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                                    {grant.investment_price_date
                                      ? new Date(grant.investment_price_date).toLocaleDateString(
                                          "ja-JP"
                                        )
                                      : "価格日なし"}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-[var(--text-muted)]">
                                    今の価格
                                  </p>
                                  <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">
                                    {grant.latest_unit_price_jpy !== null
                                      ? formatCurrency(grant.latest_unit_price_jpy)
                                      : "未取得"}
                                  </p>
                                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                                    {grant.latest_price_date
                                      ? new Date(grant.latest_price_date).toLocaleDateString(
                                          "ja-JP"
                                        )
                                      : "価格日なし"}
                                  </p>
                                </div>
                              </div>
                              {getGrantUnitPriceChange(grant) !== null &&
                              getGrantUnitPriceChangeRate(grant) !== null ? (
                                <div className="mt-3 rounded-[14px] border border-[rgba(84,130,95,0.12)] bg-[rgba(244,251,245,0.92)] px-3 py-2">
                                  <p className="text-xs font-semibold text-[var(--text-muted)]">
                                    価格の増減
                                  </p>
                                  <p
                                    className={`mt-1 text-lg font-bold ${
                                      getGrantUnitPriceChange(grant)! >= 0
                                        ? "text-[var(--success)]"
                                        : "text-[var(--danger)]"
                                    }`}
                                  >
                                    {formatSignedCurrency(getGrantUnitPriceChange(grant)!)}
                                    {" / "}
                                    {formatSignedPercent(getGrantUnitPriceChangeRate(grant)!)}
                                  </p>
                                </div>
                              ) : null}
                            </div>

                            <div className="rounded-[18px] bg-[rgba(255,255,255,0.72)] px-3 py-3">
                              <p className="text-xs font-semibold tracking-[0.08em] text-[var(--text-muted)]">
                                あなたの投資の変化
                              </p>
                              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                <div>
                                  <p className="text-xs font-semibold text-[var(--text-muted)]">
                                    入れた金額
                                  </p>
                                  <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">
                                    {formatCurrency(grant.amount_jpy)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-[var(--text-muted)]">
                                    今の評価額
                                  </p>
                                  <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">
                                    {grant.current_value_jpy !== null
                                      ? formatCurrency(grant.current_value_jpy)
                                      : "未取得"}
                                  </p>
                                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                                    最新価格から計算
                                  </p>
                                </div>
                              </div>
                              {grant.current_value_jpy !== null &&
                              grant.unrealized_gain_jpy !== null ? (
                                <div className="mt-3 rounded-[14px] border border-[rgba(84,130,95,0.12)] bg-[rgba(244,251,245,0.92)] px-3 py-2">
                                  <p className="text-xs font-semibold text-[var(--text-muted)]">
                                    ふえた分・へった分
                                  </p>
                                  <p
                                    className={`mt-1 text-lg font-bold ${
                                      grant.unrealized_gain_jpy >= 0
                                        ? "text-[var(--success)]"
                                        : "text-[var(--danger)]"
                                    }`}
                                  >
                                    {formatSignedCurrency(grant.unrealized_gain_jpy)}
                                    {grant.unrealized_gain_rate !== null
                                      ? ` / ${formatSignedPercent(grant.unrealized_gain_rate)}`
                                      : ""}
                                  </p>
                                </div>
                              ) : null}
                            </div>
                          </div>

                          {grant.current_value_jpy !== null &&
                          grant.unrealized_gain_jpy !== null ? (
                            <div className="mt-3 grid gap-2 rounded-[16px] border border-[rgba(84,130,95,0.12)] bg-[rgba(255,255,255,0.64)] px-3 py-3 sm:grid-cols-3">
                              <div>
                                <p className="text-xs font-semibold text-[var(--text-muted)]">
                                  現在の評価額
                                </p>
                                <p className="mt-1 text-xl font-bold text-[var(--text-primary)]">
                                  {formatCurrency(grant.current_value_jpy)}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-[var(--text-muted)]">
                                  損益
                                </p>
                                <p
                                  className={`mt-1 text-xl font-bold ${
                                    grant.unrealized_gain_jpy >= 0
                                      ? "text-[var(--success)]"
                                      : "text-[var(--danger)]"
                                  }`}
                                >
                                  {formatSignedCurrency(grant.unrealized_gain_jpy)}
                                  {grant.unrealized_gain_rate !== null
                                    ? ` (${formatSignedPercent(grant.unrealized_gain_rate)})`
                                    : ""}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-[var(--text-muted)]">
                                  元本との差
                                </p>
                                <p className="mt-1 text-xl font-bold text-[var(--text-primary)]">
                                  {formatCurrency(grant.amount_jpy)}
                                  {" → "}
                                  {formatCurrency(grant.current_value_jpy)}
                                </p>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                      {isChild && isCashoutReadyInvestment(grant) ? (
                        <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-[18px] border border-[rgba(76,163,104,0.16)] bg-[rgba(255,255,255,0.72)] px-3 py-3 text-sm font-semibold text-[var(--text-primary)]">
                          <input
                            type="checkbox"
                            className="h-5 w-5 accent-[var(--brand-blue)]"
                            checked={selectedCashoutGrantIds.includes(grant.id)}
                            onChange={() => toggleCashoutGrant(grant.id)}
                          />
                          <span>この投資を引き出す候補に入れる</span>
                        </label>
                      ) : null}
                    </div>
                    <StatusBadge tone={decisionStatusTone(grant.decision_status)}>
                      {formatDecisionStatus(grant.decision_status)}
                    </StatusBadge>
                  </div>

                  {isChild && grant.decision_status === "pending" ? (
                    <div className="border-t border-[rgba(84,130,95,0.12)] px-4 py-3">
                      <div className="rounded-[20px] bg-[linear-gradient(180deg,rgba(253,244,223,0.96),rgba(255,255,255,0.94))] px-4 py-4">
                        <p className="text-sm font-bold text-[var(--text-primary)]">
                          <RubyText
                            tokens={[
                              { text: "このお" },
                              { text: "小遣", reading: "こづか" },
                              { text: "いをどうしますか？" },
                            ]}
                          />
                        </p>
                        <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
                          <RubyText
                            tokens={[
                              { text: "いま" },
                              { text: "受", reading: "う" },
                              { text: "け" },
                              { text: "取", reading: "と" },
                              { text: "るか、" },
                              { text: "投資", reading: "とうし" },
                              { text: "としてためるかを" },
                              { text: "選", reading: "えら" },
                              { text: "べます。" },
                            ]}
                          />
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
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
                              "選択中..."
                            ) : (
                              <RubyText tokens={[{ text: "すぐにもらう" }]} />
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
                              "選択中..."
                            ) : (
                              <RubyText tokens={[{ text: "投資", reading: "とうし" }, { text: "する" }]} />
                            )}
                          </SecondaryButton>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="grid gap-2 border-t border-[rgba(84,130,95,0.12)] bg-[rgba(243,251,244,0.54)] px-4 py-3 text-sm text-[var(--text-secondary)] sm:grid-cols-2">
                    <p>付与日: {new Date(grant.granted_at).toLocaleDateString("ja-JP")}</p>
                    <p>作成者: {grant.granted_by_display_label}</p>
                  </div>
                </div>
              ))}
              <PaginationControls
                currentPage={activePagination.currentPage}
                pageCount={activePagination.pageCount}
                onPageChange={setActivePage}
              />
            </div>
          ) : null}

          {viewMode === "main" && isChild ? (
            <div className="space-y-5">
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

              {childPendingGrants.length > 0 ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-xl font-extrabold text-[var(--text-primary)]">
                      <RubyText
                        tokens={
                          isElementaryChildMode
                            ? [{ text: "まだ えらんでいないもの" }]
                            : [
                                { text: "まだ" },
                                { text: "選択", reading: "せんたく" },
                                { text: "していないもの" },
                              ]
                        }
                      />
                    </p>
                    <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
                      {isElementaryChildMode
                        ? "いま もらうか、とうしするかを まだ きめていない おこづかいです。"
                        : "いま受け取るか、投資するかをまだ決めていないお小遣いです。"}
                    </p>
                  </div>
                  <div className="grid gap-3">
                    {childPendingGrants.map((grant) => (
                      <div
                        key={grant.id}
                        className="overflow-hidden rounded-[24px] border border-[var(--border-soft)] bg-[var(--surface-card-strong)] shadow-[0_10px_22px_rgba(51,101,63,0.08)]"
                      >
                        <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-[var(--text-secondary)]">
                              {isElementaryChildMode ? "あなたへの おこづかい" : "あなたへのお小遣い"}
                            </p>
                            <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">
                              {formatCurrency(grant.amount_jpy)}
                            </p>
                            {grant.note ? (
                              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                                {grant.note}
                              </p>
                            ) : null}
                          </div>
                          <StatusBadge tone={decisionStatusTone(grant.decision_status)}>
                            {formatDecisionStatus(grant.decision_status, isElementaryChildMode)}
                          </StatusBadge>
                        </div>

                        <div className="border-t border-[rgba(84,130,95,0.12)] px-4 py-3">
                          <div className="rounded-[20px] bg-[linear-gradient(180deg,rgba(253,244,223,0.96),rgba(255,255,255,0.94))] px-4 py-4">
                            <p className="text-sm font-bold text-[var(--text-primary)]">
                              <RubyText
                                tokens={
                                  isElementaryChildMode
                                    ? [{ text: "この おこづかいを どうする？" }]
                                    : [
                                        { text: "このお" },
                                        { text: "小遣", reading: "こづか" },
                                        { text: "いをどうしますか？" },
                                      ]
                                }
                              />
                            </p>
                            <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
                              {isElementaryChildMode ? (
                                "いま もらうか、とうしで ためるかを えらべます。"
                              ) : (
                                <RubyText
                                  tokens={[
                                    { text: "いま" },
                                    { text: "受", reading: "う" },
                                    { text: "け" },
                                    { text: "取", reading: "と" },
                                    { text: "るか、" },
                                    { text: "投資", reading: "とうし" },
                                    { text: "としてためるかを" },
                                    { text: "選", reading: "えら" },
                                    { text: "べます。" },
                                  ]}
                                />
                              )}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
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
                                      { text: isElementaryChildMode ? "すぐもらう" : "すぐにもらう" },
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

                        <div className="grid gap-2 border-t border-[rgba(84,130,95,0.12)] bg-[rgba(243,251,244,0.54)] px-4 py-3 text-sm text-[var(--text-secondary)] sm:grid-cols-2">
                          <p>付与日: {new Date(grant.granted_at).toLocaleDateString("ja-JP")}</p>
                          <p>作成者: {grant.granted_by_display_label}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {childInvestedGrants.length > 0 ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-xl font-extrabold text-[var(--text-primary)]">
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
                    </p>
                    <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
                      {isElementaryChildMode
                        ? "いま とうししていて、ふえたり へったりを みられる おこづかいです。"
                        : "いま投資していて、増え方や減り方を見られるお小遣いです。"}
                    </p>
                  </div>
                  <div className="grid gap-3">
                    {childInvestedGrants.map((grant) => (
                      <div
                        key={grant.id}
                        className="overflow-hidden rounded-[24px] border border-[var(--border-soft)] bg-[var(--surface-card-strong)] shadow-[0_10px_22px_rgba(51,101,63,0.08)]"
                      >
                        <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-[var(--text-secondary)]">
                              {isElementaryChildMode ? "あなたへの おこづかい" : "あなたへのお小遣い"}
                            </p>
                            <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">
                              {formatCurrency(grant.amount_jpy)}
                            </p>
                            {grant.note ? (
                              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                                {grant.note}
                              </p>
                            ) : null}
                            {grant.decision_asset_name ? (
                              <div className="mt-3 rounded-[20px] bg-[linear-gradient(180deg,rgba(76,163,104,0.14),rgba(76,163,104,0.08))] px-3 py-3 text-sm text-[var(--text-secondary)]">
                                <p className="font-semibold text-[var(--brand-blue)]">
                                  {isElementaryChildMode ? "とうしさき" : "投資先"}:{" "}
                                  {grant.decision_asset_name}
                                </p>
                                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                                  <div className="rounded-[18px] bg-[rgba(255,255,255,0.72)] px-3 py-3">
                                    <p className="text-xs font-semibold tracking-[0.08em] text-[var(--text-muted)]">
                                      {isElementaryChildMode
                                        ? "ねだんの うごき"
                                        : "ファンド価格の変化"}
                                    </p>
                                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                      <div>
                                        <p className="text-xs font-semibold text-[var(--text-muted)]">
                                          {isElementaryChildMode
                                            ? "はじめの ねだん"
                                            : "取得した日の価格"}
                                        </p>
                                        <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">
                                          {grant.investment_unit_price_jpy !== null
                                            ? formatCurrency(grant.investment_unit_price_jpy)
                                            : "未取得"}
                                        </p>
                                        <p className="mt-1 text-xs text-[var(--text-muted)]">
                                          {grant.investment_price_date
                                            ? new Date(grant.investment_price_date).toLocaleDateString(
                                                "ja-JP"
                                              )
                                            : "価格日なし"}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-xs font-semibold text-[var(--text-muted)]">
                                          {isElementaryChildMode ? "いまの ねだん" : "今の価格"}
                                        </p>
                                        <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">
                                          {grant.latest_unit_price_jpy !== null
                                            ? formatCurrency(grant.latest_unit_price_jpy)
                                            : "未取得"}
                                        </p>
                                        <p className="mt-1 text-xs text-[var(--text-muted)]">
                                          {grant.latest_price_date
                                            ? new Date(grant.latest_price_date).toLocaleDateString(
                                                "ja-JP"
                                              )
                                            : "価格日なし"}
                                        </p>
                                      </div>
                                    </div>
                                    {getGrantUnitPriceChange(grant) !== null &&
                                    getGrantUnitPriceChangeRate(grant) !== null ? (
                                      <div className="mt-3 rounded-[14px] border border-[rgba(84,130,95,0.12)] bg-[rgba(244,251,245,0.92)] px-3 py-2">
                                        <p className="text-xs font-semibold text-[var(--text-muted)]">
                                          {isElementaryChildMode
                                            ? "ねだんの ふえへり"
                                            : "価格の増減"}
                                        </p>
                                        <p
                                          className={`mt-1 text-lg font-bold ${
                                            getGrantUnitPriceChange(grant)! >= 0
                                              ? "text-[var(--success)]"
                                              : "text-[var(--danger)]"
                                          }`}
                                        >
                                          {formatSignedCurrency(getGrantUnitPriceChange(grant)!)}
                                          {" / "}
                                          {formatSignedPercent(
                                            getGrantUnitPriceChangeRate(grant)!
                                          )}
                                        </p>
                                      </div>
                                    ) : null}
                                  </div>

                                  <div className="rounded-[18px] bg-[rgba(255,255,255,0.72)] px-3 py-3">
                                    <p className="text-xs font-semibold tracking-[0.08em] text-[var(--text-muted)]">
                                      {isElementaryChildMode
                                        ? "あなたのおかねの うごき"
                                        : "あなたの投資の変化"}
                                    </p>
                                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                      <div>
                                        <p className="text-xs font-semibold text-[var(--text-muted)]">
                                          {isElementaryChildMode ? "いれた おかね" : "入れた金額"}
                                        </p>
                                        <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">
                                          {formatCurrency(grant.amount_jpy)}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-xs font-semibold text-[var(--text-muted)]">
                                          {isElementaryChildMode ? "いまの ねだん" : "今の評価額"}
                                        </p>
                                        <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">
                                          {grant.current_value_jpy !== null
                                            ? formatCurrency(grant.current_value_jpy)
                                            : "未取得"}
                                        </p>
                                        <p className="mt-1 text-xs text-[var(--text-muted)]">
                                          {isElementaryChildMode
                                            ? "いちばん あたらしい ねだんで けいさん"
                                            : "最新価格から計算"}
                                        </p>
                                      </div>
                                    </div>
                                    {grant.current_value_jpy !== null &&
                                    grant.unrealized_gain_jpy !== null ? (
                                      <div className="mt-3 rounded-[14px] border border-[rgba(84,130,95,0.12)] bg-[rgba(244,251,245,0.92)] px-3 py-2">
                                        <p className="text-xs font-semibold text-[var(--text-muted)]">
                                          ふえた分・へった分
                                        </p>
                                        <p
                                          className={`mt-1 text-lg font-bold ${
                                            grant.unrealized_gain_jpy >= 0
                                              ? "text-[var(--success)]"
                                              : "text-[var(--danger)]"
                                          }`}
                                        >
                                          {formatSignedCurrency(grant.unrealized_gain_jpy)}
                                          {grant.unrealized_gain_rate !== null
                                            ? ` / ${formatSignedPercent(
                                                grant.unrealized_gain_rate
                                              )}`
                                            : ""}
                                        </p>
                                      </div>
                                    ) : null}
                                  </div>
                                </div>

                                {grant.current_value_jpy !== null &&
                                grant.unrealized_gain_jpy !== null ? (
                                  <div className="mt-3 grid gap-2 rounded-[16px] border border-[rgba(84,130,95,0.12)] bg-[rgba(255,255,255,0.64)] px-3 py-3 sm:grid-cols-3">
                                    <div>
                                      <p className="text-xs font-semibold text-[var(--text-muted)]">
                                        {isElementaryChildMode ? "いまの ねだん" : "現在の評価額"}
                                      </p>
                                      <p className="mt-1 text-xl font-bold text-[var(--text-primary)]">
                                        {formatCurrency(grant.current_value_jpy)}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-xs font-semibold text-[var(--text-muted)]">
                                        {isElementaryChildMode ? "ふえたぶん / へったぶん" : "損益"}
                                      </p>
                                      <p
                                        className={`mt-1 text-xl font-bold ${
                                          grant.unrealized_gain_jpy >= 0
                                            ? "text-[var(--success)]"
                                            : "text-[var(--danger)]"
                                        }`}
                                      >
                                        {formatSignedCurrency(grant.unrealized_gain_jpy)}
                                        {grant.unrealized_gain_rate !== null
                                          ? ` (${formatSignedPercent(
                                              grant.unrealized_gain_rate
                                            )})`
                                          : ""}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-xs font-semibold text-[var(--text-muted)]">
                                        {isElementaryChildMode
                                          ? "もとの おかねとの ちがい"
                                          : "元本との差"}
                                      </p>
                                      <p className="mt-1 text-xl font-bold text-[var(--text-primary)]">
                                        {formatCurrency(grant.amount_jpy)}
                                        {" → "}
                                        {formatCurrency(grant.current_value_jpy)}
                                      </p>
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            ) : null}

                            {isCashoutReadyInvestment(grant) ? (
                              <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-[18px] border border-[rgba(76,163,104,0.16)] bg-[rgba(255,255,255,0.72)] px-3 py-3 text-sm font-semibold text-[var(--text-primary)]">
                                <input
                                  type="checkbox"
                                  className="h-5 w-5 accent-[var(--brand-blue)]"
                                  checked={selectedCashoutGrantIds.includes(grant.id)}
                                  onChange={() => toggleCashoutGrant(grant.id)}
                                />
                                <span>
                                  {isElementaryChildMode
                                    ? "この とうしを ひきだすものに いれる"
                                    : "この投資を引き出す候補に入れる"}
                                </span>
                              </label>
                            ) : null}
                          </div>
                          <StatusBadge tone={decisionStatusTone(grant.decision_status)}>
                            {formatDecisionStatus(grant.decision_status, isElementaryChildMode)}
                          </StatusBadge>
                        </div>

                        <div className="grid gap-2 border-t border-[rgba(84,130,95,0.12)] bg-[rgba(243,251,244,0.54)] px-4 py-3 text-sm text-[var(--text-secondary)] sm:grid-cols-2">
                          <p>付与日: {new Date(grant.granted_at).toLocaleDateString("ja-JP")}</p>
                          <p>作成者: {grant.granted_by_display_label}</p>
                        </div>
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

          {canCreateGrant && paidCashoutGroups.length > 0 ? (
            <div className="rounded-[28px] border border-[var(--border-soft)] bg-[rgba(243,251,244,0.58)] p-4">
              <p className="text-lg font-bold text-[var(--text-primary)]">累計支払い実績</p>
              <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
                「子供にお金を払いました」と記録した履歴です。
              </p>
              <div className="mt-4 grid gap-3">
                {paidPagination.items.map((group) => {
                  const groupPrincipal = group.grants.reduce(
                    (total, grant) => total + grant.amount_jpy,
                    0
                  );
                  const groupGain = group.amountJpy - groupPrincipal;
                  const groupGainRate =
                    groupPrincipal > 0 ? (groupGain / groupPrincipal) * 100 : 0;
                  const groupGainSign = groupGain >= 0 ? "+" : "";
                  const groupGainTone =
                    groupGain >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]";

                  return (
                  <div
                    key={group.requestId}
                    className="rounded-[22px] border border-[var(--border-soft)] bg-[rgba(255,255,255,0.72)] px-4 py-3"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-[var(--text-secondary)]">
                          {group.childLabel}
                        </p>
                        <p className="mt-1 text-xl font-bold text-[var(--text-primary)]">
                          {formatCurrency(group.amountJpy)}
                        </p>
                        <p className={`mt-1 text-sm font-bold ${groupGainTone}`}>
                          {groupGainSign}
                          {formatCurrency(groupGain)}
                          {" "}
                          ({groupGainSign}
                          {formatGainRate(groupGainRate)}%)
                        </p>
                        <p className="mt-1 text-xs text-[var(--text-muted)]">
                          支払い日:{" "}
                          {group.paidAt
                            ? new Date(group.paidAt).toLocaleDateString("ja-JP")
                            : "未取得"}
                        </p>
                      </div>
                      <StatusBadge tone="success">支払い済み</StatusBadge>
                    </div>
                  </div>
                  );
                })}
              </div>
              <PaginationControls
                currentPage={paidPagination.currentPage}
                pageCount={paidPagination.pageCount}
                onPageChange={setPaidPage}
              />
            </div>
          ) : null}
        </div>
      )}
      </SectionCard>

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
                {state.requestingCashout ? "申請中..." : "はい、申請する"}
              </PrimaryButton>
              <SecondaryButton type="button" onClick={() => setPendingChoice(null)}>
                <RubyText tokens={cancelTokens()} />
              </SecondaryButton>
            </div>
          </div>
        </ChoiceModal>
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
          </div>
        </ChoiceModal>
      ) : null}

      {pendingChoice?.type === "investment_select" ? (
        <ChoiceModal
          title={investmentAssetSelectTitle(isElementaryChildMode)}
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
          </div>
        </ChoiceModal>
      ) : null}

      {pendingChoice?.type === "investment_confirm" && selectedModalAsset ? (
        <ChoiceModal
          title={investmentConfirmTitle(selectedModalAsset.asset_name, isElementaryChildMode)}
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
          </div>
        </ChoiceModal>
      ) : null}
    </>
  );
}
