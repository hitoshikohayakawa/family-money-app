import { ReactNode } from "react";

type SectionCardProps = {
  title: ReactNode;
  description?: ReactNode;
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
      ? "border-[var(--border-strong)] bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(242,250,243,0.96))]"
      : "border-[var(--border-soft)] bg-[var(--surface-card)]";

  return (
    <section
      className={`rounded-[34px] border px-5 py-5 shadow-[var(--shadow-card)] backdrop-blur sm:px-7 sm:py-7 ${toneClasses} ${className}`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-[1.8rem] font-extrabold tracking-tight text-[var(--text-primary)] sm:text-[2rem]">
            {title}
          </h2>
          {description ? (
            <p className="mt-2 text-base leading-7 text-[var(--text-secondary)] sm:text-lg">
              {description}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-5">{children}</div>
    </section>
  );
}
