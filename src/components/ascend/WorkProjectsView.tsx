import { useState } from "react";
import { useWorkProjects, useClients, type WorkProject } from "@/lib/ascend-hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { SectionHeader, Card } from "./ui-bits";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

const STATUSES = ["Planning", "Active", "Paused", "Done"] as const;

export default function WorkProjectsView() {
  const { list, create, update, remove } = useWorkProjects();
  const clientsQ = useClients();
  const clients = clientsQ.list.data ?? [];
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<WorkProject | null>(null);
  const [draft, setDraft] = useState({ name: "", type: "", client_id: "", deadline: "", revenue: 0, progress: 0, status: "Planning" });

  const projects = list.data ?? [];
  function openNew() { setEditing(null); setDraft({ name: "", type: "", client_id: "", deadline: "", revenue: 0, progress: 0, status: "Planning" }); setOpen(true); }
  function openEdit(p: WorkProject) { setEditing(p); setDraft({ name: p.name, type: p.type ?? "", client_id: p.client_id ?? "", deadline: p.deadline ?? "", revenue: Number(p.revenue), progress: p.progress, status: p.status ?? "Planning" }); setOpen(true); }
  async function save() {
    if (!draft.name.trim()) { toast.error("Name required"); return; }
    const payload = { ...draft, client_id: draft.client_id || null, deadline: draft.deadline || null };
    try {
      if (editing) await update.mutateAsync({ id: editing.id, ...payload });
      else await create.mutateAsync(payload);
      setOpen(false); toast.success("Saved");
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  return (
    <div className="space-y-6">
      <SectionHeader kicker="Projects" title="The Atelier"
        subtitle="Client work, organized like a portfolio."
        right={<Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" />New project</Button>} />

      <div className="grid lg:grid-cols-4 md:grid-cols-2 gap-4">
        {STATUSES.map(s => {
          const cards = projects.filter(p => (p.status ?? "Planning") === s);
          return (
            <div key={s} className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] tracking-[0.2em] uppercase text-[var(--gold)]">{s}</p>
                <span className="text-xs text-muted-foreground">{cards.length}</span>
              </div>
              <div className="space-y-3 min-h-[80px]">
                {cards.length === 0 ? <p className="text-xs text-muted-foreground italic">Empty</p> : cards.map(p => {
                  const client = clients.find(c => c.id === p.client_id);
                  return (
                    <Card key={p.id} className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="font-medium text-primary truncate">{p.name}</h4>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{p.type || "—"}</p>
                        </div>
                      </div>
                      {client && <p className="text-xs text-muted-foreground mt-1 truncate">{client.name}</p>}
                      {p.deadline && <p className="text-xs text-muted-foreground mt-0.5">Due {new Date(p.deadline).toLocaleDateString()}</p>}
                      <p className="font-serif text-base text-[var(--gold)] mt-2">₹{Number(p.revenue).toLocaleString()}</p>
                      <div className="mt-2"><Progress value={p.progress} /><p className="text-[10px] text-muted-foreground mt-1">{p.progress}%</p></div>
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
                        <Select value={p.status ?? "Planning"} onValueChange={v => update.mutate({ id: p.id, status: v })}>
                          <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                          <SelectContent>{STATUSES.map(st => <SelectItem key={st} value={st}>{st}</SelectItem>)}</SelectContent>
                        </Select>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(p)}><Pencil className="h-3 w-3" /></Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => remove.mutate(p.id)}><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[var(--card)]">
          <DialogHeader><DialogTitle className="font-serif text-2xl text-primary">{editing ? "Edit project" : "New project"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Type</Label><Input value={draft.type} onChange={e => setDraft({ ...draft, type: e.target.value })} placeholder="Web app, Design..." /></div>
              <div><Label>Status</Label>
                <Select value={draft.status} onValueChange={v => setDraft({ ...draft, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Client</Label>
              <Select value={draft.client_id || "_none"} onValueChange={v => setDraft({ ...draft, client_id: v === "_none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">None</SelectItem>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Deadline</Label><Input type="date" value={draft.deadline} onChange={e => setDraft({ ...draft, deadline: e.target.value })} /></div>
              <div><Label>Revenue (₹)</Label><Input type="number" value={draft.revenue} onChange={e => setDraft({ ...draft, revenue: Number(e.target.value) })} /></div>
            </div>
            <div><Label>Progress: {draft.progress}%</Label><Input type="range" min={0} max={100} value={draft.progress} onChange={e => setDraft({ ...draft, progress: Number(e.target.value) })} /></div>
          </div>
          <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
