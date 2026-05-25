import { ReactNode } from "react";

type StatusBadgeProps = {
  tone?: "info" | "success" | "warning" | "danger" | "neutral";
  children: ReactNode;
};

export default function StatusBadge({
  tone = "neutral",
  children,
}: StatusBadgeProps) {
  const toneClasses = {
    info: "border border-[var(--border-strong)] bg-[var(--surface-accent)] text-[var(--info)]",
    success: "border border-[rgba(76,163,104,0.18)] bg-[var(--surface-success)] text-[var(--success)]",
    warning: "border border-[rgba(228,163,94,0.24)] bg-[var(--surface-soft)] text-[var(--warning)]",
    danger: "border border-[rgba(191,110,82,0.24)] bg-[var(--surface-pink)] text-[var(--danger)]",
    neutral: "border border-[var(--border-soft)] bg-[var(--tint-accent-soft)] text-[var(--text-secondary)]",
  }[tone];

  return (
    <span
      className={`inline-flex items-center rounded-full px-3.5 py-1.5 text-sm font-bold tracking-wide ${toneClasses}`}
    >
      {children}
    </span>
  );
}
