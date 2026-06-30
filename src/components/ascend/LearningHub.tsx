import { useState } from "react";
import { cn } from "@/lib/utils";
import LearnTab from "./LearnTab";
import FlashcardsTab from "./FlashcardsTab";
import NotesTab from "./NotesTab";
import CodingTab from "./CodingTab";
import QuizTab from "./QuizTab";
import ExamPrepTab from "./ExamPrepTab";
import AcademicProjectsTab from "./AcademicProjectsTab";
import ProgressTab from "./ProgressTab";

const SUBS = ["Learn", "Notes", "Coding", "Quiz", "Flashcards", "Exam Prep", "Projects", "Progress"] as const;

export default function LearningHub() {
  const [sub, setSub] = useState<(typeof SUBS)[number]>("Learn");
  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] tracking-[0.2em] uppercase text-[var(--gold)]">Learning Hub</p>
        <h1 className="font-serif text-3xl md:text-4xl text-primary mt-2">The Library</h1>
        <p className="text-sm text-muted-foreground mt-2">Where the AI engineer is forged, one quiet hour at a time.</p>
      </div>

      <div className="border-b border-border overflow-x-auto">
        <nav className="flex gap-1">
          {SUBS.map((s) => (
            <button
              key={s}
              onClick={() => setSub(s)}
              className={cn(
                "px-3 py-2 text-sm whitespace-nowrap transition-colors border-b-2 -mb-px",
                sub === s ? "border-primary text-primary font-medium" : "border-transparent text-muted-foreground hover:text-primary"
              )}
            >
              {s}
            </button>
          ))}
        </nav>
      </div>

      <div className="animate-in fade-in duration-300">
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
