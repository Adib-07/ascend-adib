import { useMemo, useState } from "react";
import { useClients, type Client } from "@/lib/ascend-hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2, Star, MoreVertical, Search } from "lucide-react";
import { SectionHeader, EmptyState, Card, Pill, formatMoney } from "./ui-bits";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const STATUSES = ["Lead", "Active", "Completed", "Lost"] as const;
const PLATFORMS = ["Upwork", "Fiverr", "LinkedIn", "Direct", "Referral", "Other"] as const;

function statusBadge(s: string | null) {
  const map: Record<string, string> = {
    Lead: "bg-slate-500/15 text-slate-600 border-slate-500/30",
    Active: "bg-[var(--forest)]/15 text-[var(--forest)] border-[var(--forest)]/40",
    Completed: "bg-[var(--gold)]/15 text-[var(--gold)] border-[var(--gold)]/40",
    Lost: "bg-[var(--destructive)]/10 text-[var(--destructive)] border-[var(--destructive)]/30",
  };
  return map[s ?? "Lead"] ?? map.Lead;
}
function platformBadge(p: string | null) {
  const map: Record<string, string> = {
    Upwork: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
    Fiverr: "bg-teal-500/15 text-teal-700 border-teal-500/30",
    LinkedIn: "bg-blue-500/15 text-blue-700 border-blue-500/30",
    Direct: "bg-[var(--forest)]/10 text-[var(--forest)] border-[var(--forest)]/30",
    Referral: "bg-[var(--gold)]/10 text-[var(--gold)] border-[var(--gold)]/30",
  };
  return map[p ?? ""] ?? "bg-secondary text-muted-foreground border-border";
}

type Draft = { name: string; platform: string; status: string; revenue: number; contact: string; rating: number };

