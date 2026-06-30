import { useMemo, useState } from "react";
import { useFinanceEntries, type FinanceEntry } from "@/lib/ascend-hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Pencil, ArrowUpDown } from "lucide-react";
import { SectionHeader, EmptyState, Card, Pill } from "./ui-bits";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const TYPES = ["Income", "Expense"] as const;
const today = () => new Date().toISOString().slice(0, 10);

export default function IncomeView() {
  const { list, create, update, remove } = useFinanceEntries();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FinanceEntry | null>(null);
  const [draft, setDraft] = useState({ description: "", amount: 0, type: "Income", category: "", entry_date: today(), account: "" });
  const [filter, setFilter] = useState<"All" | "Income" | "Expense">("All");
  const [sort, setSort] = useState<{ key: keyof FinanceEntry; dir: 1 | -1 }>({ key: "entry_date", dir: -1 });

  const all = list.data ?? [];
  const month = new Date().toISOString().slice(0, 7);
  const monthEntries = all.filter(e => e.entry_date.startsWith(month));
  const totalIncome = monthEntries.filter(e => e.type === "Income").reduce((s, e) => s + Number(e.amount), 0);
  const totalExpense = monthEntries.filter(e => e.type === "Expense").reduce((s, e) => s + Number(e.amount), 0);
  const net = totalIncome - totalExpense;

  const filtered = useMemo(() => {
    const f = filter === "All" ? all : all.filter(e => e.type === filter);
    return [...f].sort((a, b) => {
      const va = a[sort.key]; const vb = b[sort.key];
      if (va == null) return 1; if (vb == null) return -1;
      return va > vb ? sort.dir : va < vb ? -sort.dir as 1 | -1 : 0;
    });
  }, [all, filter, sort]);

  function openNew() { setEditing(null); setDraft({ description: "", amount: 0, type: "Income", category: "", entry_date: today(), account: "" }); setOpen(true); }
  function openEdit(e: FinanceEntry) { setEditing(e); setDraft({ description: e.description, amount: Number(e.amount), type: e.type, category: e.category ?? "", entry_date: e.entry_date, account: e.account ?? "" }); setOpen(true); }
  async function save() {
    if (!draft.description.trim() || !draft.amount) { toast.error("Description and amount required"); return; }
    try {
      if (editing) await update.mutateAsync({ id: editing.id, ...draft });
      else await create.mutateAsync(draft);
      setOpen(false); toast.success("Saved");
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  function SortHead({ k, label }: { k: keyof FinanceEntry; label: string }) {
    return <th className="text-left font-normal pb-2 px-2 cursor-pointer" onClick={() => setSort(s => ({ key: k, dir: s.key === k ? (s.dir === 1 ? -1 : 1) : 1 }))}><span className="inline-flex items-center gap-1">{label}<ArrowUpDown className="h-3 w-3 opacity-50" /></span></th>;
  }

  return (
    <div className="space-y-6">
      <SectionHeader kicker="Income Tracker" title="The Ledger"
        subtitle="Currency flows. Note them quietly."
        right={<Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" />Add entry</Button>} />

      <div className="grid sm:grid-cols-3 gap-4">
        <Card><p className="text-xs uppercase tracking-wider text-muted-foreground">Income · {month}</p><p className="font-serif text-3xl text-[var(--forest)] mt-1">₹{totalIncome.toLocaleString()}</p></Card>
        <Card><p className="text-xs uppercase tracking-wider text-muted-foreground">Expenses</p><p className="font-serif text-3xl text-[var(--destructive)] mt-1">₹{totalExpense.toLocaleString()}</p></Card>
        <Card><p className="text-xs uppercase tracking-wider text-muted-foreground">Net</p><p className={cn("font-serif text-3xl mt-1", net >= 0 ? "text-[var(--gold)]" : "text-[var(--destructive)]")}>₹{net.toLocaleString()}</p></Card>
      </div>

      <div className="flex gap-2">
        {(["All", "Income", "Expense"] as const).map(f => <Pill key={f} active={filter === f} onClick={() => setFilter(f)}>{f}</Pill>)}
      </div>

      {filtered.length === 0 ? <EmptyState title="No entries yet." hint="Log income or an expense to begin." /> : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <SortHead k="entry_date" label="Date" />
                  <SortHead k="description" label="Description" />
                  <th className="text-left font-normal pb-2 px-2">Type</th>
                  <th className="text-left font-normal pb-2 px-2">Category</th>
                  <th className="text-left font-normal pb-2 px-2">Account</th>
                  <SortHead k="amount" label="Amount" />
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(e => (
                  <tr key={e.id} className="border-t border-border/40">
                    <td className="px-2 py-2 whitespace-nowrap">{new Date(e.entry_date).toLocaleDateString()}</td>
                    <td className="px-2 py-2 max-w-[200px] truncate">{e.description}</td>
                    <td className="px-2 py-2"><span className={cn("text-[10px] px-2 py-0.5 rounded-full border", e.type === "Income" ? "text-[var(--forest)] border-[var(--forest)]/30 bg-[var(--forest)]/5" : "text-[var(--destructive)] border-[var(--destructive)]/30 bg-[var(--destructive)]/5")}>{e.type}</span></td>
                    <td className="px-2 py-2 text-muted-foreground">{e.category || "—"}</td>
                    <td className="px-2 py-2 text-muted-foreground">{e.account || "—"}</td>
                    <td className={cn("px-2 py-2 font-medium whitespace-nowrap", e.type === "Income" ? "text-[var(--forest)]" : "text-[var(--destructive)]")}>{e.type === "Income" ? "+" : "−"}₹{Number(e.amount).toLocaleString()}</td>
                    <td className="px-2 py-2 text-right whitespace-nowrap">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(e)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove.mutate(e.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[var(--card)]">
          <DialogHeader><DialogTitle className="font-serif text-2xl text-primary">{editing ? "Edit entry" : "New entry"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Description</Label><Input value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Amount (₹)</Label><Input type="number" value={draft.amount} onChange={e => setDraft({ ...draft, amount: Number(e.target.value) })} /></div>
              <div><Label>Type</Label>
                <Select value={draft.type} onValueChange={v => setDraft({ ...draft, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Category</Label><Input value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })} placeholder="Freelance, Food..." /></div>
              <div><Label>Account</Label><Input value={draft.account} onChange={e => setDraft({ ...draft, account: e.target.value })} placeholder="Bank, UPI, Cash" /></div>
            </div>
            <div><Label>Date</Label><Input type="date" value={draft.entry_date} onChange={e => setDraft({ ...draft, entry_date: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
