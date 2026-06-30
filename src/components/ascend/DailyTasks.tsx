import { useState } from "react";
import { todayISO, useIntention, useSaveIntention, useTasks, useTaskMutations, type Task } from "@/lib/ascend-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";

const PRIORITIES = ["High", "Medium", "Low"] as const;
const TYPES = ["Study", "Personal", "Habit"] as const;

function priorityClass(p: string) {
  if (p === "High") return "bg-[var(--destructive)]/15 text-[var(--destructive)] border-[var(--destructive)]/30";
  if (p === "Medium") return "bg-[var(--gold)]/15 text-[var(--gold)] border-[var(--gold)]/30";
  return "bg-[var(--forest)]/10 text-[var(--forest)] border-[var(--forest)]/20";
}

export default function DailyTasks() {
  const day = todayISO();
  const intentionQ = useIntention(day);
  const saveIntention = useSaveIntention();
  const [intentionDraft, setIntentionDraft] = useState<string | null>(null);
  const intentionValue = intentionDraft ?? intentionQ.data?.intention ?? "";

  const tasksQ = useTasks();
  const { create, update, remove } = useTaskMutations();
  const [filter, setFilter] = useState<"Today" | "All" | "Overdue">("Today");
  const [editing, setEditing] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);

  const all = tasksQ.data ?? [];
  const filtered = all.filter((t) => {
    if (filter === "All") return true;
    if (filter === "Today") return !t.due_date || t.due_date === day;
    if (filter === "Overdue") return t.due_date && t.due_date < day && !t.done;
    return true;
  });

  const mits = [1, 2, 3].map((slot) => all.find((t) => t.mit_slot === slot));

  function blurIntention() {
    if (intentionDraft === null) return;
    saveIntention.mutate({ day, intention: intentionDraft });
    setIntentionDraft(null);
  }

  async function setMit(slot: number, taskId: string | null) {
    // Clear other tasks holding this slot
    const occupying = all.find((t) => t.mit_slot === slot);
    if (occupying && occupying.id !== taskId) {
      await update.mutateAsync({ id: occupying.id, mit_slot: null });
    }
    if (taskId) await update.mutateAsync({ id: taskId, mit_slot: slot });
  }

  const dateLabel = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <p className="text-[11px] tracking-[0.2em] uppercase text-[var(--gold)]">{dateLabel}</p>
        <h1 className="font-serif text-3xl md:text-4xl text-primary mt-2">Today</h1>
        <div className="mt-4 card-elegant p-4">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Today's intention</Label>
          <Input
            value={intentionValue}
            onChange={(e) => setIntentionDraft(e.target.value)}
            onBlur={blurIntention}
            placeholder="What does today need from you?"
            className="mt-2 border-0 bg-transparent text-base md:text-lg font-serif text-primary px-0 focus-visible:ring-0 shadow-none"
          />
        </div>
      </div>

      {/* MITs */}
      <section>
        <h2 className="font-serif text-xl text-primary">Top 3 Most Important</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {mits.map((task, idx) => {
            const slot = idx + 1;
            return (
              <div key={slot} className="card-elegant p-4 min-h-[110px] flex flex-col">
                <p className="text-[11px] uppercase tracking-widest text-[var(--gold)]">No. {slot}</p>
                {task ? (
                  <div className="mt-2 flex items-start gap-2 flex-1">
                    <Checkbox checked={task.done} onCheckedChange={(v) => update.mutate({ id: task.id, done: !!v })} className="mt-1" />
                    <div className="flex-1">
                      <p className={cn("text-sm font-medium", task.done && "line-through text-muted-foreground")}>{task.title}</p>
                      <button onClick={() => setMit(slot, null)} className="text-xs text-muted-foreground hover:text-primary mt-2">Remove</button>
                    </div>
                  </div>
                ) : (
                  <MitPicker tasks={all.filter((t) => !t.mit_slot && !t.done)} onPick={(id) => setMit(slot, id)} />
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Tasks list */}
      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-serif text-xl text-primary">All Tasks</h2>
            <p className="text-sm text-muted-foreground">Keep the list small. Move with intent.</p>
          </div>
          <Dialog open={creating} onOpenChange={setCreating}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1" />New task</Button>
            </DialogTrigger>
            <TaskDialog
              onSubmit={async (input) => {
                await create.mutateAsync(input);
                setCreating(false);
                toast.success("Task added");
              }}
              title="New task"
            />
          </Dialog>
        </div>

        <div className="mt-4 inline-flex rounded-md border border-border bg-secondary p-1">
          {(["Today", "All", "Overdue"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1.5 text-xs rounded-md transition-colors",
                filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-primary"
              )}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-2">
          {tasksQ.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {filtered.length === 0 && !tasksQ.isLoading && (
            <div className="card-elegant p-10 text-center">
              <p className="font-serif text-lg text-primary">A quiet list.</p>
              <p className="text-sm text-muted-foreground mt-1">Add what matters most.</p>
            </div>
          )}
          {filtered.map((t) => (
            <div key={t.id} className="card-elegant p-3 md:p-4 flex items-center gap-3">
              <Checkbox checked={t.done} onCheckedChange={(v) => update.mutate({ id: t.id, done: !!v })} />
              <div className="flex-1 min-w-0">
                <p className={cn("font-medium truncate", t.done && "line-through text-muted-foreground")}>{t.title}</p>
                <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <span className={cn("px-2 py-0.5 rounded-full border", priorityClass(t.priority))}>{t.priority}</span>
                  <span>{t.type}</span>
                  {t.due_date && <span>· due {t.due_date}</span>}
                  {t.mit_slot && <span className="text-[var(--gold)]">· MIT #{t.mit_slot}</span>}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setEditing(t)}><Pencil className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => remove.mutate(t.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>

        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          {editing && (
            <TaskDialog
              title="Edit task"
              initial={editing}
              onSubmit={async (input) => {
                await update.mutateAsync({ id: editing.id, ...input });
                setEditing(null);
                toast.success("Saved");
              }}
            />
          )}
        </Dialog>
      </section>
    </div>
  );
}

function MitPicker({ tasks, onPick }: { tasks: Task[]; onPick: (id: string) => void }) {
  return (
    <div className="mt-2 flex-1">
      <Select onValueChange={onPick}>
        <SelectTrigger className="text-sm"><SelectValue placeholder="Choose a task…" /></SelectTrigger>
        <SelectContent>
          {tasks.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">Add tasks first</div>}
          {tasks.map((t) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function TaskDialog({ title, initial, onSubmit }: { title: string; initial?: Task; onSubmit: (input: Partial<Task>) => Promise<void> | void }) {
  const [form, setForm] = useState<Partial<Task>>({
    title: initial?.title ?? "",
    priority: initial?.priority ?? "Medium",
    type: initial?.type ?? "Study",
    due_date: initial?.due_date ?? null,
  });
  return (
    <DialogContent>
      <DialogHeader><DialogTitle className="font-serif">{title}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Title</Label>
          <Input value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1" autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Priority</Label>
            <Select value={form.priority ?? "Medium"} onValueChange={(v) => setForm({ ...form, priority: v })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Type</Label>
            <Select value={form.type ?? "Study"} onValueChange={(v) => setForm({ ...form, type: v })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>{TYPES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label>Due date</Label>
          <Input type="date" value={form.due_date ?? ""} onChange={(e) => setForm({ ...form, due_date: e.target.value || null })} className="mt-1" />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={() => form.title?.trim() && onSubmit(form)}>Save</Button>
      </DialogFooter>
    </DialogContent>
  );
}
