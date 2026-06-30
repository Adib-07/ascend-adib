import { useState } from "react";
import { cn } from "@/lib/utils";
import LearnTab from "./LearnTab";
import FlashcardsTab from "./FlashcardsTab";
import Placeholder from "./Placeholder";

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

      {sub === "Learn" && <LearnTab />}
      {sub === "Flashcards" && <FlashcardsTab />}
      {sub !== "Learn" && sub !== "Flashcards" && (
        <Placeholder title={sub} subtitle="This sub-tab will be built next. Foundation: Learn & Flashcards first." />
      )}
    </div>
  );
}
