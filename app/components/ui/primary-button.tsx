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
      ? "min-h-11 px-4.5 py-2.5 text-base"
      : "min-h-14 px-6 py-3.5 text-lg";

  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center rounded-[22px] bg-[var(--button-primary-bg)] font-bold text-white shadow-[0_14px_28px_rgba(47,127,74,0.28)] hover:-translate-y-0.5 hover:bg-[var(--button-primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)] disabled:cursor-not-allowed disabled:opacity-60 ${fullWidth ? "w-full" : ""} ${sizeClasses} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
