import { useState } from "react";
import { useLearnTopics, useLearnMutations, type LearnTopic } from "@/lib/ascend-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const SKILLS = ["Python", "AI", "ML", "DBMS", "DSA", "OS", "Data Analytics"] as const;
const STATUSES = ["Not Started", "In Progress", "Completed"] as const;
const DIFFICULTIES = ["Easy", "Medium", "Hard"] as const;

export default function LearnTab() {
  const q = useLearnTopics();
  const { create, update, remove } = useLearnMutations();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<LearnTopic | null>(null);
  const [skill, setSkill] = useState<string>("All");

  const STATUS_ORDER: Record<string, number> = { "In Progress": 0, "Not Started": 1, "Completed": 2 };
  const topics = (q.data ?? [])
    .filter((t) => skill === "All" || t.skill === skill)
    .slice()
    .sort((a, b) => (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1">
          {["All", ...SKILLS].map((s) => (
            <button
              key={s}
              onClick={() => setSkill(s)}
              className={cn(
                "px-3 py-1.5 text-xs rounded-full border transition-colors",
                skill === s ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-primary"
              )}
            >
              {s}
            </button>
          ))}
        </div>
        <Dialog open={creating} onOpenChange={setCreating}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />New topic</Button></DialogTrigger>
          <TopicDialog title="New topic" onSubmit={async (input) => { await create.mutateAsync(input); setCreating(false); toast.success("Topic added"); }} />
        </Dialog>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {topics.length === 0 && !q.isLoading && (
          <div className="card-elegant p-8 text-center md:col-span-2">
            <p className="font-serif text-lg text-primary">Build your curriculum.</p>
            <p className="text-sm text-muted-foreground mt-1">Add the topics that will take you where you're going.</p>
          </div>
        )}
        {topics.map((t) => (
          <div key={t.id} className="card-elegant p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-widest text-[var(--gold)]">{t.skill}</p>
                <p className="font-serif text-lg text-primary mt-0.5 truncate">{t.topic}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="icon" variant="ghost" onClick={() => setEditing(t)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => remove.mutate(t.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="mt-3">
              <div className="flex justify-between text-xs text-muted-foreground"><span>{t.status}</span><span>{t.progress}%</span></div>
              <div className="mt-1.5 h-1.5 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-[var(--gold)] transition-all" style={{ width: `${t.progress}%` }} />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
              {t.difficulty && <span>· {t.difficulty}</span>}
              {t.source && <span>· {t.source}</span>}
              {t.deadline && <span>· by {t.deadline}</span>}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && (
          <TopicDialog title="Edit topic" initial={editing} onSubmit={async (input) => { await update.mutateAsync({ id: editing.id, ...input }); setEditing(null); toast.success("Saved"); }} />
        )}
      </Dialog>
    </div>
  );
}

function TopicDialog({ title, initial, onSubmit }: { title: string; initial?: LearnTopic; onSubmit: (input: Partial<LearnTopic>) => Promise<void> }) {
  const [f, setF] = useState<Partial<LearnTopic>>({
    topic: initial?.topic ?? "",
    skill: initial?.skill ?? "Python",
    status: initial?.status ?? "Not Started",
    progress: initial?.progress ?? 0,
    difficulty: initial?.difficulty ?? "Medium",
    source: initial?.source ?? "",
    deadline: initial?.deadline ?? null,
  });
  return (
    <DialogContent>
      <DialogHeader><DialogTitle className="font-serif">{title}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Topic</Label><Input value={f.topic ?? ""} onChange={(e) => setF({ ...f, topic: e.target.value })} className="mt-1" autoFocus /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Skill</Label>
            <Select value={f.skill ?? "Python"} onValueChange={(v) => setF({ ...f, skill: v })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>{SKILLS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Status</Label>
            <Select value={f.status ?? "Not Started"} onValueChange={(v) => setF({ ...f, status: v })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Progress %</Label>
            <Input type="number" min={0} max={100} value={f.progress ?? 0} onChange={(e) => setF({ ...f, progress: Math.min(100, Math.max(0, Number(e.target.value))) })} className="mt-1" />
          </div>
          <div><Label>Difficulty</Label>
            <Select value={f.difficulty ?? "Medium"} onValueChange={(v) => setF({ ...f, difficulty: v })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>{DIFFICULTIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div><Label>Source</Label><Input value={f.source ?? ""} onChange={(e) => setF({ ...f, source: e.target.value })} className="mt-1" placeholder="Book, course, link…" /></div>
        <div><Label>Deadline</Label><Input type="date" value={f.deadline ?? ""} onChange={(e) => setF({ ...f, deadline: e.target.value || null })} className="mt-1" /></div>
      </div>
      <DialogFooter><Button onClick={() => f.topic?.trim() && onSubmit(f)}>Save</Button></DialogFooter>
    </DialogContent>
  );
}
