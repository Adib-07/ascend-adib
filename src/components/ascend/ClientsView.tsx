import { useState } from "react";
import { useClients, type Client } from "@/lib/ascend-hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2, Star } from "lucide-react";
import { SectionHeader, EmptyState, Card, Pill } from "./ui-bits";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const STATUSES = ["Active", "Prospect", "Paused", "Archived"];

function statusClass(s: string | null) {
  if (s === "Active") return "text-[var(--forest)] bg-[var(--forest)]/10 border-[var(--forest)]/30";
  if (s === "Prospect") return "text-[var(--gold)] bg-[var(--gold)]/10 border-[var(--gold)]/30";
  if (s === "Paused") return "text-muted-foreground bg-secondary border-border";
  return "text-muted-foreground bg-secondary/50 border-border";
}

export default function ClientsView() {
  const { list, create, update, remove } = useClients();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [draft, setDraft] = useState({ name: "", platform: "", status: "Active", revenue: 0, contact: "", rating: 5 });
  const [filter, setFilter] = useState<string>("All");
  const all = list.data ?? [];
  const items = filter === "All" ? all : all.filter(c => c.status === filter);

  function openNew() { setEditing(null); setDraft({ name: "", platform: "", status: "Active", revenue: 0, contact: "", rating: 5 }); setOpen(true); }
  function openEdit(c: Client) { setEditing(c); setDraft({ name: c.name, platform: c.platform ?? "", status: c.status ?? "Active", revenue: Number(c.revenue), contact: c.contact ?? "", rating: c.rating ?? 5 }); setOpen(true); }
  async function save() {
    if (!draft.name.trim()) { toast.error("Name required"); return; }
    try {
      if (editing) await update.mutateAsync({ id: editing.id, ...draft });
      else await create.mutateAsync(draft);
      setOpen(false); toast.success("Saved");
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  return (
    <div className="space-y-6">
      <SectionHeader kicker="Clients" title="The Roster"
        subtitle="Relationships, not transactions."
        right={<Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" />Add client</Button>} />

      <div className="flex gap-2 overflow-x-auto pb-1">
        {["All", ...STATUSES].map(f => <Pill key={f} active={filter === f} onClick={() => setFilter(f)}>{f}</Pill>)}
      </div>

      {items.length === 0 ? <EmptyState title="No clients yet." hint="Add your first." /> : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(c => (
            <Card key={c.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-serif text-lg text-primary truncate">{c.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{c.platform || "—"}</p>
                </div>
                <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold border shrink-0", statusClass(c.status))}>{c.status}</span>
              </div>
              <div className="flex items-center justify-between mt-3">
                <p className="font-serif text-xl text-[var(--gold)]">₹{Number(c.revenue).toLocaleString()}</p>
                <div className="flex">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className={cn("h-3 w-3", i < (c.rating ?? 0) ? "fill-[var(--gold)] text-[var(--gold)]" : "text-border")} />)}</div>
              </div>
              {c.contact && <p className="text-xs text-muted-foreground mt-2 truncate">{c.contact}</p>}
              <div className="flex justify-end gap-1 mt-3">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove.mutate(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[var(--card)]">
          <DialogHeader><DialogTitle className="font-serif text-2xl text-primary">{editing ? "Edit client" : "New client"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Platform</Label><Input value={draft.platform} onChange={e => setDraft({ ...draft, platform: e.target.value })} placeholder="Upwork, Direct..." /></div>
              <div><Label>Status</Label>
                <Select value={draft.status} onValueChange={v => setDraft({ ...draft, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Total revenue (₹)</Label><Input type="number" value={draft.revenue} onChange={e => setDraft({ ...draft, revenue: Number(e.target.value) })} /></div>
              <div><Label>Rating (1-5)</Label><Input type="number" min={1} max={5} value={draft.rating} onChange={e => setDraft({ ...draft, rating: Number(e.target.value) })} /></div>
            </div>
            <div><Label>Contact</Label><Input value={draft.contact} onChange={e => setDraft({ ...draft, contact: e.target.value })} placeholder="email / handle" /></div>
          </div>
          <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
