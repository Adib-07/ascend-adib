import { cn } from "@/lib/utils";
import { ReactNode } from "react";

export function SectionHeader({ kicker, title, subtitle, right }: { kicker: string; title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="text-[11px] tracking-[0.2em] uppercase text-[var(--gold)]">{kicker}</p>
        <h2 className="font-serif text-2xl md:text-3xl text-primary mt-1">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-[var(--card)]/50 p-10 text-center">
      <p className="font-serif text-lg text-primary">{title}</p>
      {hint && <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">{hint}</p>}
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-lg border border-border bg-[var(--card)] p-5 shadow-sm", className)}>{children}</div>;
}

export function Pill({ children, active, onClick, tone = "default" }: { children: ReactNode; active?: boolean; onClick?: () => void; tone?: "default" | "gold" | "forest" }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1 rounded-full text-xs font-medium border transition-colors whitespace-nowrap",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : tone === "gold"
            ? "border-[var(--gold)]/40 text-[var(--gold)] hover:bg-[var(--gold)]/10"
            : "border-border text-muted-foreground hover:text-primary hover:bg-secondary"
      )}
    >
      {children}
    </button>
  );
}
