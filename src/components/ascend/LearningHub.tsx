import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import LearnTab from "./LearnTab";
import FlashcardsTab from "./FlashcardsTab";
import NotesTab from "./NotesTab";
import CodingTab from "./CodingTab";
import QuizTab from "./QuizTab";
import ExamPrepTab from "./ExamPrepTab";
import AcademicProjectsTab from "./AcademicProjectsTab";
import ProgressTab from "./ProgressTab";
import { Card } from "./ui-bits";
import { Button } from "@/components/ui/button";
import { useLearnTopics } from "@/lib/ascend-data";

const SUBS = ["Learn", "Notes", "Coding", "Quiz", "Flashcards", "Exam Prep", "Projects", "Progress"] as const;

export default function LearningHub() {
  const [sub, setSub] = useState<(typeof SUBS)[number]>("Learn");
  const topicsQ = useLearnTopics();
  const topics = topicsQ.data ?? [];

  const inProgress = topics.filter((t) => t.status === "In Progress").length;
  const completed = topics.filter((t) => t.status === "Completed" || t.progress >= 100).length;
  // Hours studied proxy = sum(progress) / 10, or use a "hours" field if present. Best-effort.
  const hoursStudied = Math.round(topics.reduce((sum, t) => sum + (t.progress ?? 0), 0) / 10);

  const currentlyStudying = useMemo(() => {
    const inProg = topics.filter((t) => t.status === "In Progress");
    if (!inProg.length) return null;
    return inProg.slice().sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""))[0];
  }, [topics]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] tracking-[0.2em] uppercase text-[var(--gold)]">Learning Hub</p>
        <h1 className="font-serif text-3xl md:text-4xl text-primary mt-2">The Library</h1>
        <p className="text-sm text-muted-foreground mt-2">Where the AI engineer is forged, one quiet hour at a time.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card><p className="text-xs uppercase tracking-wider text-muted-foreground">In Progress</p><p className="font-serif text-3xl text-[var(--gold)] mt-1">{inProgress}</p></Card>
        <Card><p className="text-xs uppercase tracking-wider text-muted-foreground">Completed</p><p className="font-serif text-3xl text-[var(--forest)] mt-1">{completed}</p></Card>
        <Card><p className="text-xs uppercase tracking-wider text-muted-foreground">Hours Studied</p><p className="font-serif text-3xl text-primary mt-1">{hoursStudied}<span className="text-sm text-muted-foreground ml-1">hrs</span></p></Card>
      </div>

      {currentlyStudying && (
        <Card className="border-[var(--gold)]/40 bg-[var(--gold)]/5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-[var(--gold)]">Currently studying</p>
              <p className="font-serif text-xl text-primary mt-1">{currentlyStudying.topic}</p>
              <p className="text-xs text-muted-foreground mt-1">{currentlyStudying.skill}</p>
            </div>
            <Button onClick={() => setSub("Learn")}>Continue →</Button>
          </div>
          <div className="mt-3">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Progress</span>
              <span>{currentlyStudying.progress}%</span>
            </div>
            <div className="h-2 bg-[var(--linen)] rounded-full overflow-hidden">
              <div className="h-full bg-[var(--gold)] rounded-full transition-all duration-700 ease-out" style={{ width: `${currentlyStudying.progress}%` }} />
            </div>
          </div>
        </Card>
      )}

      <div className="border-b border-border overflow-x-auto">
        <nav className="flex gap-1 min-w-max">
          {SUBS.map((s) => (
            <button
              key={s}
              onClick={() => setSub(s)}
              className={cn(
                "px-3 py-2 text-sm whitespace-nowrap transition-colors border-b-2 -mb-px",
                sub === s ? "border-[var(--gold)] text-primary font-medium" : "border-transparent text-muted-foreground hover:text-primary"
              )}
            >
              {s}
            </button>
          ))}
        </nav>
      </div>

      <div key={sub} className="animate-in fade-in duration-300">
        {sub === "Learn" && <LearnTab />}
        {sub === "Notes" && <NotesTab />}
        {sub === "Coding" && <CodingTab />}
        {sub === "Quiz" && <QuizTab />}
        {sub === "Flashcards" && <FlashcardsTab />}
        {sub === "Exam Prep" && <ExamPrepTab />}
        {sub === "Projects" && <AcademicProjectsTab />}
        {sub === "Progress" && <ProgressTab />}
      </div>
    </div>
  );
}
