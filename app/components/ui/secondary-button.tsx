import { ButtonHTMLAttributes, ReactNode } from "react";

type SecondaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  size?: "sm" | "md";
};

export default function SecondaryButton({
  children,
  className = "",
  size = "md",
  type = "button",
  ...props
}: SecondaryButtonProps) {
  const sizeClasses =
    size === "sm"
      ? "min-h-10 px-4 py-2.5 text-base"
      : "min-h-12 px-5 py-3 text-base sm:text-lg";

  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center rounded-[22px] border border-[var(--border-soft)] bg-[var(--button-secondary-bg)] font-bold text-[var(--brand-secondary-ink)] shadow-[0_8px_18px_rgba(47,127,74,0.1)] hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:bg-[var(--button-secondary-hover)] disabled:cursor-not-allowed disabled:opacity-60 ${sizeClasses} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
