import { useMemo, useState } from "react";
import { useQuizItems, type QuizItem } from "@/lib/ascend-hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { SectionHeader, EmptyState, Card, Pill } from "./ui-bits";
import { toast } from "sonner";

export default function QuizTab() {
  const { list, create, update, remove } = useQuizItems();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<QuizItem | null>(null);
  const [draft, setDraft] = useState({ question: "", answer: "", topic: "" });
  const [mode, setMode] = useState<"bank" | "practice">("bank");
  const [topicFilter, setTopicFilter] = useState<string | null>(null);
  const [practiceIdx, setPracticeIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const items = list.data ?? [];
  const topics = useMemo(() => Array.from(new Set(items.map(i => i.topic ?? "Untagged"))), [items]);
  const practiceSet = topicFilter ? items.filter(i => (i.topic ?? "Untagged") === topicFilter) : items;
  const current = practiceSet[practiceIdx];

  function openNew() { setEditing(null); setDraft({ question: "", answer: "", topic: "" }); setOpen(true); }
  function openEdit(q: QuizItem) { setEditing(q); setDraft({ question: q.question, answer: q.answer, topic: q.topic ?? "" }); setOpen(true); }
  async function save() {
    if (!draft.question.trim() || !draft.answer.trim()) { toast.error("Question & answer required"); return; }
    try {
      if (editing) await update.mutateAsync({ id: editing.id, ...draft });
      else await create.mutateAsync(draft);
      setOpen(false); toast.success("Saved");
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  return (
    <div className="space-y-6">
      <SectionHeader kicker="Quiz" title="The Examination Room"
        subtitle="Self-tested knowledge is the only kind that holds."
        right={mode === "bank" && <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" />Add Q&A</Button>} />

      <div className="flex gap-2">
        <Pill active={mode === "bank"} onClick={() => setMode("bank")}>Question Bank</Pill>
        <Pill active={mode === "practice"} onClick={() => { setMode("practice"); setPracticeIdx(0); setRevealed(false); }}>Practice Mode</Pill>
      </div>

      {mode === "bank" ? (
        items.length === 0 ? <EmptyState title="No questions yet." hint="Build your bank — one Q&A at a time." /> : (
          <div className="space-y-6">
            {topics.map(topic => {
              const group = items.filter(i => (i.topic ?? "Untagged") === topic);
              return (
                <div key={topic}>
                  <p className="text-[11px] tracking-[0.2em] uppercase text-[var(--gold)] mb-2">{topic}</p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {group.map(q => (
                      <Card key={q.id} className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-primary">{q.question}</p>
                          <div className="flex shrink-0 gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(q)}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove.mutate(q.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">{q.answer}</p>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        <div className="space-y-4">
          <div className="flex gap-2 overflow-x-auto">
            <Pill active={topicFilter === null} onClick={() => { setTopicFilter(null); setPracticeIdx(0); setRevealed(false); }}>All</Pill>
            {topics.map(t => <Pill key={t} active={topicFilter === t} onClick={() => { setTopicFilter(t); setPracticeIdx(0); setRevealed(false); }}>{t}</Pill>)}
          </div>
          {!current ? <EmptyState title="No questions in this set." /> : (
            <Card className="p-8 text-center min-h-[260px] flex flex-col justify-center">
              <p className="text-[11px] tracking-[0.2em] uppercase text-[var(--gold)] mb-3">Question {practiceIdx + 1} of {practiceSet.length}</p>
              <p className="font-serif text-2xl text-primary">{current.question}</p>
              {revealed && (
                <div className="mt-6 pt-6 border-t border-border">
                  <p className="text-[11px] tracking-[0.2em] uppercase text-muted-foreground mb-2">Answer</p>
                  <p className="text-base text-foreground">{current.answer}</p>
                </div>
              )}
              <div className="flex items-center justify-center gap-2 mt-6">
                <Button variant="outline" size="sm" disabled={practiceIdx === 0} onClick={() => { setPracticeIdx(i => i - 1); setRevealed(false); }}><ChevronLeft className="h-4 w-4" /></Button>
                <Button onClick={() => setRevealed(r => !r)} variant="secondary" size="sm"><Eye className="h-4 w-4 mr-1" />{revealed ? "Hide" : "Reveal"}</Button>
                <Button variant="outline" size="sm" disabled={practiceIdx >= practiceSet.length - 1} onClick={() => { setPracticeIdx(i => i + 1); setRevealed(false); }}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </Card>
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[var(--card)]">
          <DialogHeader><DialogTitle className="font-serif text-2xl text-primary">{editing ? "Edit" : "New"} Q&A</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Topic</Label><Input value={draft.topic} onChange={e => setDraft({ ...draft, topic: e.target.value })} placeholder="e.g. DBMS" /></div>
            <div><Label>Question</Label><Textarea rows={3} value={draft.question} onChange={e => setDraft({ ...draft, question: e.target.value })} /></div>
            <div><Label>Answer</Label><Textarea rows={4} value={draft.answer} onChange={e => setDraft({ ...draft, answer: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
