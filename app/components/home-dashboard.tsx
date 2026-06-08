"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AutoHiragana } from "@/app/components/auto-hiragana";
import useElementaryMode from "@/app/components/use-elementary-mode";
import { getSafeSession } from "@/lib/client-auth";
import { supabase } from "@/lib/supabase";
import { FAMILY_UPDATED_EVENT } from "@/lib/family-events";
import MemberAvatar from "@/app/components/ui/member-avatar";
import StatusBadge from "@/app/components/ui/status-badge";

// ─── Types ───────────────────────────────────────────────────────────────────

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

type GrantRow = {
  id: string;
  child_user_id: string;
  granted_by_user_id: string;
  amount_jpy: number;
  decision_status: string;
  current_value_jpy: number | null;
  unrealized_gain_jpy: number | null;
  cashout_status: string | null;
  cashout_requested_amount_jpy: number | null;
  granted_at: string;
  cashout_paid_at: string | null;
};

type HomeState = {
  loading: boolean;
  isAuthenticated: boolean;
  userId: string | null;
  email: string | null;
  displayName: string | null;
  role: string | null;
  familyId: string | null;
  familyName: string | null;
  members: FamilyMember[];
  grants: GrantRow[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(amount);
}

// ─── Chart helpers ────────────────────────────────────────────────────────────

type MonthlyEntry = {
  key: string;
  label: string;
  income: number;
  paid: number;
  balance: number;
};

function computeDonutData(grants: GrantRow[]) {
  let invested = 0;
  let received = 0;
  let pending = 0;
  for (const g of grants) {
    if (g.decision_status === "invested" && !g.cashout_status) {
      invested += g.current_value_jpy ?? g.amount_jpy;
    } else if (
      g.decision_status === "immediate_cash_requested" ||
      g.cashout_status === "requested" ||
      g.cashout_status === "paid"
    ) {
      received += g.cashout_requested_amount_jpy ?? g.amount_jpy;
    } else if (g.decision_status === "pending" && !g.cashout_status) {
      pending += g.amount_jpy;
    }
  }
  return { invested, received, pending };
}

function computeMonthlyData(grants: GrantRow[], totalAssets: number): MonthlyEntry[] {
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const months: { key: string; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = `${d.getMonth() + 1}月`;
    months.push({ key, label });
  }

  return months.map(({ key, label }) => {
    if (key === currentMonthKey) {
      // 当月は現在の実際の総資産（投資評価額含む）
      return { key, label, income: totalAssets, paid: 0, balance: totalAssets };
    }

    // 過去月：その月末時点での累積付与額 − 累積払い出し済み額
    let cumulativeGrants = 0;
    let cumulativeCashouts = 0;

    for (const g of grants) {
      if (g.granted_at.slice(0, 7) <= key) {
        cumulativeGrants += g.amount_jpy;
      }
      if (g.cashout_status === "paid" && g.cashout_paid_at) {
        if (g.cashout_paid_at.slice(0, 7) <= key) {
          cumulativeCashouts += g.cashout_requested_amount_jpy ?? 0;
        }
      }
    }

    const value = Math.max(0, cumulativeGrants - cumulativeCashouts);
    return { key, label, income: value, paid: 0, balance: value };
  });
}

// ─── SVG Chart components ─────────────────────────────────────────────────────

// Fritsch-Carlson monotone cubic spline segments
// Guarantees curves never overshoot between points (no dipping below flat sections)
type BezierSeg = {
  p0: { x: number; y: number };
  cp1: { x: number; y: number };
  cp2: { x: number; y: number };
  p1: { x: number; y: number };
};

function computeMonotoneSegments(pts: { x: number; y: number }[]): BezierSeg[] {
  const n = pts.length;
  if (n < 2) return [];

  // Step 1: slopes between consecutive points
  const slopes = pts.slice(0, -1).map((p, i) => {
    const dx = pts[i + 1].x - p.x;
    return dx === 0 ? 0 : (pts[i + 1].y - p.y) / dx;
  });

  // Step 2: tangents via three-point averaging
  const m: number[] = new Array(n);
  m[0] = slopes[0];
  m[n - 1] = slopes[n - 2];
  for (let i = 1; i < n - 1; i++) {
    // If sign changes → local extremum → flat tangent (prevents overshoot)
    m[i] = slopes[i - 1] * slopes[i] <= 0 ? 0 : (slopes[i - 1] + slopes[i]) / 2;
  }

  // Step 3: Fritsch-Carlson monotonicity constraint
  for (let i = 0; i < n - 1; i++) {
    if (slopes[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
    } else {
      const alpha = m[i] / slopes[i];
      const beta = m[i + 1] / slopes[i];
      const h = Math.sqrt(alpha * alpha + beta * beta);
      if (h > 3) {
        const scale = 3 / h;
        m[i] = scale * alpha * slopes[i];
        m[i + 1] = scale * beta * slopes[i];
      }
    }
  }

  // Step 4: convert tangents to cubic Bezier control points
  return pts.slice(0, -1).map((p, i) => {
    const dx = pts[i + 1].x - p.x;
    return {
      p0: p,
      cp1: { x: p.x + dx / 3, y: p.y + (m[i] * dx) / 3 },
      cp2: { x: pts[i + 1].x - dx / 3, y: pts[i + 1].y - (m[i + 1] * dx) / 3 },
      p1: pts[i + 1],
    };
  });
}

function buildSmoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0].x},${pts[0].y}`;
  const segs = computeMonotoneSegments(pts);
  let d = `M ${pts[0].x},${pts[0].y}`;
  for (const s of segs) {
    d += ` C ${s.cp1.x.toFixed(1)},${s.cp1.y.toFixed(1)} ${s.cp2.x.toFixed(1)},${s.cp2.y.toFixed(1)} ${s.p1.x.toFixed(1)},${s.p1.y.toFixed(1)}`;
  }
  return d;
}

function approximateBezierLength(pts: { x: number; y: number }[]): number {
  if (pts.length <= 1) return 0;
  const segs = computeMonotoneSegments(pts);
  const samples = 20;
  let total = 0;
  for (const seg of segs) {
    let prev = seg.p0;
    for (let s = 1; s <= samples; s++) {
      const tv = s / samples;
      const mt = 1 - tv;
      const curr = {
        x: mt ** 3 * seg.p0.x + 3 * mt ** 2 * tv * seg.cp1.x + 3 * mt * tv ** 2 * seg.cp2.x + tv ** 3 * seg.p1.x,
        y: mt ** 3 * seg.p0.y + 3 * mt ** 2 * tv * seg.cp1.y + 3 * mt * tv ** 2 * seg.cp2.y + tv ** 3 * seg.p1.y,
      };
      total += Math.sqrt((curr.x - prev.x) ** 2 + (curr.y - prev.y) ** 2);
      prev = curr;
    }
  }
  return total;
}

function DonutChart({
  invested,
  received,
  pending,
}: {
  invested: number;
  received: number;
  pending: number;
}) {
  const total = invested + received + pending;
  const r = 52;
  const cx = 70;
  const cy = 70;
  const circ = 2 * Math.PI * r;
  const gap = 3;

  const segments = [
    { value: invested, color: "#2F8F57" },
    { value: received, color: "#F5C97A" },
    { value: pending, color: "#B9DCF7" },
  ];

  let cumulative = 0;
  const arcs = segments.flatMap((seg, i) => {
    if (total === 0 || seg.value <= 0) return [];
    const ratio = seg.value / total;
    const dash = Math.max(0, ratio * circ - gap);
    if (dash <= 0) return [];
    const dashoffset = circ * 0.25 - cumulative;
    cumulative += ratio * circ;
    return [
      <circle
        key={i}
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={seg.color}
        strokeWidth={15}
        strokeDasharray={`${dash} ${circ}`}
        strokeDashoffset={dashoffset}
        strokeLinecap="butt"
      />,
    ];
  });

  return (
    <svg
      viewBox="0 0 140 140"
      style={{ width: "140px", height: "140px", flexShrink: 0 }}
      aria-hidden="true"
    >
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#E8F5EC" strokeWidth={15} />
      {arcs}
      {total === 0 ? (
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize="9" fill="#8BA89B">
          データなし
        </text>
      ) : (
        <>
          <text x={cx} y={cy - 8} textAnchor="middle" dominantBaseline="middle" fontSize="8" fill="#8BA89B">
            合計
          </text>
          <text x={cx} y={cy + 7} textAnchor="middle" dominantBaseline="middle" fontSize="10" fill="#183529" fontWeight="bold">
            {formatCurrency(total)}
          </text>
        </>
      )}
    </svg>
  );
}

function MiniLineChart({ data }: { data: MonthlyEntry[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [animDone, setAnimDone] = useState(false);

  // viewBox 600×120 (5:1) — no preserveAspectRatio="none" so circles/text are not distorted
  const w = 600;
  const h = 120;
  const px = 12;
  const py = 16;
  const labelH = 22;
  const ch = h - py - labelH;

  const hasActivity = data.some((d) => d.income > 0);

  const values = data.map((d) => d.income);
  const maxVal = Math.max(1, ...values);

  const toY = (v: number) => py + ((maxVal - v) / maxVal) * ch;
  const toX = (i: number) =>
    data.length <= 1 ? w / 2 : px + (i / (data.length - 1)) * (w - 2 * px);

  const baselineY = py + ch;
  const pts = data.map((d, i) => ({ x: toX(i), y: toY(d.income) }));

  const linePath = buildSmoothPath(pts);
  const lineLen = approximateBezierLength(pts);
  const areaPath =
    pts.length > 0
      ? `${linePath} L ${pts[pts.length - 1].x},${baselineY} L ${pts[0].x},${baselineY} Z`
      : "";

  // Trigger draw animation via requestAnimationFrame
  useEffect(() => {
    let cancelled = false;
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (!cancelled) setAnimDone(true);
      })
    );
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, []);

  const updateHovered = (svgEl: SVGSVGElement, clientX: number) => {
    const rect = svgEl.getBoundingClientRect();
    const svgX = ((clientX - rect.left) / rect.width) * w;
    let best = 0;
    let bestDist = Infinity;
    pts.forEach((p, i) => {
      const d = Math.abs(p.x - svgX);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    setHoveredIdx(best);
  };

  if (!hasActivity) return null;

  const tipLeft = hoveredIdx !== null ? (pts[hoveredIdx].x / w) * 100 : 0;
  const tipTop = hoveredIdx !== null ? (pts[hoveredIdx].y / h) * 100 : 0;

  return (
    <div className="relative w-full">
      {/* Tooltip */}
      {hoveredIdx !== null && (
        <div
          className="pointer-events-none absolute z-10"
          style={{
            left: `${tipLeft}%`,
            top: `${tipTop}%`,
            transform: "translate(-50%, calc(-100% - 10px))",
          }}
        >
          <div className="rounded-xl bg-[#183529] px-3 py-2 shadow-xl">
            <p className="text-[10px] font-semibold leading-none text-white/60">
              {data[hoveredIdx].label}
            </p>
            <p className="mt-1 text-sm font-black leading-none text-white">
              {formatCurrency(data[hoveredIdx].income)}
            </p>
          </div>
          <div className="mx-auto h-2.5 w-px bg-[#183529]" />
        </div>
      )}

      {/* SVG with natural aspect ratio — no preserveAspectRatio="none" to avoid distortion */}
      <svg
        viewBox={`0 0 ${w} ${h}`}
        width="100%"
        className="block cursor-crosshair select-none"
        aria-hidden="true"
        onMouseMove={(e) => updateHovered(e.currentTarget, e.clientX)}
        onMouseLeave={() => setHoveredIdx(null)}
        onClick={(e) => updateHovered(e.currentTarget, e.clientX)}
      >
        {/* Area fill — fade in after line draws */}
        <path
          d={areaPath}
          fill="#DDF4E7"
          style={{
            fillOpacity: animDone ? 0.9 : 0,
            transition: "fill-opacity 1.0s ease 1.2s",
          }}
        />

        {/* Hover vertical indicator */}
        {hoveredIdx !== null && (
          <line
            x1={pts[hoveredIdx].x}
            y1={py}
            x2={pts[hoveredIdx].x}
            y2={baselineY}
            stroke="#2F8F57"
            strokeWidth={1.5}
            strokeDasharray="5 3"
            opacity="0.5"
          />
        )}

        {/* Smooth curved line — draw animation via stroke-dashoffset */}
        <path
          d={linePath}
          fill="none"
          stroke="#2F8F57"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={lineLen > 0 ? lineLen : undefined}
          strokeDashoffset={lineLen > 0 ? (animDone ? 0 : lineLen) : undefined}
          style={
            lineLen > 0
              ? { transition: "stroke-dashoffset 1.8s cubic-bezier(0.4,0,0.2,1)" }
              : undefined
          }
        />

        {/* Data points — staggered fade in */}
        {pts.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={hoveredIdx === i ? 8 : 5}
            fill={hoveredIdx === i ? "white" : "#2F8F57"}
            stroke="#2F8F57"
            strokeWidth={hoveredIdx === i ? 3 : 0}
            style={{
              opacity: animDone ? 1 : 0,
              transition: `opacity 0.5s ease ${1.5 + i * 0.1}s`,
            }}
          />
        ))}

        {/* Month labels */}
        {data.map((d, i) => (
          <text
            key={i}
            x={toX(i)}
            y={h - 5}
            textAnchor="middle"
            fontSize="14"
            fill={hoveredIdx === i ? "#2F8F57" : "#8BA89B"}
            fontWeight={hoveredIdx === i ? "bold" : "normal"}
          >
            {d.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

// ─── SVG Icons ───────────────────────────────────────────────────────────────

function IconWallet() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
      <circle cx="16" cy="15" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}

function IconPersonAdd() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <line x1="20" y1="8" x2="20" y2="14" />
      <line x1="17" y1="11" x2="23" y2="11" />
    </svg>
  );
}

function IconCash() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

function IconDocument() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function IconCamera() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function IconPeople() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section
      className={`rounded-[28px] border border-[var(--border-soft)] bg-[var(--surface-card-strong)] p-5 shadow-[var(--shadow-card)] ${className}`}
    >
      {children}
    </section>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-lg font-extrabold text-[var(--text-primary)]">{children}</p>;
}

// ─── Member card ─────────────────────────────────────────────────────────────

function MemberCard({
  member,
  isSelf,
  navigable = true,
}: {
  member: FamilyMember;
  isSelf: boolean;
  navigable?: boolean;
}) {
  const isChild = member.role === "child";

  const inner = (
    <div className="flex w-20 flex-col items-center gap-1.5 text-center">
      <div className={`rounded-[22px] ring-2 ${isChild ? "ring-[#F8A9A0]" : "ring-[#4CA368]"}`}>
        <MemberAvatar
          avatarPath={member.avatar_path}
          avatarEmoji={member.avatar_emoji}
          displayLabel={member.display_label}
          fallbackBgClass={isChild ? "bg-[#FDE8E4]" : "bg-[#E6F5EA]"}
          size="lg"
        />
      </div>
      <p className="w-full truncate text-xs font-bold text-[var(--text-primary)]">
        {member.display_label}
      </p>
      {isSelf ? <StatusBadge tone="success">あなた</StatusBadge> : null}
      {isChild && navigable ? (
        <p className="text-[10px] font-semibold text-[var(--brand-primary)]">お小遣いを見る</p>
      ) : null}
    </div>
  );

  if (isChild && navigable) {
    return (
      <Link
        href={`/allowance?childId=${member.user_id}`}
        className="rounded-[18px] p-1 transition hover:bg-[var(--surface-accent)]"
      >
        {inner}
      </Link>
    );
  }

  return <div className="p-1">{inner}</div>;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function HomeDashboard() {
  const [state, setState] = useState<HomeState>({
    loading: true,
    isAuthenticated: false,
    userId: null,
    email: null,
    displayName: null,
    role: null,
    familyId: null,
    familyName: null,
    members: [],
    grants: [],
  });

  useEffect(() => {
    let isActive = true;

    const loadHome = async () => {
      const {
        data: { session },
        error: sessionError,
      } = await getSafeSession(supabase);

      if (!isActive) return;

      if (sessionError || !session?.user) {
        setState((s) => ({ ...s, loading: false, isAuthenticated: false }));
        return;
      }

      const userId = session.user.id;
      const email = session.user.email ?? null;

      const [
        { data: membership },
        { data: profile },
        { data: membersRaw },
        { data: grantsRaw },
      ] = await Promise.all([
        supabase
          .from("family_memberships")
          .select("family_id, role")
          .eq("user_id", userId)
          .eq("status", "active")
          .maybeSingle(),
        supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
        supabase.rpc("list_family_members_for_current_user"),
        supabase.rpc("list_allowance_grants_for_current_user"),
      ]);

      if (!isActive) return;

      const familyId = membership?.family_id ?? null;
      let familyName: string | null = null;

      if (familyId) {
        const { data: familyData } = await supabase
          .from("families")
          .select("family_name")
          .eq("id", familyId)
          .maybeSingle();
        familyName = familyData?.family_name ?? null;
      }

      if (!isActive) return;

      const displayName =
        typeof profile?.display_name === "string" && profile.display_name.trim().length > 0
          ? profile.display_name
          : null;

      setState({
        loading: false,
        isAuthenticated: true,
        userId,
        email,
        displayName,
        role: typeof membership?.role === "string" ? membership.role : null,
        familyId,
        familyName,
        members: Array.isArray(membersRaw) ? (membersRaw as FamilyMember[]) : [],
        grants: Array.isArray(grantsRaw) ? (grantsRaw as GrantRow[]) : [],
      });
    };

    void loadHome();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void loadHome();
    });

    const onFamilyUpdated = () => void loadHome();
    window.addEventListener(FAMILY_UPDATED_EVENT, onFamilyUpdated);

    return () => {
      isActive = false;
      subscription.unsubscribe();
      window.removeEventListener(FAMILY_UPDATED_EVENT, onFamilyUpdated);
    };
  }, []);

  // ─── Derived values ─────────────────────────────────────────────────────────

  const isGuardian = state.role === "guardian_admin" || state.role === "guardian";
  const isChild = state.role === "child";
  const { elementaryMode } = useElementaryMode();
  const isChildElementary = isChild && elementaryMode;
  const greetingName = state.displayName ?? state.email ?? "さん";

  // Summary — mirrors AllowanceGrantsPanel: activeGrants excludes cashout_status !== null
  const activeGrants = state.grants.filter((g) => !g.cashout_status);
  const paidGrants = state.grants.filter((g) => g.cashout_status === "paid");

  const totalAssets = activeGrants.reduce((sum, g) => {
    const val =
      g.decision_status === "invested" ? (g.current_value_jpy ?? g.amount_jpy) : g.amount_jpy;
    return sum + val;
  }, 0);

  const totalGain = activeGrants
    .filter((g) => g.decision_status === "invested")
    .reduce((sum, g) => sum + (g.unrealized_gain_jpy ?? 0), 0);

  const totalAllowance = activeGrants.reduce((sum, g) => sum + g.amount_jpy, 0);

  const totalInvested = activeGrants
    .filter((g) => g.decision_status === "invested")
    .reduce((sum, g) => sum + (g.current_value_jpy ?? g.amount_jpy), 0);

  const totalPaid = paidGrants.reduce(
    (sum, g) => sum + (g.cashout_requested_amount_jpy ?? 0),
    0
  );

  const donutData = computeDonutData(state.grants);
  const monthlyData = computeMonthlyData(state.grants, totalAssets);
  const hasMonthlyActivity = monthlyData.some((d) => d.income > 0);

  // Notifications
  const pendingCashoutsForGuardian = isGuardian
    ? state.grants.filter(
        (g) => g.cashout_status === "requested" && g.granted_by_user_id === state.userId
      )
    : [];

  const pendingDecisionsForGuardian = isGuardian
    ? activeGrants.filter((g) => g.decision_status === "pending")
    : [];

  const pendingDecisionsForChild = isChild
    ? activeGrants.filter(
        (g) => g.decision_status === "pending" && g.child_user_id === state.userId
      )
    : [];

  const ownMember = state.members.find((m) => m.user_id === state.userId);
  const profileNotSet = !ownMember?.avatar_path && !ownMember?.avatar_emoji;

  type NotifItem = {
    key: string;
    icon: React.ReactNode;
    iconBg: string;
    iconColor: string;
    title: string;
    description: string;
    href: string;
  };

  const notifications: NotifItem[] = [];

  if (pendingCashoutsForGuardian.length > 0) {
    notifications.push({
      key: "cashout",
      icon: <IconCash />,
      iconBg: "bg-[rgba(191,110,82,0.12)]",
      iconColor: "text-[var(--danger)]",
      title: "支払い申請が届いています",
      description: `${pendingCashoutsForGuardian.length}件の申請があります`,
      href: "/allowance",
    });
  }
  if (pendingDecisionsForGuardian.length > 0) {
    notifications.push({
      key: "pending-guardian",
      icon: <IconDocument />,
      iconBg: "bg-[rgba(228,163,94,0.12)]",
      iconColor: "text-[var(--warning)]",
      title: "まだ決めていないお小遣いがあります",
      description: `${pendingDecisionsForGuardian.length}件が未決定です`,
      href: "/allowance",
    });
  }
  if (pendingDecisionsForChild.length > 0) {
    notifications.push({
      key: "pending-child",
      icon: <IconDocument />,
      iconBg: "bg-[rgba(228,163,94,0.12)]",
      iconColor: "text-[var(--warning)]",
      title: "まだ決めていないお小遣いがあります",
      description: `${pendingDecisionsForChild.length}件が未決定です`,
      href: "/allowance",
    });
  }
  if (profileNotSet) {
    notifications.push({
      key: "profile",
      icon: <IconCamera />,
      iconBg: "bg-[var(--surface-accent)]",
      iconColor: "text-[var(--brand-primary)]",
      title: "写真やアイコンを設定しましょう",
      description: "アイコンや名前を設定すると、もっと使いやすくなります",
      href: "/family",
    });
  }
  if (isGuardian && state.members.length < 3) {
    notifications.push({
      key: "invite",
      icon: <IconPeople />,
      iconBg: "bg-[rgba(76,163,104,0.12)]",
      iconColor: "text-[var(--success)]",
      title: "家族を招待できます",
      description: "家族メンバーを増やして、より便利に使えます",
      href: "/family/invites",
    });
  }

  // Quick menu items with SVG icons
  type QuickItem = {
    href: string;
    label: string;
    icon: React.ReactNode;
    iconBg: string;
    iconColor: string;
  };

  const quickMenuItems: QuickItem[] = [
    {
      href: "/allowance",
      label: "お小遣いを見る",
      icon: <IconWallet />,
      iconBg: "bg-[rgba(76,163,104,0.12)]",
      iconColor: "text-[var(--brand-primary)]",
    },
    ...(isGuardian
      ? [
          {
            href: "/family",
            label: "家族設定",
            icon: <IconSettings />,
            iconBg: "bg-[var(--surface-accent)]",
            iconColor: "text-[var(--info)]",
          },
          {
            href: "/family/invites",
            label: "家族を招待",
            icon: <IconPersonAdd />,
            iconBg: "bg-[rgba(228,163,94,0.12)]",
            iconColor: "text-[var(--warning)]",
          },
        ]
      : []),
  ];

  // ─── Render states ────────────────────────────────────────────────────────────

  if (state.loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <p className="text-sm text-[var(--text-secondary)]">読み込み中...</p>
      </div>
    );
  }

  if (!state.isAuthenticated) {
    return null;
  }

  if (!state.familyId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-20 text-center">
        <p className="text-5xl">👨‍👩‍👧</p>
        <div>
          <p className="text-xl font-black text-[var(--text-primary)]">家族をまだ設定していません</p>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">家族を作成または参加してください</p>
        </div>
        <Link
          href="/family"
          className="rounded-full bg-[var(--brand-primary)] px-8 py-3 text-sm font-bold text-white shadow-[0_10px_24px_rgba(51,101,63,0.22)]"
        >
          家族設定へ
        </Link>
      </div>
    );
  }

  // ─── Full dashboard ───────────────────────────────────────────────────────────

  return (
    <div className="relative flex flex-1 justify-center overflow-hidden">
      {/* Decorative background */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_top,rgba(76,163,104,0.18),transparent_54%)]" />
      <div className="pointer-events-none absolute right-[-4rem] top-18 h-40 w-40 rounded-full bg-[rgba(233,178,134,0.18)] blur-3xl" />
      <div className="pointer-events-none absolute left-[-3rem] top-56 h-32 w-32 rounded-full bg-[rgba(241,226,174,0.22)] blur-3xl" />

      <main className="relative w-full max-w-[1120px] px-4 pb-24 pt-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5">

          {/* 1. Hero */}
          <section className="relative overflow-hidden rounded-[28px] bg-[radial-gradient(ellipse_at_top_right,rgba(186,235,210,0.55)_0%,rgba(241,251,244,0.70)_45%,rgba(255,247,232,0.60)_100%)] px-6 py-7">
            {/* Soft decorative blobs */}
            <div className="pointer-events-none absolute right-[6rem] top-[-1.5rem] h-28 w-28 rounded-full bg-[rgba(76,163,104,0.10)] blur-2xl sm:right-[8rem] sm:h-36 sm:w-36" />
            <div className="pointer-events-none absolute bottom-[-1rem] right-[2rem] h-20 w-20 rounded-full bg-[rgba(241,226,174,0.25)] blur-2xl" />
            {/* Subtle dot pattern */}
            <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.07]" xmlns="http://www.w3.org/2000/svg">
              <pattern id="hero-dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1.5" fill="#2F8F57" />
              </pattern>
              <rect width="100%" height="100%" fill="url(#hero-dots)" />
            </svg>

            <div className="relative z-10 flex items-center justify-between gap-4">
              {/* Left: greeting */}
              <div className="min-w-0">
                <p className="text-2xl font-black leading-tight text-[var(--text-primary)] sm:text-3xl">
                  おかえりなさい、
                  <br />
                  {greetingName}さん！
                </p>
                <p className="mt-2 max-w-xs text-sm leading-6 text-[var(--text-secondary)]">
                  <AutoHiragana enabled={isChildElementary}>家族みんなでお金のことを楽しく学びましょう</AutoHiragana>
                </p>
              </div>

              {/* Right: user avatar */}
              <div className="relative shrink-0">
                {/* Outer mint ring */}
                <div className="rounded-full p-[3px] ring-2 ring-[rgba(76,163,104,0.25)]">
                  {/* Inner white ring */}
                  <div className="rounded-full bg-white p-[3px] shadow-[0_8px_24px_rgba(51,101,63,0.18)]">
                    <MemberAvatar
                      avatarPath={ownMember?.avatar_path ?? null}
                      avatarEmoji={ownMember?.avatar_emoji ?? null}
                      displayLabel={ownMember?.display_label ?? greetingName}
                      className="!h-[72px] !w-[72px] rounded-full !text-3xl sm:!h-[112px] sm:!w-[112px] sm:!text-5xl"
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 2. Family card — guardian only (child sees it at the bottom) */}
          {isGuardian ? (
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <SectionTitle>自分のファミリー</SectionTitle>
                <div className="flex flex-wrap items-center gap-2">
                  {state.familyName ? (
                    <span className="rounded-full bg-[var(--surface-accent)] px-3 py-1 text-xs font-bold text-[var(--brand-primary-strong)]">
                      {state.familyName}
                    </span>
                  ) : null}
                  <span className="rounded-full border border-[var(--border-soft)] bg-white px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]">
                    {state.members.length}人のメンバー
                  </span>
                </div>
              </div>

              {state.members.length === 0 ? (
                <p className="mt-4 text-sm text-[var(--text-secondary)]">メンバーが見つかりません</p>
              ) : (
                <div className="-mx-1 mt-5 overflow-x-auto pb-1">
                  <div className="flex min-w-max gap-3 px-1">
                    {state.members.map((member) => (
                      <MemberCard
                        key={member.user_id}
                        member={member}
                        isSelf={member.user_id === state.userId}
                      />
                    ))}
                  </div>
                </div>
              )}
            </Card>
          ) : null}

          {/* 3. Asset summary — main card */}
          <Card>
            <div className="flex items-center justify-between gap-3">
              <SectionTitle>
                {isGuardian
                  ? "家族の資産サマリー"
                  : <AutoHiragana enabled={isChildElementary}>あなたのお小遣いサマリー</AutoHiragana>}
              </SectionTitle>
              <Link
                href="/allowance"
                className="shrink-0 text-sm font-bold text-[var(--brand-primary)]"
              >
                <AutoHiragana enabled={isChildElementary}>詳細を見る →</AutoHiragana>
              </Link>
            </div>

            <div className="mt-4">
              <p className="text-xs font-semibold text-[var(--text-secondary)]"><AutoHiragana enabled={isChildElementary}>現在の総資産</AutoHiragana></p>
              <p className="mt-1 text-4xl font-black text-[var(--text-primary)]">
                {formatCurrency(totalAssets)}
              </p>
              {totalGain !== 0 ? (
                <p
                  className={`mt-1 text-sm font-bold ${
                    totalGain >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"
                  }`}
                >
                  <AutoHiragana enabled={isChildElementary}>評価損益</AutoHiragana>{" "}{totalGain >= 0 ? "+" : ""}
                  {formatCurrency(totalGain)}
                </p>
              ) : null}
            </div>

            {hasMonthlyActivity ? (
              <div className="mt-5">
                <p className="mb-2 text-xs font-semibold text-[var(--text-secondary)]">
                  <AutoHiragana enabled={isChildElementary}>資産推移（過去6ヶ月）</AutoHiragana>
                </p>
                <MiniLineChart data={monthlyData} />
              </div>
            ) : null}
          </Card>

          {/* 3b. Donut + Breakdown grid */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Donut card */}
            <Card>
              <SectionTitle><AutoHiragana enabled={isChildElementary}>お金の使い方</AutoHiragana></SectionTitle>
              <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-center">
                <DonutChart
                  invested={donutData.invested}
                  received={donutData.received}
                  pending={donutData.pending}
                />
                <div className="flex w-full flex-col gap-2.5 sm:flex-1">
                  {(
                    [
                      { label: "投資中", value: donutData.invested, color: "#2F8F57" },
                      {
                        label: "受け取り予定・受け取り済み",
                        value: donutData.received,
                        color: "#F5C97A",
                      },
                      { label: "まだ選んでいない", value: donutData.pending, color: "#B9DCF7" },
                    ] as const
                  ).map(({ label, value, color }) => (
                    <div key={label} className="flex items-start gap-2">
                      <span
                        className="mt-0.5 h-2.5 w-2.5 flex-shrink-0 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <span className="flex-1 text-xs leading-snug text-[var(--text-secondary)]">
                        <AutoHiragana enabled={isChildElementary}>{label}</AutoHiragana>
                      </span>
                      <span className="pl-2 text-xs font-bold tabular-nums text-[var(--text-primary)]">
                        {formatCurrency(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* Breakdown card */}
            <Card>
              <SectionTitle><AutoHiragana enabled={isChildElementary}>内訳</AutoHiragana></SectionTitle>
              <div className="mt-4 flex flex-col gap-3">
                {[
                  { label: "お小遣い総額", value: totalAllowance },
                  { label: "投資中", value: totalInvested },
                  { label: "これまで支払い済み", value: totalPaid },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="rounded-[18px] bg-[var(--surface-accent)] px-4 py-3"
                  >
                    <p className="text-xs font-semibold text-[var(--text-secondary)]">
                      <AutoHiragana enabled={isChildElementary}>{label}</AutoHiragana>
                    </p>
                    <p className="mt-1 text-lg font-black text-[var(--text-primary)]">
                      {formatCurrency(value)}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* 4. Notifications */}
          <Card>
            {notifications.length === 0 ? (
              /* 空状態: 左列（タイトル＋内容）＋右列（吹き出し＋大きいイラスト） */
              <div className="flex items-stretch gap-4">
                <div className="flex min-w-0 flex-1 flex-col">
                  <SectionTitle><AutoHiragana enabled={isChildElementary}>やること・お知らせ</AutoHiragana></SectionTitle>
                  <div className="mt-5 flex flex-col gap-2">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(76,163,104,0.12)]">
                      <svg viewBox="0 0 24 24" className="h-6 w-6 text-[var(--success)]" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <p className="text-sm font-bold text-[var(--text-primary)]">
                      <AutoHiragana enabled={isChildElementary}>いま対応が必要なことはありません</AutoHiragana>
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      <AutoHiragana enabled={isChildElementary}>引き続きファミリーのお金管理を続けましょう</AutoHiragana>
                    </p>
                  </div>
                </div>
                <div className="flex w-36 shrink-0 flex-col items-center">
                  <div className="w-full rounded-2xl bg-[#E8F5E9] px-3 py-2.5 text-center">
                    <p className="text-xs font-bold leading-snug text-[#2E7D32]">
                      <AutoHiragana enabled={isChildElementary}>チャートやニュースをチェックして、次のおこづかいに備えよう</AutoHiragana>
                    </p>
                  </div>
                  <svg className="shrink-0" width="16" height="10" viewBox="0 0 16 10" aria-hidden>
                    <path d="M0 0 L16 0 L8 10 Z" fill="#E8F5E9" />
                  </svg>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/mirakun-surprised.png"
                    alt="ミラくん"
                    className="min-h-0 flex-1 w-full object-contain object-top drop-shadow-sm"
                  />
                </div>
              </div>
            ) : (
              /* お知らせあり: タイトル＋リスト */
              <>
                <SectionTitle><AutoHiragana enabled={isChildElementary}>やること・お知らせ</AutoHiragana></SectionTitle>
                <div className="mt-3 grid gap-2">
                  {notifications.map((n) => (
                    <Link
                      key={n.key}
                      href={n.href}
                      className="flex items-center gap-3 rounded-[20px] border border-[var(--border-soft)] bg-white px-4 py-3 transition hover:bg-[var(--surface-accent)]"
                    >
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${n.iconBg} ${n.iconColor}`}
                      >
                        {n.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-[var(--text-primary)]">
                          <AutoHiragana enabled={isChildElementary}>{n.title}</AutoHiragana>
                        </p>
                        <p className="text-xs text-[var(--text-secondary)]">
                          <AutoHiragana enabled={isChildElementary}>{n.description}</AutoHiragana>
                        </p>
                      </div>
                      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-[var(--text-muted)]" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </Card>

          {/* 5a. Quick menu — guardian only */}
          {isGuardian ? (
            <Card>
              <SectionTitle>クイックメニュー</SectionTitle>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {quickMenuItems.map(({ href, label, icon, iconBg, iconColor }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex flex-col items-center gap-3 rounded-[22px] border border-[var(--border-soft)] bg-white p-5 text-center transition hover:bg-[var(--surface-accent)]"
                  >
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-full ${iconBg} ${iconColor}`}
                    >
                      {icon}
                    </div>
                    <p className="text-sm font-bold text-[var(--text-primary)]">{label}</p>
                  </Link>
                ))}
              </div>
            </Card>
          ) : null}

          {/* 5b. Learning sites — child only */}
          {isChild ? (
            <Card>
              <SectionTitle><AutoHiragana enabled={isChildElementary}>お金を学ぶサイト</AutoHiragana></SectionTitle>
              <div className="mt-4 grid gap-3">
                {[
                  {
                    href: "https://finance.yahoo.co.jp/",
                    name: "Yahoo!ファイナンス",
                    description: "株や投資信託の最新価格、為替レート、マーケットニュースを無料で確認できます。",
                    iconBg: "bg-[rgba(76,163,104,0.12)]",
                    iconColor: "text-[var(--brand-primary)]",
                  },
                  {
                    href: "https://media.rakuten-sec.net/",
                    name: "トウシル（楽天証券）",
                    description: "楽天証券の投資情報サイト。初心者向けのわかりやすい記事やコラムが豊富です。",
                    iconBg: "bg-[rgba(228,163,94,0.12)]",
                    iconColor: "text-[var(--warning)]",
                  },
                ].map(({ href, name, description, iconBg, iconColor }) => (
                  <a
                    key={href}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-[20px] border border-[var(--border-soft)] bg-white px-4 py-3 transition hover:bg-[var(--surface-accent)]"
                  >
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconBg} ${iconColor}`}>
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="2" y1="12" x2="22" y2="12" />
                        <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-[var(--text-primary)]">{name}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-secondary)]">
                        <AutoHiragana enabled={isChildElementary}>{description}</AutoHiragana>
                      </p>
                    </div>
                    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-[var(--text-muted)]" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </a>
                ))}
              </div>
            </Card>
          ) : null}

          {/* 5c. Family card — child only, at bottom, non-navigable */}
          {isChild ? (
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <SectionTitle><AutoHiragana enabled={isChildElementary}>自分のファミリー</AutoHiragana></SectionTitle>
                <div className="flex flex-wrap items-center gap-2">
                  {state.familyName ? (
                    <span className="rounded-full bg-[var(--surface-accent)] px-3 py-1 text-xs font-bold text-[var(--brand-primary-strong)]">
                      {state.familyName}
                    </span>
                  ) : null}
                  <span className="rounded-full border border-[var(--border-soft)] bg-white px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]">
                    {state.members.length}<AutoHiragana enabled={isChildElementary}>人のメンバー</AutoHiragana>
                  </span>
                </div>
              </div>
              {state.members.length === 0 ? (
                <p className="mt-4 text-sm text-[var(--text-secondary)]">
                  <AutoHiragana enabled={isChildElementary}>メンバーが見つかりません</AutoHiragana>
                </p>
              ) : (
                <div className="-mx-1 mt-5 overflow-x-auto pb-1">
                  <div className="flex min-w-max gap-3 px-1">
                    {state.members.map((member) => (
                      <MemberCard
                        key={member.user_id}
                        member={member}
                        isSelf={member.user_id === state.userId}
                        navigable={false}
                      />
                    ))}
                  </div>
                </div>
              )}
            </Card>
          ) : null}

        </div>
      </main>
    </div>
  );
}
