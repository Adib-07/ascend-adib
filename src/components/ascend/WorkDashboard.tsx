import { useMemo } from "react";
import { useClients, useWorkProjects, useFinanceEntries, useOutreach } from "@/lib/ascend-hooks";
import { Card, EmptyState, SectionHeader, Stat, ProgressBar, Badge, formatDate, formatMoney, daysUntil } from "./ui-bits";
import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

const STAGE_ORDER = ["Lead", "Proposal", "Negotiation", "Won", "Lost"] as const;

export default function WorkDashboard() {
  const clients = useClients();
  const projects = useWorkProjects();
  const finance = useFinanceEntries();
  const outreach = useOutreach();

  const month = new Date().toISOString().slice(0, 7);
  const monthEntries = (finance.list.data ?? []).filter(e => e.entry_date.startsWith(month));
  const revenue = monthEntries.filter(e => e.type === "Income").reduce((s, e) => s + Number(e.amount), 0);
  const expenses = monthEntries.filter(e => e.type === "Expense").reduce((s, e) => s + Number(e.amount), 0);

  const activeClients = (clients.list.data ?? []).filter(c => c.status === "Active").length;
  const activeProjects = (projects.list.data ?? []).filter(p => p.status === "Active");

  const recentActivity = useMemo(() => {
    return [...(finance.list.data ?? [])]
      .sort((a, b) => (a.entry_date < b.entry_date ? 1 : -1))
      .slice(0, 5);
  }, [finance.list.data]);

  const pipelineCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const o of outreach.list.data ?? []) {
      const stage = o.status ?? "Lead";
      map[stage] = (map[stage] ?? 0) + 1;
    }
    return map;
  }, [outreach.list.data]);

  const isEmpty = (clients.list.data?.length ?? 0) === 0 && (projects.list.data?.length ?? 0) === 0 && monthEntries.length === 0;

  return (
    <div className="space-y-8">
      <SectionHeader kicker="Work Studio" title="The Overview" subtitle="Your business, at a glance." />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat kicker={`Revenue · ${new Date().toLocaleString("en-IN", { month: "long" })}`} value={formatMoney(revenue)} tone="forest" subtitle={`Net ${formatMoney(revenue - expenses)}`} />
        <Stat kicker="Active Clients" value={activeClients} tone="gold" subtitle={`${clients.list.data?.length ?? 0} total`} />
        <Stat kicker="Active Projects" value={activeProjects.length} tone="primary" subtitle={`${projects.list.data?.length ?? 0} total`} />
      </div>

      {isEmpty ? (
        <EmptyState title="No signal yet." hint="Add a client, log an income entry, or move a lead through your pipeline to see the room fill." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <p className="text-[11px] tracking-[0.2em] uppercase text-[var(--gold)] mb-4">Recent Activity</p>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No entries yet.</p>
            ) : (
              <ol className="space-y-3">
                {recentActivity.map(e => (
                  <li key={e.id} className="flex items-start gap-3">
                    <span className={cn("mt-0.5 rounded-full p-1", e.type === "Income" ? "bg-[var(--forest)]/10 text-[var(--forest)]" : "bg-[var(--destructive)]/10 text-[var(--destructive)]")}>
                      {e.type === "Income" ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-primary truncate">{e.description}</p>
                      <p className="text-[11px] text-muted-foreground">{formatDate(e.entry_date)} · {e.category || "—"}</p>
                    </div>
                    <p className={cn("text-sm font-medium whitespace-nowrap", e.type === "Income" ? "text-[var(--forest)]" : "text-[var(--destructive)]")}>
                      {e.type === "Income" ? "+" : "−"}{formatMoney(e.amount)}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <Card>
            <p className="text-[11px] tracking-[0.2em] uppercase text-[var(--gold)] mb-4">Pipeline</p>
            <div className="grid grid-cols-5 gap-2">
              {STAGE_ORDER.map(s => (
                <div key={s} className="rounded-lg bg-secondary/50 p-2 text-center">
                  <p className="text-[10px] tracking-wider uppercase text-muted-foreground">{s}</p>
                  <p className="font-serif text-2xl text-primary mt-1">{pipelineCounts[s] ?? 0}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-4">{(outreach.list.data ?? []).length} total leads in the pipeline.</p>
          </Card>
        </div>
      )}

      {activeProjects.length > 0 && (
        <div>
          <p className="text-[11px] tracking-[0.2em] uppercase text-[var(--gold)] mb-3">Active Projects</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeProjects.map(p => {
              const client = (clients.list.data ?? []).find(c => c.id === p.client_id);
              const days = daysUntil(p.deadline);
              const deadlineTone: "success" | "warning" | "danger" | "default" =
                days == null ? "default" : days < 7 ? "danger" : days < 30 ? "warning" : "success";
              return (
                <Card key={p.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="font-serif text-lg text-primary truncate">{p.name}</h4>
                      <p className="text-xs text-muted-foreground truncate">{client?.name ?? p.type ?? "—"}</p>
                    </div>
                    {p.deadline && (
                      <Badge variant={deadlineTone}>
                        {days != null && days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "Due today" : `${days}d left`}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-3">
                    <ProgressBar value={p.progress} showPercent tone="gold" />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{formatDate(p.deadline)}</span>
                    <span className="font-medium text-[var(--gold)]">{formatMoney(p.revenue)}</span>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
