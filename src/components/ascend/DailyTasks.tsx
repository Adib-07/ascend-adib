import { useEffect, useMemo, useState } from "react";
import { todayISO, useIntention, useSaveIntention, useTasks, useTaskMutations, type Task } from "@/lib/ascend-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Pencil, Trash2, Timer, ListChecks, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { getFocusSessions } from "./FocusMode";
import { scheduleNotification } from "@/lib/notifications";

const PRIORITIES = ["High", "Medium", "Low"] as const;
const TYPES = ["Study", "Work", "Personal", "Habit"] as const;

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
function longDate() {
  return new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
function isPast(iso: string) { return iso < todayISO(); }
function isToday(iso: string) { return iso === todayISO(); }
function fmtShortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
function fmtTime(ts: string | null | undefined) {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function priorityPill(p: string) {
  if (p === "High") return "bg-red-50 text-red-700 border-red-200";
  if (p === "Medium") return "bg-[var(--gold)]/10 text-[var(--gold)] border-[var(--gold)]/30";
  return "bg-[var(--forest)]/10 text-[var(--forest)] border-[var(--forest)]/20";
}
function priorityBorder(p: string) {
  if (p === "High") return "border-l-red-400";
  if (p === "Medium") return "border-l-[var(--gold)]";
  return "border-l-[var(--forest)]";
}

type Filter = "All" | "Today" | "Overdue" | "High";

export default function DailyTasks() {
  const day = todayISO();
  const intentionQ = useIntention(day);
  const saveIntention = useSaveIntention();
  const [intentionDraft, setIntentionDraft] = useState<string | null>(null);
  const intentionValue = intentionDraft ?? intentionQ.data?.intention ?? "";

  const tasksQ = useTasks();
  const { create, update, remove } = useTaskMutations();

  const [filter, setFilter] = useState<Filter>("Today");
  const [editing, setEditing] = useState<Task | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [preset, setPreset] = useState<Partial<Task>>({});
  const [showCompleted, setShowCompleted] = useState(false);

  const [quickTitle, setQuickTitle] = useState("");
  const [quickPriority, setQuickPriority] = useState<"High" | "Medium" | "Low">("Medium");

  const [focusToday, setFocusToday] = useState(0);
  useEffect(() => {
    const recalc = () => setFocusToday(
      getFocusSessions().filter((s) => s.date === day && s.type === "Deep Work").length
    );
    recalc();
    const id = window.setInterval(recalc, 30_000);
    return () => window.clearInterval(id);
  }, [day]);

  const all = tasksQ.data ?? [];
  const active = useMemo(() => all.filter((t) => !t.done), [all]);
  const completed = useMemo(() => all.filter((t) => t.done && (!t.due_date || t.due_date === day)), [all, day]);

  const tasksToday = useMemo(
    () => all.filter((t) => !t.done && (!t.due_date || t.due_date === day)).length,
    [all, day],
  );

  const filtered = useMemo(() => {
    return active.filter((t) => {
      if (filter === "All") return true;
      if (filter === "Today") return !t.due_date || t.due_date === day;
      if (filter === "Overdue") return t.due_date && t.due_date < day;
      if (filter === "High") return t.priority === "High";
      return true;
    });
  }, [active, filter, day]);

  const mits = [1, 2, 3].map((slot) => all.find((t) => t.mit_slot === slot));

  function blurIntention() {
    if (intentionDraft === null) return;
    saveIntention.mutate({ day, intention: intentionDraft });
    setIntentionDraft(null);
  }

  function toggleDone(t: Task) {
    update.mutate({ id: t.id, done: !t.done });
  }

  function scheduleReminder(t: Partial<Task>) {
    if (t.reminder_time) {
      scheduleNotification(`⏰ ${t.title ?? "Task"}`, "Reminder from Ascend", new Date(t.reminder_time));
    }
  }

  async function createQuick() {
    if (!quickTitle.trim()) return;
    await create.mutateAsync({
      title: quickTitle.trim(),
      priority: quickPriority,
      type: "Study",
      due_date: day,
    });
    setQuickTitle("");
    toast.success("Task added");
  }

  function openAdd(pre: Partial<Task> = {}) {
    setEditing(null);
    setPreset(pre);
    setDialogOpen(true);
  }
  function openEdit(t: Task) {
    setEditing(t);
    setPreset({});
    setDialogOpen(true);
  }

  const FILTERS: Filter[] = ["All", "Today", "Overdue", "High"];

  return (
    <div className="space-y-8 page-enter">
      {/* Greeting */}
      <header>
        <h1 className="font-serif text-3xl md:text-4xl text-foreground">
          {greeting()}, Adib.
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{longDate()}</p>

        {/* Stat cards */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          <StatCard icon={<ListChecks className="h-4 w-4" />} label="Tasks today" value={tasksToday} />
          <StatCard icon={<CheckCircle2 className="h-4 w-4" />} label="Completed" value={completed.length} />
          <StatCard icon={<Timer className="h-4 w-4" />} label="Focus sessions" value={focusToday} />
        </div>
      </header>

      {/* Intention */}
      <section>
        <Label className="text-[11px] tracking-[0.2em] uppercase text-[var(--gold)] font-medium">Today's intention</Label>
        <Textarea
          rows={1}
          value={intentionValue}
          onChange={(e) => setIntentionDraft(e.target.value)}
          onBlur={blurIntention}
          placeholder="What matters most today?"
          className="mt-2 font-serif italic text-lg text-foreground bg-[var(--card)] border-border resize-none min-h-[52px]"
        />
      </section>

      {/* MITs */}
      <section>
        <h2 className="font-serif text-xl text-primary">Most Important</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Three things. That's all today needs.</p>

        <div className="mt-4 space-y-3">
          {mits.map((task, idx) => {
            const slot = idx + 1;
            const numeral = ["I", "II", "III"][idx];
            return (
              <div key={slot} className="card-hover bg-[var(--card)] border border-border rounded-2xl p-5 min-h-[110px] flex gap-4 shadow-[var(--shadow-sm)]">
                <div className="font-serif text-3xl text-[var(--gold)] font-bold w-8 flex-shrink-0 mt-1">{numeral}</div>
                <div className="flex-1 min-w-0">
                  {task ? (
                    <>
                      <p className={cn("font-serif text-lg text-foreground leading-snug break-words", task.done && "line-through opacity-50")}>
                        {task.title}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className={cn("text-[11px] px-2 py-0.5 rounded-full font-medium border", priorityPill(task.priority))}>
                          {task.priority}
                        </span>
                        {task.reminder_time && (
                          <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                            ⏰ {fmtTime(task.reminder_time)}
                          </span>
                        )}
                        <button
                          onClick={() => update.mutate({ id: task.id, mit_slot: null })}
                          className="text-[11px] text-muted-foreground hover:text-primary ml-auto"
                        >
                          Remove
                        </button>
                      </div>
                      <button
                        onClick={() => toggleDone(task)}
                        className={cn(
                          "mt-3 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors",
                          task.done
                            ? "bg-[var(--forest)]/10 text-[var(--forest)]"
                            : "bg-[var(--forest)] text-[var(--primary-foreground)] hover:opacity-90",
                        )}
                      >
                        {task.done ? "✓ Done" : "Mark done"}
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-col justify-center h-full">
                      <p className="font-serif text-muted-foreground italic">Set priority {numeral}</p>
                      <button
                        onClick={() => openAdd({ mit_slot: slot, due_date: day })}
                        className="mt-2 text-xs text-[var(--gold)] hover:text-primary font-medium self-start"
                      >
                        + Add task
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Quick capture */}
      <section>
        <div className="flex gap-2 bg-secondary/60 rounded-xl p-2">
          <input
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") createQuick(); }}
            placeholder="+ Add a task… (press Enter)"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/70 outline-none px-2"
          />
          <button
            onClick={() => setQuickPriority((p) => p === "High" ? "Medium" : p === "Medium" ? "Low" : "High")}
            className={cn("px-2 py-1 rounded-lg text-xs font-medium border", priorityPill(quickPriority))}
          >
            {quickPriority}
          </button>
          <Button size="sm" onClick={createQuick} className="text-xs px-3">Add</Button>
        </div>

        {/* Filters */}
        <div className="mt-4 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                filter === f
                  ? "bg-[var(--forest)] text-[var(--primary-foreground)] border-[var(--forest)]"
                  : "bg-[var(--card)] text-muted-foreground border-border hover:text-foreground",
              )}
            >
              {f}
            </button>
          ))}
          <Button variant="outline" size="sm" className="ml-auto text-xs" onClick={() => openAdd({ due_date: day })}>
            + New task
          </Button>
        </div>

        {/* List */}
        <div className="mt-4 space-y-2">
          {tasksQ.isLoading && <div className="skeleton h-12 rounded-xl" />}
          {!tasksQ.isLoading && filtered.length === 0 && (
            <div className="rounded-2xl border border-border bg-[var(--card)] p-10 text-center">
              <p className="font-serif text-lg text-primary">A quiet list.</p>
              <p className="text-sm text-muted-foreground mt-1">Add what matters most.</p>
            </div>
          )}
          {filtered.map((t) => (
            <div
              key={t.id}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl border border-l-4 bg-[var(--card)] transition-all group card-hover",
                priorityBorder(t.priority),
              )}
            >
              <input
                type="checkbox"
                checked={t.done}
                onChange={() => toggleDone(t)}
                className="w-5 h-5 rounded-full border-2 border-border accent-[var(--forest)] flex-shrink-0 cursor-pointer"
                aria-label={`Mark ${t.title} done`}
              />
              <span className={cn("flex-1 text-sm text-foreground font-medium min-w-0 truncate", t.done && "line-through text-muted-foreground")}>
                {t.title}
              </span>
              <span className="text-[10px] px-2 py-0.5 bg-secondary text-muted-foreground rounded-full hidden md:group-hover:inline-block">
                {t.type}
              </span>
              {t.mit_slot && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-[var(--gold)]/10 text-[var(--gold)] border border-[var(--gold)]/20">
                  MIT
                </span>
              )}
              {t.due_date && (
                <span className={cn(
                  "text-[11px] font-medium whitespace-nowrap",
                  isPast(t.due_date) && !t.done ? "text-red-600" : "text-muted-foreground",
                )}>
                  {isToday(t.due_date) ? "Today" : fmtShortDate(t.due_date)}
                </span>
              )}
              {t.reminder_time && !t.done && <span className="text-[11px] text-[var(--gold)]">⏰</span>}
              <div className="md:opacity-0 md:group-hover:opacity-100 transition-opacity flex gap-1">
                <button
                  onClick={() => openEdit(t)}
                  className="w-7 h-7 rounded-lg hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground"
                  aria-label="Edit task"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => remove.mutate(t.id)}
                  className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center text-muted-foreground hover:text-red-600"
                  aria-label="Delete task"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Completed collapse */}
        {completed.length > 0 && (
          <div className="mt-4">
            <button
              onClick={() => setShowCompleted((s) => !s)}
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-2"
            >
              <span>{showCompleted ? "▼" : "▶"}</span>
              {completed.length} completed today
            </button>
            {showCompleted && (
              <div className="mt-2 space-y-2">
                {completed.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 px-4 py-2 rounded-xl border border-border/60 opacity-60 bg-[var(--card)]">
                    <input
                      type="checkbox"
                      checked
                      onChange={() => toggleDone(t)}
                      className="w-5 h-5 rounded-full accent-[var(--forest)]"
                      aria-label={`Reopen ${t.title}`}
                    />
                    <span className="flex-1 text-sm line-through text-muted-foreground truncate">{t.title}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing ?? preset}
        onSubmit={async (input) => {
          if (editing) {
            await update.mutateAsync({ id: editing.id, ...input });
            toast.success("Saved");
          } else {
            await create.mutateAsync(input);
            toast.success("Task added");
          }
          scheduleReminder({ ...(editing ?? {}), ...input });
          setDialogOpen(false);
          setEditing(null);
        }}
      />
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="bg-secondary rounded-xl p-4 flex items-center gap-3 card-hover">
      <div className="h-9 w-9 rounded-lg bg-[var(--card)] flex items-center justify-center text-[var(--gold)]">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="font-serif text-2xl text-foreground leading-none">{value}</p>
        <p className="text-[11px] tracking-widest uppercase text-muted-foreground mt-1 truncate">{label}</p>
      </div>
    </div>
  );
}

function TaskDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: Partial<Task>;
  onSubmit: (input: Partial<Task>) => Promise<void> | void;
}) {
  const [form, setForm] = useState<Partial<Task>>({});
  useEffect(() => {
    if (open) {
      setForm({
        title: initial?.title ?? "",
        priority: initial?.priority ?? "Medium",
        type: initial?.type ?? "Study",
        due_date: initial?.due_date ?? null,
        mit_slot: initial?.mit_slot ?? null,
        reminder_time: initial?.reminder_time ?? null,
      });

    }
  }, [open, initial]);

  const isMit = form.mit_slot != null;

  function save() {
    if (!form.title?.trim()) { toast.error("Title required"); return; }
    onSubmit(form);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif">{initial && "id" in (initial as Task) ? "Edit task" : "New task"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Title</Label>
            <Input
              value={form.title ?? ""}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="mt-1"
              autoFocus
            />
          </div>

          <div>
            <Label className="text-xs">Priority</Label>
            <div className="mt-1 flex gap-2">
              {PRIORITIES.map((p) => (
                <button
                  key={p}
                  onClick={() => setForm({ ...form, priority: p })}
                  className={cn(
                    "flex-1 text-xs px-3 py-2 rounded-lg border font-medium transition-colors",
                    form.priority === p ? priorityPill(p) : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs">Type</Label>
            <div className="mt-1 grid grid-cols-4 gap-2">
              {TYPES.map((tp) => (
                <button
                  key={tp}
                  onClick={() => setForm({ ...form, type: tp })}
                  className={cn(
                    "text-xs px-2 py-2 rounded-lg border font-medium transition-colors",
                    form.type === tp
                      ? "bg-[var(--forest)] text-[var(--primary-foreground)] border-[var(--forest)]"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tp}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Due date</Label>
              <Input
                type="date"
                value={form.due_date ?? ""}
                onChange={(e) => setForm({ ...form, due_date: e.target.value || null })}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Notify me at</Label>
              <Input
                type="datetime-local"
                value={form.reminder_time ? new Date(form.reminder_time).toISOString().slice(0, 16) : ""}
                onChange={(e) => setForm({ ...form, reminder_time: e.target.value ? new Date(e.target.value).toISOString() : null })}
                className="mt-1"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={isMit}
              onChange={(e) => setForm({ ...form, mit_slot: e.target.checked ? (form.mit_slot ?? 1) : null })}
              className="accent-[var(--forest)]"
            />
            Add to top 3 priorities (MIT)
          </label>
          {isMit && (
            <div className="flex gap-2">
              {[1, 2, 3].map((slot) => (
                <button
                  key={slot}
                  onClick={() => setForm({ ...form, mit_slot: slot })}
                  className={cn(
                    "flex-1 text-xs px-3 py-2 rounded-lg border font-medium",
                    form.mit_slot === slot ? "bg-[var(--gold)]/10 text-[var(--gold)] border-[var(--gold)]/30" : "border-border text-muted-foreground",
                  )}
                >
                  Slot {["I", "II", "III"][slot - 1]}
                </button>
              ))}
            </div>
          )}

          <div>
            <Label className="text-xs">Notes (optional)</Label>
            <Textarea
              value={form.notes ?? ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="mt-1"
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
