import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Search,
  ArrowRight,
  Command as CmdIcon,
  Plus,
  LayoutGrid,
  GraduationCap,
  Target,
  ListChecks,
  Bot,
  Users,
  Briefcase,
  Wallet,
  Flame,
} from "lucide-react";

export type NavItem = {
  mode: "student" | "work";
  tab: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

export const NAV_ITEMS: NavItem[] = [
  { mode: "student", tab: "Daily Tasks", label: "Daily Tasks", icon: ListChecks },
  { mode: "student", tab: "Learning Hub", label: "Learning Hub", icon: GraduationCap },
  { mode: "student", tab: "Habits", label: "Habits", icon: Flame },
  { mode: "student", tab: "Goals", label: "Goals", icon: Target },
  { mode: "student", tab: "CSE Tutor", label: "CSE Tutor", icon: Bot },
  { mode: "work", tab: "Overview", label: "Work Overview", icon: LayoutGrid },
  { mode: "work", tab: "Clients", label: "Clients", icon: Users },
  { mode: "work", tab: "Projects", label: "Projects", icon: Briefcase },
  { mode: "work", tab: "Income", label: "Income", icon: Wallet },
  { mode: "work", tab: "Pipeline", label: "Pipeline", icon: LayoutGrid },
];

export type QuickAction = { label: string; hint: string; run: () => void };

type Props = {
  open: boolean;
  onClose: () => void;
  onNavigate: (mode: "student" | "work", tab: string) => void;
  quickActions?: QuickAction[];
};

export default function CommandPalette({ open, onClose, onNavigate, quickActions = [] }: Props) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const q = query.trim().toLowerCase();
  const navFiltered = useMemo(
    () =>
      NAV_ITEMS.filter(
        (n) => !q || n.label.toLowerCase().includes(q) || n.tab.toLowerCase().includes(q),
      ),
    [q],
  );
  const actionsFiltered = useMemo(
    () => quickActions.filter((a) => !q || a.label.toLowerCase().includes(q)),
    [q, quickActions],
  );

  const flat = [
    ...actionsFiltered.map((a, i) => ({ type: "action" as const, i, item: a })),
    ...navFiltered.map((n, i) => ({ type: "nav" as const, i, item: n })),
  ];

  useEffect(() => {
    setSelected(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelected((s) => Math.min(flat.length - 1, s + 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelected((s) => Math.max(0, s - 1));
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const chosen = flat[selected];
        if (!chosen) return;
        if (chosen.type === "action") {
          chosen.item.run();
          onClose();
        } else {
          onNavigate(chosen.item.mode, chosen.item.tab);
          onClose();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, flat, selected, onClose, onNavigate]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-[var(--foreground)]/50 backdrop-blur-md animate-in fade-in duration-150 px-4 py-[10vh]"
      onClick={onClose}
    >
      <div
        className="mx-auto max-w-xl rounded-2xl bg-[var(--card)] shadow-[var(--shadow-xl)] ring-1 ring-border/70 overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <Search className="h-5 w-5 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="What are you looking for?"
            className="flex-1 bg-transparent border-0 outline-none text-lg font-serif text-primary placeholder:text-muted-foreground/70"
          />
          <kbd className="hidden sm:inline text-[10px] font-mono text-muted-foreground border border-border rounded px-1.5 py-0.5">
            ESC
          </kbd>
        </div>

        <div className="max-h-[50vh] overflow-y-auto py-2">
          {actionsFiltered.length > 0 && (
            <Group label="Quick Actions">
              {actionsFiltered.map((a, i) => {
                const idx = i;
                const isSel = flat[selected]?.type === "action" && flat[selected]?.i === idx;
                return (
                  <Row
                    key={a.label}
                    icon={<Plus className="h-4 w-4" />}
                    label={a.label}
                    hint={a.hint}
                    active={isSel}
                    onClick={() => {
                      a.run();
                      onClose();
                    }}
                    onHover={() => setSelected(idx)}
                  />
                );
              })}
            </Group>
          )}

          {navFiltered.length > 0 && (
            <Group label="Navigate">
              {navFiltered.map((n, i) => {
                const idx = actionsFiltered.length + i;
                const isSel = flat[selected]?.type === "nav" && flat[selected]?.i === i;
                const Icon = n.icon;
                return (
                  <Row
                    key={`${n.mode}-${n.tab}`}
                    icon={<Icon className="h-4 w-4" />}
                    label={n.label}
                    hint={n.mode === "student" ? "Student Mode" : "Work Mode"}
                    active={isSel}
                    onClick={() => {
                      onNavigate(n.mode, n.tab);
                      onClose();
                    }}
                    onHover={() => setSelected(idx)}
                  />
                );
              })}
            </Group>
          )}

          {flat.length === 0 && (
            <div className="px-6 py-10 text-center text-sm text-muted-foreground">
              Nothing matches "<span className="font-medium text-primary">{query}</span>".
            </div>
          )}
        </div>

        <div className="border-t border-border px-4 py-2 flex items-center gap-4 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <CmdIcon className="h-3 w-3" />K to open
          </span>
          <span>↑↓ navigate</span>
          <span>↵ select</span>
        </div>
      </div>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-2">
      <p className="px-3 pt-2 pb-1 text-[10px] tracking-[0.2em] uppercase text-[var(--gold)]">
        {label}
      </p>
      <div>{children}</div>
    </div>
  );
}

function Row({
  icon,
  label,
  hint,
  active,
  onClick,
  onHover,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  active?: boolean;
  onClick: () => void;
  onHover: () => void;
}) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={onHover}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-colors",
        active ? "bg-secondary text-primary" : "text-foreground hover:bg-secondary/60",
      )}
    >
      <span className={cn("shrink-0", active ? "text-[var(--gold)]" : "text-muted-foreground")}>
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium truncate">{label}</span>
        {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
      </span>
      {active && <ArrowRight className="h-3.5 w-3.5 text-[var(--gold)]" />}
    </button>
  );
}
