import { ReactNode } from "react";

type SectionCardProps = {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  tone?: "default" | "playful";
};

export default function SectionCard({
  title,
  description,
  children,
  className = "",
  tone = "default",
}: SectionCardProps) {
  const toneClasses =
    tone === "playful"
      ? "border-[var(--border-strong)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(250,252,255,0.96))]"
      : "border-[var(--border-soft)] bg-[var(--surface-card)]";

  return (
    <section
      className={`rounded-[30px] border px-5 py-5 shadow-[var(--shadow-card)] backdrop-blur sm:px-6 sm:py-6 ${toneClasses} ${className}`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)] sm:text-base">
              {description}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-5">{children}</div>
    </section>
  );
}