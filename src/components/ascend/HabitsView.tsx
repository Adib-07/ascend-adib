import { useMemo, useState } from "react";
import { useHabits, useHabitLogs, useLogHabit, type Habit } from "@/lib/ascend-hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2, Flame } from "lucide-react";
import { SectionHeader, EmptyState, Card } from "./ui-bits";
import { toast } from "sonner";

function weekDays() {
  const now = new Date();
  const dow = (now.getDay() + 6) % 7;
  const mon = new Date(now);
  mon.setDate(now.getDate() - dow);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    return d;
  });
}

const LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const fmt = (d: Date) => d.toISOString().slice(0, 10);
const today = fmt(new Date());

export default function HabitsView() {
  const { list, create, update, remove } = useHabits();
  const days = useMemo(() => weekDays(), []);
  const logs = useHabitLogs(fmt(days[0]), fmt(days[6]));
  const logHabit = useLogHabit();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Habit | null>(null);
  const [draft, setDraft] = useState<{
    name: string;
    category: string;
    metric_type: "boolean" | "count" | "duration" | "numeric";
  }>({
    name: "",
    category: "General",
    metric_type: "boolean",
  });

  const habits = list.data ?? [];
  const logMap = useMemo(() => {
    const m: Record<string, boolean> = {};
    (logs.data ?? []).forEach((l) => {
      m[`${l.habit_id}|${l.day}`] = l.done;
    });
    return m;
  }, [logs.data]);

  function openNew() {
    setEditing(null);
    setDraft({ name: "", category: "General", metric_type: "boolean" });
    setOpen(true);
  }
  function openEdit(h: Habit) {
    setEditing(h);
    setDraft({
      name: h.name,
      category: h.category ?? "General",
      metric_type: h.metric_type ?? "boolean",
    });
    setOpen(true);
  }

  async function save() {
    if (!draft.name.trim()) {
      toast.error("Name required");
      return;
    }
    try {
      if (editing) await update.mutateAsync({ id: editing.id, ...draft });
      else await create.mutateAsync(draft);
      setOpen(false);
      toast.success("Saved");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function toggleDay(h: Habit, day: string, current: boolean) {
    const next = !current;
    await logHabit.mutateAsync({ habit_id: h.id, day, value: next ? 1 : 0 });
  }

  const overall = habits.length
    ? Math.round(
        (habits.reduce((s, h) => s + days.filter((d) => logMap[`${h.id}|${fmt(d)}`]).length, 0) /
          (habits.length * 7)) *
          100,
      )
    : 0;

  return (
    <div className="space-y-6">
      <SectionHeader
        kicker="Habits"
        title="The Quiet Compound"
        subtitle="The work no one applauds, done daily."
        right={
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4 mr-1" />
            New habit
          </Button>
        }
      />

      {habits.length === 0 ? (
        <EmptyState title="No habits yet." hint="Start small. One habit, kept daily." />
      ) : (
        <>
          <Card>
            <div className="flex items-center justify-between mb-4">
              <p className="text-[11px] tracking-[0.2em] uppercase text-[var(--gold)]">This Week</p>
              <p className="text-sm text-muted-foreground">
                Overall <span className="font-serif text-lg text-primary">{overall}%</span>
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="text-left font-normal pb-2 pl-1">Habit</th>
                    {days.map((d, i) => (
                      <th key={i} className="font-normal pb-2 text-center w-12">
                        <div>{LABELS[i]}</div>
                        <div className="text-[9px] text-muted-foreground/70">{d.getDate()}</div>
                      </th>
                    ))}
                    <th className="text-right font-normal pb-2 pr-1">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {habits.map((h) => {
                    const score = days.filter((d) => logMap[`${h.id}|${fmt(d)}`]).length;
                    return (
                      <tr key={h.id} className="border-t border-border/50">
                        <td className="py-2 pl-1">
                          <div className="font-medium text-primary">{h.name}</div>
                          <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Flame className="h-3 w-3 text-[var(--gold)]" />
                            {h.streak} · {h.category}
                          </div>
                        </td>
                        {days.map((d, i) => {
                          const key = `${h.id}|${fmt(d)}`;
                          const checked = logMap[key] ?? false;
                          return (
                            <td key={i} className="text-center py-2">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={() => toggleDay(h, fmt(d), checked)}
                              />
                            </td>
                          );
                        })}
                        <td className="text-right pr-1 py-2 text-sm text-muted-foreground">
                          {score}/7
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {habits.map((h) => (
              <Card key={h.id} className="p-4 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-primary truncate">{h.name}</p>
                  <p className="text-xs text-muted-foreground">{h.category}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => openEdit(h)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => remove.mutate(h.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[var(--card)]">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl text-primary">
              {editing ? "Edit habit" : "New habit"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Category</Label>
              <Input
                value={draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                placeholder="Mind, Body, Craft..."
              />
            </div>
            <div>
              <Label>Metric Type</Label>
              <select
                value={draft.metric_type}
                onChange={(e) => setDraft({ ...draft, metric_type: e.target.value as "boolean" | "count" | "duration" | "numeric" })}
                className="w-full px-3 py-2 border border-border rounded-md bg-[var(--card)] text-foreground"
              >
                <option value="boolean">Boolean (done/not done)</option>
                <option value="count">Count (reps, pages, etc.)</option>
                <option value="duration">Duration (minutes/hours)</option>
                <option value="numeric">Numeric (any number)</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
