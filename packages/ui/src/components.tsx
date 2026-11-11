"use client";

import * as React from "react";

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/* -------------------------------------------------------------------------- */
/* Button                                                                      */
/* -------------------------------------------------------------------------- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "subtle";
type ButtonSize = "sm" | "md" | "lg";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-amber-400 text-neutral-950 hover:bg-amber-300 active:bg-amber-500 shadow-[0_1px_0_0_rgba(255,255,255,0.3)_inset]",
  secondary:
    "bg-neutral-800 text-neutral-100 hover:bg-neutral-700 border border-neutral-700",
  ghost: "text-neutral-300 hover:bg-neutral-800/70 hover:text-neutral-100",
  danger: "bg-red-600 text-white hover:bg-red-500",
  subtle: "bg-neutral-900 text-neutral-300 hover:bg-neutral-800 border border-neutral-800",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "h-7 px-2.5 text-xs rounded-md gap-1.5",
  md: "h-9 px-3.5 text-sm rounded-lg gap-2",
  lg: "h-11 px-5 text-base rounded-xl gap-2",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export function Button({ variant = "secondary", size = "md", loading, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400",
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
    >
      {loading ? <span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" /> : null}
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Layout                                                                      */
/* -------------------------------------------------------------------------- */

export function Panel({
  title,
  actions,
  children,
  className,
  dense,
}: {
  title?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  dense?: boolean;
}) {
  return (
    <section className={cn("rounded-xl border border-neutral-800 bg-neutral-900/60", className)}>
      {title ? (
        <header className="flex items-center justify-between gap-2 border-b border-neutral-800 px-3 py-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400">{title}</h2>
          {actions}
        </header>
      ) : null}
      <div className={dense ? "p-2" : "p-3"}>{children}</div>
    </section>
  );
}

export function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">{children}</h3>
      {hint ? <span className="text-[10px] text-neutral-500">{hint}</span> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Form controls                                                               */
/* -------------------------------------------------------------------------- */

export function Field({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <label htmlFor={htmlFor} className="block space-y-1">
      <span className="flex items-center justify-between text-[11px] text-neutral-400">
        {label}
        {hint ? <span className="text-neutral-500">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-amber-400 focus:outline-none";

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputClass, props.className)} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(inputClass, "min-h-20 resize-y leading-relaxed", props.className)} />;
}

export function Select({
  options,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[] }) {
  return (
    <select {...props} className={cn(inputClass, "appearance-none pr-6", props.className)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 0.01,
  onChange,
  format,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px] text-neutral-400">
        <span>{label}</span>
        <span className="font-mono text-neutral-300">{format ? format(value) : value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        aria-label={label}
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-neutral-700 accent-amber-400 disabled:opacity-40"
      />
    </div>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
  hint,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-xs text-neutral-300">
        {label}
        {hint ? <span className="ml-1 text-[10px] text-neutral-500">{hint}</span> : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-4 w-8 shrink-0 rounded-full transition-colors disabled:opacity-40",
          checked ? "bg-amber-400" : "bg-neutral-700",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-3 rounded-full bg-neutral-950 transition-all",
            checked ? "left-4.5" : "left-0.5",
          )}
        />
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Feedback                                                                    */
/* -------------------------------------------------------------------------- */

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  const tones = {
    neutral: "bg-neutral-800 text-neutral-300 border-neutral-700",
    success: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
    warning: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    danger: "bg-red-500/10 text-red-300 border-red-500/30",
    info: "bg-sky-500/10 text-sky-300 border-sky-500/30",
  } as const;
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium", tones[tone])}>
      {children}
    </span>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-800 px-6 py-10 text-center">
      <p className="text-sm font-medium text-neutral-200">{title}</p>
      <p className="max-w-sm text-xs leading-relaxed text-neutral-500">{body}</p>
      {action}
    </div>
  );
}

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div role="tablist" className="flex gap-1 rounded-lg bg-neutral-900 p-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={active === t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
            active === t.id ? "bg-neutral-800 text-neutral-100" : "text-neutral-500 hover:text-neutral-300",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="space-y-1">
      {label ? <p className="text-[11px] text-neutral-400">{label}</p> : null}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
        <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
