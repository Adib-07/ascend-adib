import { useMemo } from "react";
import { useLearnTopics } from "@/lib/ascend-data";
import { useHabits, useHabitLogs } from "@/lib/ascend-hooks";
import { SectionHeader, Card, EmptyState } from "./ui-bits";
import { Progress } from "@/components/ui/progress";

function weekBounds() {
  const now = new Date();
  const dow = (now.getDay() + 6) % 7; // Mon=0
  const mon = new Date(now);
  mon.setDate(now.getDate() - dow);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(mon), end: fmt(sun) };
}

export default function ProgressTab() {
  const topicsQ = useLearnTopics();
  const habits = useHabits();
  const w = weekBounds();
  const logs = useHabitLogs(w.start, w.end);

  const topics = topicsQ.data ?? [];
  const bySkill = useMemo(() => {
    const map: Record<string, { total: number; sum: number; done: number }> = {};
    for (const t of topics) {
      const k = t.skill || "General";
      if (!map[k]) map[k] = { total: 0, sum: 0, done: 0 };
      map[k].total += 1;
      map[k].sum += t.progress;
      if (t.status === "Done" || t.progress >= 100) map[k].done += 1;
    }
    return map;
  }, [topics]);

  const totalDone = topics.filter((t) => t.status === "Done" || t.progress >= 100).length;

  // Habit streak (highest streak across habits)
  const streak = (habits.list.data ?? []).reduce((m, h) => Math.max(m, h.streak), 0);
  // Weekly study "hours" proxy = number of habit completions this week (simple, since no time-tracker yet)
  const weekDone = (logs.data ?? []).filter((l) => l.done).length;

  if (topics.length === 0 && (habits.list.data ?? []).length === 0) {
    return (
      <EmptyState
        title="Nothing to chart yet."
        hint="Add topics in Learn and habits in the Habits tab — analytics will appear here."
      />
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        kicker="Progress"
        title="The Ledger of Mastery"
        subtitle="Quiet metrics. Steady gains."
      />

      <div className="grid sm:grid-cols-3 gap-4">
        <Card>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Topics Completed</p>
          <p className="font-serif text-4xl text-primary mt-1">{totalDone}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Current Streak</p>
          <p className="font-serif text-4xl text-[var(--gold)] mt-1">
            {streak}
            <span className="text-base ml-1 text-muted-foreground">days</span>
          </p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            This Week (sessions)
          </p>
          <p className="font-serif text-4xl text-primary mt-1">{weekDone}</p>
        </Card>
      </div>

      <Card>
        <p className="text-[11px] tracking-[0.2em] uppercase text-[var(--gold)] mb-4">
          Skill Categories
        </p>
        {Object.keys(bySkill).length === 0 ? (
          <p className="text-sm text-muted-foreground">Add learn topics to see breakdown.</p>
        ) : (
          <div className="space-y-4">
            {Object.entries(bySkill).map(([skill, s]) => {
              const avg = Math.round(s.sum / s.total);
              return (
                <div key={skill}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-primary">{skill}</span>
                    <span className="text-muted-foreground">
                      {s.done}/{s.total} · {avg}%
                    </span>
                  </div>
                  <Progress value={avg} />
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
