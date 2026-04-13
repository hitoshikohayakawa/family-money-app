import { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

export default function EmptyState({
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="rounded-[24px] border border-dashed border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,249,255,0.94))] px-5 py-8 text-center">
      <div className="relative mx-auto mb-4 h-14 w-14">
        <div className="absolute inset-0 rounded-full bg-[var(--surface-accent)]" />
        <div className="absolute -right-1 bottom-0 h-6 w-6 rounded-full bg-[var(--surface-pink)]" />
        <div className="absolute -left-1 top-1 h-4 w-4 rounded-full bg-[var(--surface-soft)]" />
      </div>
      <h3 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}