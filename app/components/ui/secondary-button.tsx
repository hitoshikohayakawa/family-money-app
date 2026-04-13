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
      ? "min-h-9 px-3.5 py-2 text-sm"
      : "min-h-11 px-4 py-2.5 text-sm sm:text-base";

  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center rounded-[18px] border border-[rgba(111,149,229,0.18)] bg-[var(--button-secondary-bg)] font-medium text-[var(--brand-secondary-ink)] shadow-[0_8px_18px_rgba(88,125,208,0.08)] hover:-translate-y-0.5 hover:border-[rgba(111,149,229,0.3)] hover:bg-[var(--button-secondary-hover)] disabled:cursor-not-allowed disabled:opacity-60 ${sizeClasses} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}