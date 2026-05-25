import { ReactNode } from "react";

type PageContainerProps = {
  title?: string;
  description?: string;
  badge?: string;
  children: ReactNode;
};

export default function PageContainer({
  title,
  description,
  badge,
  children,
}: PageContainerProps) {
  return (
    <div className="relative flex flex-1 justify-center overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_top,rgba(76,163,104,0.18),transparent_54%)]" />
      <div className="pointer-events-none absolute right-[-4rem] top-18 h-40 w-40 rounded-full bg-[rgba(233,178,134,0.18)] blur-3xl" />
      <div className="pointer-events-none absolute left-[-3rem] top-56 h-32 w-32 rounded-full bg-[rgba(241,226,174,0.22)] blur-3xl" />

      <main className="relative flex w-full max-w-[1120px] flex-col gap-6 pb-10">
        {title || description ? (
          <section className="rounded-[34px] border border-[rgba(255,255,255,0.76)] bg-[var(--surface-card)] px-6 py-7 shadow-[var(--shadow-card)] backdrop-blur sm:px-8">
            {badge ? (
              <span className="inline-flex rounded-full border border-[rgba(76,163,104,0.18)] bg-[var(--surface-accent)] px-3 py-1 text-sm font-semibold text-[var(--brand-primary-strong)]">
                {badge}
              </span>
            ) : null}
            {title ? (
              <h1 className="mt-3 text-[2.1rem] font-extrabold tracking-tight text-[var(--text-primary)] sm:text-[2.6rem]">
                {title}
              </h1>
            ) : null}
            {description ? (
              <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--text-secondary)] sm:text-lg">
                {description}
              </p>
            ) : null}
          </section>
        ) : null}

        {children}
      </main>
    </div>
  );
}
