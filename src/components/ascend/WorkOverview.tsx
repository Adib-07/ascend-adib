import { useEffect, useMemo, useState } from "react";
import { useClients, useWorkProjects, useFinanceEntries, useOutreach } from "@/lib/ascend-hooks";
import { useTasks, todayISO } from "@/lib/ascend-data";
import { Card, EmptyState, Stat, ProgressBar, Badge, formatDate, formatMoney, daysUntil } from "./ui-bits";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ArrowUpRight, ArrowDownRight, Play, Plus, Users, Briefcase, Wallet, ListChecks, ArrowRight,
} from "lucide-react";

const PIPELINE_STAGES = ["Lead", "Proposal", "Active", "Won"] as const;

type QAction = { icon: React.ReactNode; label: string; onClick: () => void };

export default function WorkOverview({
  onStartFocus, onNavigate,
}: {
  onStartFocus: () => void;
  onNavigate: (tab: "Clients" | "Projects" | "Income" | "Pipeline", filter?: string) => void;
}) {
  const clients = useClients();
  const projects = useWorkProjects();
  const finance = useFinanceEntries();
  const outreach = useOutreach();
  const tasksQ = useTasks();

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const month = new Date().toISOString().slice(0, 7);
  const monthEntries = (finance.list.data ?? []).filter(e => e.entry_date.startsWith(month));
  const revenue = monthEntries.filter(e => e.type === "Income").reduce((s, e) => s + Number(e.amount), 0);
  const activeClientsCount = (clients.list.data ?? []).filter(c => c.status === "Active").length;
  const activeProjects = (projects.list.data ?? []).filter(p => p.status === "Active");
  const today = todayISO();
  const openTasks = (tasksQ.data ?? []).filter(t => !t.done && (!t.due_date || t.due_date <= today));

  const recent = useMemo(() =>
    [...(finance.list.data ?? [])]
      .sort((a, b) => (a.entry_date < b.entry_date ? 1 : -1))
      .slice(0, 5), [finance.list.data]);

  const pipelineCounts = useMemo(() => {
    const map: Record<string, number> = {};
    const source = [...(outreach.list.data ?? []), ...(clients.list.data ?? [])];
    for (const o of source) {
      const s = o.status ?? "Lead";
      const key = s === "Proposal Sent" ? "Proposal" : s === "Lost" ? "Won" : s;
      map[key] = (map[key] ?? 0) + 1;
    }
    return map;
  }, [outreach.list.data, clients.list.data]);

  const firstTask = openTasks[0];

  const quickActions: QAction[] = [
    { icon: <Users className="h-5 w-5" />, label: "New Client", onClick: () => onNavigate("Clients") },
    { icon: <Briefcase className="h-5 w-5" />, label: "New Project", onClick: () => onNavigate("Projects") },
    { icon: <Wallet className="h-5 w-5" />, label: "Log Income", onClick: () => onNavigate("Income") },
    { icon: <ListChecks className="h-5 w-5" />, label: "New Task", onClick: () => onNavigate("Pipeline") },
  ];

  const hour = now.getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const isEmpty = (clients.list.data?.length ?? 0) + (projects.list.data?.length ?? 0) + monthEntries.length === 0;

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div>
        <p className="text-[11px] tracking-[0.2em] uppercase text-[var(--gold)] font-medium">Work Mode · AI Freelancer & Engineer</p>
        <h1 className="font-serif text-3xl md:text-4xl text-primary mt-1">{greet}, Adib.</h1>
        <p className="text-sm text-muted-foreground mt-1">{now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
      </div>

      {/* KPI stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Stat kicker="💰 Revenue · This Month" value={formatMoney(revenue)} tone="forest" />
        <Stat kicker="👥 Active Clients" value={activeClientsCount} tone="gold" />
        <Stat kicker="🚀 Active Projects" value={activeProjects.length} tone="primary" />
        <Stat kicker="📋 Open Tasks" value={openTasks.length} tone={openTasks.length > 5 ? "danger" : "primary"} />
      </div>

      {isEmpty && (
        <EmptyState
          title="Your studio is quiet."
          hint="Add a client, log income, or start a project — the room fills as you build."
          action={<Button size="sm" onClick={() => onNavigate("Clients")}><Plus className="h-4 w-4 mr-1" />Add first client</Button>}
        />
      )}

      {/* Focus + Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <p className="text-[11px] tracking-[0.2em] uppercase text-[var(--gold)] font-medium">Today's Focus</p>
          <p className="font-serif text-4xl md:text-5xl text-primary mt-2 tabular-nums leading-none">
            {now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </p>
          <div className="mt-4 rounded-lg bg-secondary/50 p-3 min-h-[64px]">
            {firstTask ? (
              <>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Next up</p>
                <p className="text-sm text-primary mt-1 line-clamp-2">{firstTask.title}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground italic">No open tasks. Rest well.</p>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" onClick={onStartFocus}><Play className="h-4 w-4 mr-1" />Start Focus Session</Button>
            <Button size="sm" variant="outline" onClick={() => onNavigate("Pipeline")}><Plus className="h-4 w-4 mr-1" />Add Task</Button>
          </div>
        </Card>

        <Card>
          <p className="text-[11px] tracking-[0.2em] uppercase text-[var(--gold)] font-medium">Quick Actions</p>
          <div className="grid grid-cols-2 gap-3 mt-4">
            {quickActions.map(a => (
              <button
                key={a.label}
                onClick={a.onClick}
                className="group flex flex-col items-start gap-2 rounded-lg border border-border/60 bg-secondary/30 hover:bg-secondary hover:border-[var(--gold)]/50 p-4 min-h-[88px] transition-all text-left"
              >
                <span className="text-[var(--gold)] group-hover:scale-110 transition-transform">{a.icon}</span>
                <span className="text-sm font-medium text-primary">+ {a.label}</span>
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* Active Projects + Recent Activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] tracking-[0.2em] uppercase text-[var(--gold)] font-medium">Active Projects</p>
            <button onClick={() => onNavigate("Projects")} className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-0.5">
              View all <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          {activeProjects.length === 0 ? (
            <p className="text-sm text-muted-foreground italic py-6 text-center">No active projects.</p>
          ) : (
            <ul className="space-y-3">
              {activeProjects.slice(0, 4).map(p => {
                const client = (clients.list.data ?? []).find(c => c.id === p.client_id);
                const d = daysUntil(p.deadline);
                const tone: "success" | "warning" | "danger" | "default" =
                  d == null ? "default" : d < 7 ? "danger" : d < 30 ? "warning" : "success";
                return (
                  <li key={p.id} className="rounded-lg bg-secondary/30 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-serif text-sm text-primary truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{client?.name ?? p.type ?? "—"}</p>
                      </div>
                      {p.deadline && (
                        <Badge variant={tone}>
                          {d != null && d < 0 ? `${Math.abs(d)}d over` : d === 0 ? "Today" : `${d}d`}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="flex-1"><ProgressBar value={p.progress} tone="gold" /></div>
                      <span className="text-xs font-medium text-[var(--gold)] whitespace-nowrap">{formatMoney(p.revenue)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] tracking-[0.2em] uppercase text-[var(--gold)] font-medium">Recent Activity</p>
            <button onClick={() => onNavigate("Income")} className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-0.5">
              Ledger <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground italic py-6 text-center">No entries yet.</p>
          ) : (
            <ol className="space-y-3">
              {recent.map(e => (
                <li key={e.id} className="flex items-start gap-3">
                  <span className={cn("mt-1 h-2 w-2 rounded-full shrink-0", e.type === "Income" ? "bg-[var(--forest)]" : "bg-[var(--destructive)]")} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-primary truncate">{e.description}</p>
                    <p className="text-[11px] text-muted-foreground">{formatDate(e.entry_date)} · {e.category || "—"}</p>
                  </div>
                  <p className={cn("text-sm font-medium whitespace-nowrap inline-flex items-center gap-0.5", e.type === "Income" ? "text-[var(--forest)]" : "text-[var(--destructive)]")}>
                    {e.type === "Income" ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {formatMoney(e.amount)}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      {/* Pipeline Overview */}
      <Card>
        <p className="text-[11px] tracking-[0.2em] uppercase text-[var(--gold)] font-medium mb-4">Pipeline Overview</p>
        <div className="grid grid-cols-4 gap-2 md:gap-3">
          {PIPELINE_STAGES.map((s, i) => (
            <button
              key={s}
              onClick={() => onNavigate("Pipeline", s)}
              className="group relative rounded-lg bg-secondary/50 hover:bg-secondary p-3 md:p-4 text-left transition-all hover:ring-1 hover:ring-[var(--gold)]/40"
            >
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{s}</p>
              <p className="font-serif text-2xl md:text-3xl text-primary mt-1">{pipelineCounts[s] ?? 0}</p>
              {i < PIPELINE_STAGES.length - 1 && (
                <ArrowRight className="absolute -right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/40 hidden md:block" />
              )}
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
