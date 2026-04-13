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
    info: "border border-[rgba(111,149,229,0.16)] bg-[var(--surface-accent)] text-[var(--info)]",
    success: "border border-[rgba(134,200,165,0.18)] bg-[var(--surface-success)] text-[var(--success)]",
    warning: "border border-[rgba(244,179,124,0.24)] bg-[var(--surface-soft)] text-[var(--warning)]",
    danger: "border border-[rgba(239,172,192,0.24)] bg-[var(--surface-pink)] text-[var(--danger)]",
    neutral: "border border-[rgba(109,132,177,0.14)] bg-[rgba(242,246,255,0.92)] text-[var(--text-secondary)]",
  }[tone];

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tracking-wide ${toneClasses}`}
    >
      {children}
    </span>
  );
}