import { cn } from "@/lib/utils";
import { ReactNode, useEffect, useState } from "react";

export function SectionHeader({
  kicker,
  title,
  subtitle,
  right,
}: {
  kicker: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:flex sm:flex-wrap sm:justify-between">
      <div className="min-w-0">
        <p className="text-[11px] tracking-[0.2em] uppercase text-[var(--gold)]">{kicker}</p>
        <h2 className="font-serif text-2xl md:text-3xl text-primary mt-1 truncate">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-[var(--card)]/50 p-10 text-center">
      <p className="font-serif text-lg text-primary">{title}</p>
      {hint && <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function Card({
  children,
  className,
  onClick,
  interactive,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  interactive?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-xl bg-[var(--card)] p-5 ring-1 ring-border/60",
        "shadow-[var(--shadow-sm)] transition-all duration-200",
        interactive && "cursor-pointer hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5",
        !interactive && "hover:shadow-[var(--shadow-md)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Pill({
  children,
  active,
  onClick,
  tone = "default",
}: {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
  tone?: "default" | "gold" | "forest";
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1 rounded-full text-xs font-medium border transition-colors whitespace-nowrap",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : tone === "gold"
            ? "border-[var(--gold)]/40 text-[var(--gold)] hover:bg-[var(--gold)]/10"
            : "border-border text-muted-foreground hover:text-primary hover:bg-secondary",
      )}
    >
      {children}
    </button>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

type BadgeVariant = "default" | "success" | "warning" | "danger" | "gold";
export function Badge({
  children,
  variant = "default",
  className,
}: {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}) {
  const styles: Record<BadgeVariant, string> = {
    default: "bg-secondary text-secondary-foreground border-border",
    success: "bg-[var(--forest)]/10 text-[var(--forest)] border-[var(--forest)]/30",
    warning: "bg-[var(--gold)]/10 text-[var(--gold)] border-[var(--gold)]/30",
    danger: "bg-[var(--destructive)]/10 text-[var(--destructive)] border-[var(--destructive)]/30",
    gold: "bg-[var(--gold)]/15 text-[var(--gold)] border-[var(--gold)]/40",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border",
        styles[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Stat({
  kicker,
  value,
  subtitle,
  tone = "primary",
  className,
}: {
  kicker: string;
  value: ReactNode;
  subtitle?: string;
  tone?: "primary" | "gold" | "forest" | "danger";
  className?: string;
}) {
  const toneClass = {
    primary: "text-primary",
    gold: "text-[var(--gold)]",
    forest: "text-[var(--forest)]",
    danger: "text-[var(--destructive)]",
  }[tone];
  return (
    <div
      className={cn(
        "rounded-xl bg-[var(--card)] ring-1 ring-border/60 p-5 shadow-[var(--shadow-sm)]",
        className,
      )}
    >
      <p className="text-[11px] tracking-[0.2em] uppercase text-muted-foreground">{kicker}</p>
      <p className={cn("font-serif text-3xl md:text-4xl mt-1", toneClass)}>{value}</p>
      {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
    </div>
  );
}

export function ProgressBar({
  value,
  label,
  showPercent = false,
  tone = "gold",
  animated = true,
}: {
  value: number;
  label?: string;
  showPercent?: boolean;
  tone?: "gold" | "forest";
  animated?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const barColor = tone === "gold" ? "bg-[var(--gold)]" : "bg-[var(--forest)]";
  return (
    <div>
      {(label || showPercent) && (
        <div className="flex justify-between text-xs mb-1.5">
          {label && <span className="text-muted-foreground font-medium">{label}</span>}
          {showPercent && <span className="text-muted-foreground">{clamped}%</span>}
        </div>
      )}
      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full", barColor, animated && "animate-grow")}
          style={{ width: `${clamped}%`, "--target-width": `${clamped}%` } as React.CSSProperties}
        />
      </div>
    </div>
  );
}

/* ---------- Formatting helpers ---------- */
export function formatDate(iso: string | null | undefined, opts?: { withYear?: boolean }) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    ...(opts?.withYear !== false ? { year: "numeric" } : {}),
  });
}
export function formatMoney(n: number | string | null | undefined) {
  const num = Number(n ?? 0);
  return "₹" + num.toLocaleString("en-IN");
}
export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const target = new Date(iso).getTime();
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((target - now.getTime()) / 86400000);
}

export const AI_LOADING_MESSAGES = [
  "Thinking deeply...",
  "Connecting the dots...",
  "Drawing from the best minds...",
  "Crafting your response...",
  "Almost ready...",
];

export function AIThinking({ messages = AI_LOADING_MESSAGES }: { messages?: string[] }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setIdx((i) => (i + 1) % messages.length), 2000);
    return () => window.clearInterval(id);
  }, [messages.length]);
  return (
    <div className="flex items-center gap-3 p-4 bg-secondary/50 rounded-xl">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-[var(--gold)] animate-bounce"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
      <p className="text-sm text-muted-foreground font-serif italic">{messages[idx]}</p>
    </div>
  );
}

export function AIError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive">
      <p className="font-medium">Could not get a response</p>
      <p className="mt-1 text-xs opacity-80">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-2 text-xs underline">
          Try again
        </button>
      )}
    </div>
  );
}
