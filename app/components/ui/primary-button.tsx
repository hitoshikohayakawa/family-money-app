import { ButtonHTMLAttributes, ReactNode } from "react";

type PrimaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  fullWidth?: boolean;
  size?: "sm" | "md";
};

export default function PrimaryButton({
  children,
  className = "",
  fullWidth = true,
  size = "md",
  type = "button",
  ...props
}: PrimaryButtonProps) {
  const sizeClasses =
    size === "sm"
      ? "min-h-10 px-4 py-2 text-sm"
      : "min-h-12 px-5 py-3 text-base";

  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center rounded-[18px] bg-[var(--button-primary-bg)] font-semibold text-white shadow-[0_14px_24px_rgba(36,59,107,0.24)] hover:-translate-y-0.5 hover:bg-[var(--button-primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)] disabled:cursor-not-allowed disabled:opacity-60 ${fullWidth ? "w-full" : ""} ${sizeClasses} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}