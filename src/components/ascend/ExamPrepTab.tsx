import { useState } from "react";
import { useExams, type Exam } from "@/lib/ascend-hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { SectionHeader, EmptyState, Card } from "./ui-bits";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

const STATUSES = ["Not Started", "In Progress", "Ready"] as const;

type SyllabusItem = { id: string; topic: string; done: boolean };

function daysUntil(date: string | null) {
  if (!date) return null;
  const diff = Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
  return diff;
}

export default function ExamPrepTab() {
  const { list, create, update, remove } = useExams();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Exam | null>(null);
  const [draft, setDraft] = useState({
    name: "",
    subject: "",
    exam_date: "",
    prep_status: "Not Started",
  });
  const [newTopic, setNewTopic] = useState<Record<string, string>>({});
  const exams = list.data ?? [];

  function openNew() {
    setEditing(null);
    setDraft({ name: "", subject: "", exam_date: "", prep_status: "Not Started" });
    setOpen(true);
  }
  function openEdit(e: Exam) {
    setEditing(e);
    setDraft({
      name: e.name,
      subject: e.subject ?? "",
      exam_date: e.exam_date ?? "",
      prep_status: e.prep_status ?? "Not Started",
    });
    setOpen(true);
  }
  async function save() {
    if (!draft.name.trim()) {
      toast.error("Name required");
      return;
    }
    const payload = { ...draft, exam_date: draft.exam_date || null };
    try {
      if (editing) await update.mutateAsync({ id: editing.id, ...payload });
      else await create.mutateAsync({ ...payload, syllabus: [] });
      setOpen(false);
      toast.success("Saved");
    } catch (er: unknown) {
      toast.error(er instanceof Error ? er.message : "Failed");
    }
  }

  function syllabusOf(e: Exam): SyllabusItem[] {
    if (!Array.isArray(e.syllabus)) return [];
    return e.syllabus as unknown as SyllabusItem[];
  }
  function setSyllabus(e: Exam, items: SyllabusItem[]) {
    update.mutate({ id: e.id, syllabus: items as never });
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        kicker="Exam Prep"
        title="The Antechamber"
        subtitle="What separates the prepared from the panicked."
        right={
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4 mr-1" />
            Add exam
          </Button>
        }
      />

      {exams.length === 0 ? (
        <EmptyState title="No exams logged." hint="Add your next one and start the count." />
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          {exams.map((e) => {
            const days = daysUntil(e.exam_date);
            const syll = syllabusOf(e);
            const done = syll.filter((s) => s.done).length;
            const pct = syll.length ? Math.round((done / syll.length) * 100) : 0;
            return (
              <Card key={e.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-serif text-xl text-primary">{e.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {e.subject || "—"} · {e.prep_status}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    {days !== null && (
                      <div
                        className={`font-serif text-2xl ${days < 7 ? "text-[var(--destructive)]" : "text-[var(--gold)]"}`}
                      >
                        {days >= 0 ? `${days}d` : "passed"}
                      </div>
                    )}
                    <div className="flex justify-end gap-1 mt-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => openEdit(e)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() =>
                          remove.mutate(e.id, {
                            onError: (e: unknown) =>
                              toast.error(e instanceof Error ? e.message : "Failed to delete"),
                          })
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="mt-3">
                  <Progress value={pct} />
                  <p className="text-xs text-muted-foreground mt-1">
                    {done}/{syll.length} topics · {pct}%
                  </p>
                </div>
                <div className="mt-4 space-y-1">
                  {syll.map((s) => (
                    <div key={s.id} className="flex items-center gap-2 group">
                      <Checkbox
                        checked={s.done}
                        onCheckedChange={(v) =>
                          setSyllabus(
                            e,
                            syll.map((x) => (x.id === s.id ? { ...x, done: !!v } : x)),
                          )
                        }
                      />
                      <span
                        className={`text-sm flex-1 ${s.done ? "line-through text-muted-foreground" : ""}`}
                      >
                        {s.topic}
                      </span>
                      <button
                        onClick={() =>
                          setSyllabus(
                            e,
                            syll.filter((x) => x.id !== s.id),
                          )
                        }
                        className="opacity-0 group-hover:opacity-100"
                      >
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-2 pt-2">
                    <Input
                      placeholder="Add syllabus topic"
                      value={newTopic[e.id] ?? ""}
                      onChange={(ev) => setNewTopic({ ...newTopic, [e.id]: ev.target.value })}
                      onKeyDown={(ev) => {
                        if (ev.key === "Enter") {
                          const v = newTopic[e.id]?.trim();
                          if (v) {
                            setSyllabus(e, [
                              ...syll,
                              { id: crypto.randomUUID(), topic: v, done: false },
                            ]);
                            setNewTopic({ ...newTopic, [e.id]: "" });
                          }
                        }
                      }}
                    />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[var(--card)]">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl text-primary">
              {editing ? "Edit exam" : "New exam"}
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
              <Label>Subject</Label>
              <Input
                value={draft.subject}
                onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
              />
            </div>
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={draft.exam_date}
                onChange={(e) => setDraft({ ...draft, exam_date: e.target.value })}
              />
            </div>
            <div>
              <Label>Prep status</Label>
              <Select
                value={draft.prep_status}
                onValueChange={(v) => setDraft({ ...draft, prep_status: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
