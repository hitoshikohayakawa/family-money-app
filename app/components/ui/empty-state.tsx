import { ReactNode } from "react";

type EmptyStateProps = {
  title: ReactNode;
  description: ReactNode;
  action?: ReactNode;
};

export default function EmptyState({
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="rounded-[28px] border border-dashed border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(245,251,243,0.95))] px-6 py-9 text-center">
      <div className="relative mx-auto mb-4 h-14 w-14">
        <div className="absolute inset-0 rounded-full bg-[var(--surface-accent)]" />
        <div className="absolute -right-1 bottom-0 h-6 w-6 rounded-full bg-[var(--surface-pink)]" />
        <div className="absolute -left-1 top-1 h-4 w-4 rounded-full bg-[var(--surface-soft)]" />
      </div>
      <h3 className="text-xl font-bold text-[var(--text-primary)]">{title}</h3>
      <p className="mt-3 text-base leading-7 text-[var(--text-secondary)]">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
