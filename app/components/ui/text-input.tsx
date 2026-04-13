import { InputHTMLAttributes } from "react";

type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
};

export default function TextInput({
  label,
  hint,
  className = "",
  ...props
}: TextInputProps) {
  return (
    <label className="flex flex-col gap-2 text-sm font-medium text-[var(--text-primary)]">
      <span>{label}</span>
      {hint ? <span className="text-xs text-[var(--text-muted)]">{hint}</span> : null}
      <input
        className={`min-h-12 rounded-[var(--radius-md)] border border-[var(--border-soft)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,250,243,0.96))] px-4 py-3 text-[var(--text-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--brand-blue)] focus:ring-4 focus:ring-[rgba(120,168,248,0.16)] ${className}`}
        {...props}
      />
    </label>
  );
}