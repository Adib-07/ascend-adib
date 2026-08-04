import { useMemo, useState } from "react";
import { useWorkProjects, useClients, type WorkProject } from "@/lib/ascend-hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2, User as UserIcon, Coins } from "lucide-react";
import { SectionHeader, Card, ProgressBar, EmptyState, formatMoney, formatDate, daysUntil } from "./ui-bits";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STATUSES = ["Planning", "Active", "Paused", "Done"] as const;
const TYPES = ["Freelance", "Personal", "Startup"] as const;

const statusTint: Record<string, string> = {
  Planning: "bg-slate-500/5 ring-slate-500/20",
  Active: "bg-[var(--forest)]/5 ring-[var(--forest)]/25",
  Paused: "bg-[var(--gold)]/5 ring-[var(--gold)]/20",
  Done: "bg-[var(--gold)]/10 ring-[var(--gold)]/30",
};
const typeBadge: Record<string, string> = {
  Freelance: "bg-[var(--gold)]/15 text-[var(--gold)] border-[var(--gold)]/40",
  Personal: "bg-[var(--forest)]/15 text-[var(--forest)] border-[var(--forest)]/30",
  Startup: "bg-purple-500/10 text-purple-700 border-purple-500/30",
};

export default function WorkProjectsView() {
  const { list, create, update, remove } = useWorkProjects();
  const clientsQ = useClients();
  const clients = clientsQ.list.data ?? [];
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<WorkProject | null>(null);
  const [draft, setDraft] = useState({
    name: "", type: "Freelance", client_id: "", deadline: "", revenue: 0, progress: 0, status: "Planning",
  });

  const projects = list.data ?? [];
  const columns = useMemo(() => {
    return STATUSES.map(s => {
      const cards = projects.filter(p => (p.status ?? "Planning") === s);
      const total = cards.reduce((sum, c) => sum + Number(c.revenue), 0);
      return { s, cards, total };
    });
  }, [projects]);

  function openNew(status?: (typeof STATUSES)[number]) {
    setEditing(null);
    setDraft({ name: "", type: "Freelance", client_id: "", deadline: "", revenue: 0, progress: 0, status: status ?? "Planning" });
    setOpen(true);
  }
  function openEdit(p: WorkProject) {
    setEditing(p);
    setDraft({
      name: p.name, type: p.type ?? "Freelance", client_id: p.client_id ?? "",
      deadline: p.deadline ?? "", revenue: Number(p.revenue), progress: p.progress, status: p.status ?? "Planning",
    });
    setOpen(true);
  }
  async function save() {
    if (!draft.name.trim()) { toast.error("Name required"); return; }
    const payload = { ...draft, client_id: draft.client_id || null, deadline: draft.deadline || null };
    try {
      if (editing) { await update.mutateAsync({ id: editing.id, ...payload }); toast.success("Project updated"); }
      else { await create.mutateAsync(payload); toast.success("Project added"); }
      setOpen(false);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Something went wrong — try again"); }
  }
  async function moveTo(p: WorkProject, status: string) {
    try { await update.mutateAsync({ id: p.id, status }); }
    catch { toast.error("Failed to move card"); }
  }
  async function del(id: string) {
    try { await remove.mutateAsync(id); toast.success("Project removed"); }
    catch { toast.error("Something went wrong — try again"); }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        kicker="Projects" title="The Atelier"
        subtitle="Client work, organized like a portfolio."
        right={<Button size="sm" onClick={() => openNew()} className="min-h-[44px]"><Plus className="h-4 w-4 mr-1" />New Project</Button>}
      />

      {projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          hint="Create your first project — a plan is the seed of every finished thing."
          action={<Button size="sm" onClick={() => openNew()}><Plus className="h-4 w-4 mr-1" />New Project</Button>}
        />
      ) : (
        <div className="overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0 snap-x">
          <div className="grid grid-flow-col md:grid-flow-row md:grid-cols-4 auto-cols-[85%] md:auto-cols-auto gap-4">
            {columns.map(({ s, cards, total }) => (
              <div key={s} className={cn("rounded-xl ring-1 p-3 snap-start min-h-[240px]", statusTint[s])}>
                <div className="flex items-center justify-between mb-3 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="text-[11px] tracking-[0.2em] uppercase text-primary font-medium truncate">{s}</p>
                    <span className="text-[10px] font-semibold rounded-full bg-[var(--card)] ring-1 ring-border px-1.5 py-0.5 text-muted-foreground">{cards.length}</span>
                  </div>
                  <button onClick={() => openNew(s)} className="text-[var(--gold)] hover:opacity-80" aria-label={`Add project in ${s}`}>
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                {total > 0 && <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">{formatMoney(total)} total</p>}
                <div className="space-y-2">
                  {cards.length === 0 ? (
                    <div className="text-center py-10 px-4">
                      <p className="font-serif text-sm text-muted-foreground">No projects yet</p>
                      <button onClick={() => openNew(s)} className="mt-2 text-xs text-[var(--gold)] hover:text-primary font-medium">+ Add project</button>
                    </div>
                  ) : cards.map(p => {
                    const client = clients.find(c => c.id === p.client_id);
                    const d = daysUntil(p.deadline);
                    let deadlineText = "";
                    let deadlineClass = "text-muted-foreground";
                    if (d != null) {
                      if (d < 0) { deadlineText = `${Math.abs(d)}d overdue`; deadlineClass = "text-[var(--destructive)] font-semibold"; }
                      else if (d === 0) { deadlineText = "Due today"; deadlineClass = "text-[var(--destructive)]"; }
                      else if (d <= 3) { deadlineText = `${d} day${d === 1 ? "" : "s"} left`; deadlineClass = "text-[var(--destructive)]"; }
                      else if (d <= 14) { deadlineText = `${d} days left`; deadlineClass = "text-[var(--gold)]"; }
                      else { deadlineText = `${d} days left`; deadlineClass = "text-[var(--forest)]"; }
                    }
                    return (
                      <Card key={p.id} className="p-3 animate-in fade-in duration-200">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-serif text-sm font-medium text-primary truncate flex-1 min-w-0">{p.name}</h4>
                          <span className={cn("inline-block px-1.5 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider border shrink-0", typeBadge[p.type ?? "Freelance"] ?? typeBadge.Freelance)}>{p.type ?? "Freelance"}</span>
                        </div>
                        {client && (
                          <p className="text-xs text-muted-foreground mt-1 truncate flex items-center gap-1"><UserIcon className="h-3 w-3" />{client.name}</p>
                        )}
                        {deadlineText && <p className={cn("text-[11px] mt-1", deadlineClass)}>{deadlineText}</p>}
                        <div className="mt-2"><ProgressBar value={p.progress} tone="gold" /></div>
                        <div className="flex items-center justify-between mt-2 text-[11px]">
                          <span className="text-muted-foreground">{p.progress}%</span>
                          <span className="inline-flex items-center gap-0.5 text-[var(--gold)] font-medium"><Coins className="h-3 w-3" />{formatMoney(p.revenue)}</span>
                        </div>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50 gap-2">
                          <Select value={p.status ?? "Planning"} onValueChange={v => moveTo(p, v)}>
                            <SelectTrigger className="h-7 text-[11px] w-24"><SelectValue /></SelectTrigger>
                            <SelectContent>{STATUSES.map(st => <SelectItem key={st} value={st}>{st}</SelectItem>)}</SelectContent>
                          </Select>
                          <div className="flex gap-0.5">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)} aria-label="Edit"><Pencil className="h-3 w-3" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => del(p.id)} aria-label="Delete"><Trash2 className="h-3 w-3" /></Button>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[var(--card)] max-w-lg">
          <DialogHeader><DialogTitle className="font-serif text-2xl text-primary">{editing ? "Edit project" : "New project"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label htmlFor="p-name">Name</Label><Input id="p-name" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={draft.type} onValueChange={v => setDraft({ ...draft, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={draft.status} onValueChange={v => setDraft({ ...draft, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Client</Label>
              <Select value={draft.client_id || "_none"} onValueChange={v => setDraft({ ...draft, client_id: v === "_none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">None</SelectItem>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="p-deadline">Deadline</Label><Input id="p-deadline" type="date" value={draft.deadline} onChange={e => setDraft({ ...draft, deadline: e.target.value })} /></div>
              <div><Label htmlFor="p-rev">Revenue (₹)</Label><Input id="p-rev" type="number" value={draft.revenue} onChange={e => setDraft({ ...draft, revenue: Number(e.target.value) })} /></div>
            </div>
            <div>
              <Label htmlFor="p-prog">Progress: {draft.progress}%</Label>
              <Input id="p-prog" type="range" min={0} max={100} value={draft.progress} onChange={e => setDraft({ ...draft, progress: Number(e.target.value) })} />
            </div>
            {draft.deadline && <p className="text-xs text-muted-foreground">Due {formatDate(draft.deadline)}</p>}
          </div>
          <DialogFooter><Button onClick={save} className="min-h-[44px]">Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