export default function ClientsView({ initialFilter }: { initialFilter?: string }) {
  const { list, create, update, remove } = useClients();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [draft, setDraft] = useState<Draft>({ name: "", platform: "Direct", status: "Lead", revenue: 0, contact: "", rating: 5 });
  const [filter, setFilter] = useState<string>(initialFilter ?? "All");
  const [q, setQ] = useState("");
  const [menu, setMenu] = useState<string | null>(null);

  const all = list.data ?? [];
  const items = useMemo(() => {
    const scope = filter === "All" ? all : all.filter(c => c.status === filter);
    if (!q.trim()) return scope;
    const s = q.toLowerCase();
    return scope.filter(c =>
      c.name.toLowerCase().includes(s) ||
      (c.platform ?? "").toLowerCase().includes(s) ||
      (c.contact ?? "").toLowerCase().includes(s),
    );
  }, [all, filter, q]);

  const totalRevenue = useMemo(() => items.reduce((s, c) => s + Number(c.revenue), 0), [items]);

  function openNew() { setEditing(null); setDraft({ name: "", platform: "Direct", status: "Lead", revenue: 0, contact: "", rating: 5 }); setOpen(true); }
  function openEdit(c: Client) { setEditing(c); setDraft({ name: c.name, platform: c.platform ?? "Direct", status: c.status ?? "Lead", revenue: Number(c.revenue), contact: c.contact ?? "", rating: c.rating ?? 5 }); setOpen(true); }
  async function save() {
    if (!draft.name.trim()) { toast.error("Name required"); return; }
    try {
      if (editing) { await update.mutateAsync({ id: editing.id, ...draft }); toast.success("Client updated"); }
      else { await create.mutateAsync(draft); toast.success("Client added"); }
      setOpen(false);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Something went wrong — try again"); }
  }
  async function del(id: string) {
    try { await remove.mutateAsync(id); toast.success("Client removed"); }
    catch { toast.error("Something went wrong — try again"); }
    setMenu(null);
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        kicker="Clients"
        title="The Roster"
        subtitle="Every relationship, tracked with care."
        right={<Button size="sm" onClick={openNew} className="min-h-[44px]"><Plus className="h-4 w-4 mr-1" />Add Client</Button>}
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-2 overflow-x-auto pb-1 flex-1">
          {(["All", ...STATUSES] as const).map(f => <Pill key={f} active={filter === f} onClick={() => setFilter(f)}>{f}</Pill>)}
        </div>
        <div className="relative sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search…" className="pl-9" aria-label="Search clients" />
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="No clients yet"
          hint="Start by adding your first client — every empire begins with one."
          action={<Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" />Add Client</Button>}
        />
      ) : (
        <>
          {/* Desktop table */}
          <Card className="p-0 overflow-hidden hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/60 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3 font-normal">Name</th>
                    <th className="text-left px-3 py-3 font-normal">Platform</th>
                    <th className="text-left px-3 py-3 font-normal">Status</th>
                    <th className="text-right px-3 py-3 font-normal">Revenue</th>
                    <th className="text-left px-3 py-3 font-normal">Rating</th>
                    <th className="text-left px-3 py-3 font-normal">Contact</th>
                    <th className="px-3 py-3" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {items.map(c => (
                    <tr key={c.id} className="border-t border-border/40 hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-primary">{c.name}</td>
                      <td className="px-3 py-3"><span className={cn("inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border", platformBadge(c.platform))}>{c.platform || "—"}</span></td>
                      <td className="px-3 py-3"><span className={cn("inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border", statusBadge(c.status))}>{c.status}</span></td>
                      <td className="px-3 py-3 text-right font-medium text-[var(--gold)]">{formatMoney(c.revenue)}</td>
                      <td className="px-3 py-3">
                        <div className="flex">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={cn("h-3.5 w-3.5", i < (c.rating ?? 0) ? "fill-[var(--gold)] text-[var(--gold)]" : "text-border")} />
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground text-xs truncate max-w-[180px]">{c.contact || "—"}</td>
                      <td className="px-3 py-3 relative text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMenu(m => m === c.id ? null : c.id)} aria-label="Row actions">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                        {menu === c.id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setMenu(null)} />
                            <div className="absolute right-3 mt-1 w-40 rounded-lg bg-[var(--card)] ring-1 ring-border shadow-[var(--shadow-lg)] py-1 z-50">
                              <button onClick={() => { openEdit(c); setMenu(null); }} className="w-full text-left px-3 py-2 text-sm hover:bg-secondary flex items-center gap-2"><Pencil className="h-3.5 w-3.5" />Edit</button>
                              <button onClick={() => del(c.id)} className="w-full text-left px-3 py-2 text-sm hover:bg-secondary text-[var(--destructive)] flex items-center gap-2"><Trash2 className="h-3.5 w-3.5" />Delete</button>
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t border-border bg-secondary/40">
                    <td className="px-4 py-3 font-semibold text-primary" colSpan={3}>Total Revenue</td>
                    <td className="px-3 py-3 text-right font-serif text-lg text-[var(--gold)]">{formatMoney(totalRevenue)}</td>
                    <td colSpan={3} />
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile cards */}
          <div className="md:hidden grid gap-3">
            {items.map(c => (
              <Card key={c.id}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-serif text-lg text-primary truncate">{c.name}</p>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      <span className={cn("inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border", platformBadge(c.platform))}>{c.platform || "—"}</span>
                      <span className={cn("inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border", statusBadge(c.status))}>{c.status}</span>
                    </div>
                  </div>
                  <p className="font-serif text-lg text-[var(--gold)] whitespace-nowrap">{formatMoney(c.revenue)}</p>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <div className="flex">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={cn("h-3.5 w-3.5", i < (c.rating ?? 0) ? "fill-[var(--gold)] text-[var(--gold)]" : "text-border")} />
                    ))}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => openEdit(c)} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => del(c.id)} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
                {c.contact && <p className="text-xs text-muted-foreground mt-2 truncate">{c.contact}</p>}
              </Card>
            ))}
          </div>
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[var(--card)] max-w-lg">
          <DialogHeader><DialogTitle className="font-serif text-2xl text-primary">{editing ? "Edit client" : "New client"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label htmlFor="c-name">Name</Label><Input id="c-name" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Platform</Label>
                <Select value={draft.platform} onValueChange={v => setDraft({ ...draft, platform: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PLATFORMS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
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
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="c-rev">Revenue (₹)</Label><Input id="c-rev" type="number" value={draft.revenue} onChange={e => setDraft({ ...draft, revenue: Number(e.target.value) })} /></div>
              <div>
                <Label>Rating</Label>
                <div className="flex items-center gap-1 h-10">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setDraft({ ...draft, rating: n })}
                      className="p-1"
                      aria-label={`${n} star${n === 1 ? "" : "s"}`}
                    >
                      <Star className={cn("h-5 w-5", n <= draft.rating ? "fill-[var(--gold)] text-[var(--gold)]" : "text-border")} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div><Label htmlFor="c-contact">Contact (email / phone)</Label><Input id="c-contact" value={draft.contact} onChange={e => setDraft({ ...draft, contact: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={save} className="min-h-[44px]">Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
