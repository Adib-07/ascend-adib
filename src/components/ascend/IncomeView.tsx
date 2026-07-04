import { useMemo, useState } from "react";
import { useFinanceEntries, type FinanceEntry } from "@/lib/ascend-hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Pencil, ArrowUp, ArrowDown } from "lucide-react";
import { SectionHeader, EmptyState, Card, formatMoney } from "./ui-bits";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const TYPES = ["Income", "Expense", "Saving"] as const;
const CATEGORIES = ["Food", "Transport", "Tools", "SaaS", "Client Payment", "College", "Health", "Entertainment", "Salary", "Freelance", "Misc"] as const;
const ACCOUNTS = ["Cash", "UPI", "Bank", "Card"] as const;
const SCOPES = ["Business", "Personal"] as const;
const today = () => new Date().toISOString().slice(0, 10);

type SortCol = "entry_date" | "amount" | "description";
type FilterKey = "all" | "Income" | "Expense" | "month";

function typeChip(t: string) {
  if (t === "Income") return "bg-[var(--forest)]/15 text-[var(--forest)]";
  if (t === "Expense") return "bg-[var(--destructive)]/10 text-[var(--destructive)]";
  return "bg-[var(--gold)]/15 text-[var(--gold)]";
}

export default function IncomeView() {
  const { list, create, update, remove } = useFinanceEntries();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FinanceEntry | null>(null);
  const [draft, setDraft] = useState({
    description: "",
    amount: 0,
    type: "Income" as string,
    category: "Misc" as string,
    entry_date: today(),
    account: "UPI" as string,
    scope: "Business" as string,
  });
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sort, setSort] = useState<{ col: SortCol; dir: "asc" | "desc" }>({ col: "entry_date", dir: "desc" });

  const entries = list.data ?? [];
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const monthEntries = entries.filter((e) => e.entry_date >= monthStart);
  const totalIncome = monthEntries.filter((e) => e.type === "Income").reduce((s, e) => s + Number(e.amount), 0);
  const totalExpenses = monthEntries.filter((e) => e.type === "Expense").reduce((s, e) => s + Number(e.amount), 0);
  const net = totalIncome - totalExpenses;

  const months = useMemo(() => {
    const arr = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      const label = d.toLocaleDateString("en-IN", { month: "short" });
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const inc = entries.filter((e) => e.entry_date.startsWith(key) && e.type === "Income").reduce((s, e) => s + Number(e.amount), 0);
      const exp = entries.filter((e) => e.entry_date.startsWith(key) && e.type === "Expense").reduce((s, e) => s + Number(e.amount), 0);
      return { label, inc, exp };
    });
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries]);
  const maxVal = Math.max(...months.flatMap((m) => [m.inc, m.exp]), 1);

  const filtered = useMemo(() => {
    let f = entries;
    if (filter === "Income" || filter === "Expense") f = f.filter((e) => e.type === filter);
    else if (filter === "month") f = f.filter((e) => e.entry_date >= monthStart);
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...f].sort((a, b) => {
      const va = a[sort.col]; const vb = b[sort.col];
      if (va == null) return 1; if (vb == null) return -1;
      if (sort.col === "amount") return (Number(va) - Number(vb)) * dir;
      return va > vb ? dir : va < vb ? -dir : 0;
    });
  }, [entries, filter, sort, monthStart]);

  function openNew() {
    setEditing(null);
    setDraft({ description: "", amount: 0, type: "Income", category: "Misc", entry_date: today(), account: "UPI", scope: "Business" });
    setOpen(true);
  }
  function openEdit(e: FinanceEntry) {
    setEditing(e);
    setDraft({
      description: e.description,
      amount: Number(e.amount),
      type: e.type,
      category: e.category ?? "Misc",
      entry_date: e.entry_date,
      account: e.account ?? "UPI",
      scope: "Business",
    });
    setOpen(true);
  }
  async function save() {
    if (!draft.description.trim() || !draft.amount) { toast.error("Description and amount required"); return; }
    const { scope: _scope, ...payload } = draft;
    try {
      if (editing) await update.mutateAsync({ id: editing.id, ...payload });
      else await create.mutateAsync(payload);
      setOpen(false);
      toast.success(editing ? "Entry updated" : "Entry added");
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }
  async function del(id: string) {
    try { await remove.mutateAsync(id); toast.success("Entry deleted"); }
    catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  function toggleSort(col: SortCol) {
    setSort((s) => (s.col === col ? { col, dir: s.dir === "asc" ? "desc" : "asc" } : { col, dir: "desc" }));
  }
  function SortIcon({ col }: { col: SortCol }) {
    if (sort.col !== col) return <ArrowUp className="h-3 w-3 opacity-30" />;
    return sort.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  }

  const monthLabel = now.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <div className="space-y-6">
      <SectionHeader
        kicker="Income Tracker"
        title="The Ledger"
        subtitle="Currency flows. Note them quietly."
        right={<Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" />Add Entry</Button>}
      />

      {/* Summary cards */}
      <div className="grid sm:grid-cols-3 gap-4">
        <Card>
          <p className="text-[11px] tracking-[0.2em] uppercase text-muted-foreground">💵 Income · {monthLabel}</p>
          <p className="font-serif text-3xl text-[var(--forest)] mt-1">{formatMoney(totalIncome)}</p>
        </Card>
        <Card>
          <p className="text-[11px] tracking-[0.2em] uppercase text-muted-foreground">💸 Expenses · {monthLabel}</p>
          <p className="font-serif text-3xl text-[var(--destructive)] mt-1">{formatMoney(totalExpenses)}</p>
        </Card>
        <Card>
          <p className="text-[11px] tracking-[0.2em] uppercase text-muted-foreground">📊 Net Balance</p>
          <p className={cn("font-serif text-3xl mt-1", net >= 0 ? "text-[var(--forest)]" : "text-[var(--destructive)]")}>{formatMoney(net)}</p>
        </Card>
      </div>

      {/* 6-month bar chart */}
      <Card className="p-4">
        <p className="text-[11px] tracking-[0.2em] uppercase text-[var(--gold)] mb-3">Last 6 Months</p>
        <div className="bg-secondary/30 rounded-xl p-4">
          <div className="flex items-end gap-1 h-28">
            {months.map((m) => (
              <div key={m.label} className="flex-1 flex flex-col items-center gap-0.5">
                <div className="w-full flex items-end gap-0.5 h-20">
                  <div
                    className="flex-1 bg-[var(--forest)] rounded-t-sm transition-all duration-500 min-h-[2px]"
                    style={{ height: `${(m.inc / maxVal) * 100}%` }}
                    title={`Income ${formatMoney(m.inc)}`}
                  />
                  <div
                    className="flex-1 bg-[var(--destructive)]/60 rounded-t-sm transition-all duration-500 min-h-[2px]"
                    style={{ height: `${(m.exp / maxVal) * 100}%` }}
                    title={`Expense ${formatMoney(m.exp)}`}
                  />
                </div>
                <p className="text-[9px] text-muted-foreground uppercase tracking-wide">{m.label}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-4 mt-2 justify-center">
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="w-2.5 h-2.5 rounded-sm bg-[var(--forest)] inline-block" />Income
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="w-2.5 h-2.5 rounded-sm bg-[var(--destructive)]/60 inline-block" />Expenses
            </span>
          </div>
        </div>
      </Card>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {([
          { k: "all", label: "All" },
          { k: "Income", label: "Income" },
          { k: "Expense", label: "Expenses" },
          { k: "month", label: "This Month" },
        ] as { k: FilterKey; label: string }[]).map((t) => (
          <button
            key={t.k}
            onClick={() => setFilter(t.k)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition-all active:scale-95",
              filter === t.k ? "bg-[var(--forest)] text-white" : "bg-secondary text-muted-foreground hover:text-primary"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No transactions yet"
          hint="Log your first income or expense."
          action={<Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" />Add Entry</Button>}
        />
      ) : (
        <>
          {/* Desktop table */}
          <Card className="p-0 overflow-hidden hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2 font-normal cursor-pointer" onClick={() => toggleSort("entry_date")}>
                      <span className="inline-flex items-center gap-1">Date <SortIcon col="entry_date" /></span>
                    </th>
                    <th className="text-left px-3 py-2 font-normal">Description</th>
                    <th className="text-left px-3 py-2 font-normal">Category</th>
                    <th className="text-left px-3 py-2 font-normal">Type</th>
                    <th className="text-right px-3 py-2 font-normal cursor-pointer" onClick={() => toggleSort("amount")}>
                      <span className="inline-flex items-center gap-1">Amount <SortIcon col="amount" /></span>
                    </th>
                    <th className="w-16" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e) => (
                    <tr key={e.id} className="group border-t border-border/40 hover:bg-secondary/30 transition-colors">
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                        {new Date(e.entry_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-3 py-2 max-w-[240px] truncate">{e.description}</td>
                      <td className="px-3 py-2">
                        <span className="text-[10px] bg-secondary px-2 py-0.5 rounded-full text-muted-foreground">{e.category || "—"}</span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", typeChip(e.type))}>{e.type}</span>
                      </td>
                      <td className={cn("px-3 py-2 text-right font-medium whitespace-nowrap",
                        e.type === "Income" ? "text-[var(--forest)]" : e.type === "Expense" ? "text-[var(--destructive)]" : "text-[var(--gold)]")}>
                        {e.type === "Expense" ? "−" : e.type === "Income" ? "+" : ""}{formatMoney(e.amount)}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(e)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => del(e.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {filtered.map((e) => (
              <Card key={e.id} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-primary truncate">{e.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", typeChip(e.type))}>{e.type}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(e.entry_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn("text-sm font-semibold whitespace-nowrap",
                      e.type === "Income" ? "text-[var(--forest)]" : e.type === "Expense" ? "text-[var(--destructive)]" : "text-[var(--gold)]")}>
                      {e.type === "Expense" ? "−" : e.type === "Income" ? "+" : ""}{formatMoney(e.amount)}
                    </p>
                    <div className="flex justify-end mt-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(e)}><Pencil className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => del(e.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[var(--card)]">
          <DialogHeader><DialogTitle className="font-serif text-2xl text-primary">{editing ? "Edit entry" : "New entry"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Description</Label>
              <Input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Amount (₹)</Label>
                <Input type="number" min={0} value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Type</Label>
                <Select value={draft.type} onValueChange={(v) => setDraft({ ...draft, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Category</Label>
                <Select value={draft.category} onValueChange={(v) => setDraft({ ...draft, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Account</Label>
                <Select value={draft.account} onValueChange={(v) => setDraft({ ...draft, account: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ACCOUNTS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={draft.entry_date} onChange={(e) => setDraft({ ...draft, entry_date: e.target.value })} />
            </div>
            <div>
              <Label>Scope</Label>
              <div className="flex gap-2 mt-1.5">
                {SCOPES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setDraft({ ...draft, scope: s })}
                    className={cn(
                      "flex-1 rounded-lg px-3 py-2 text-xs font-medium border transition-all active:scale-95",
                      draft.scope === s
                        ? "bg-[var(--forest)] text-white border-[var(--forest)]"
                        : "bg-transparent border-border text-muted-foreground hover:text-primary"
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
