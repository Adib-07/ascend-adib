import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Loader2, RotateCw, Check, X } from "lucide-react";
import { toast } from "sonner";
import { SectionHeader, EmptyState, Card } from "./ui-bits";
import { teachTopic, practiceQuestions, generateQuiz } from "@/lib/tutor.functions";

import NotesTab from "./NotesTab";
import CodingTab from "./CodingTab";
import QuizTab from "./QuizTab";
import FlashcardsTab from "./FlashcardsTab";
import ExamPrepTab from "./ExamPrepTab";
import AcademicProjectsTab from "./AcademicProjectsTab";
import ProgressTab from "./ProgressTab";

const SUBS = ["Learn", "Notes", "Coding", "Quiz", "Flashcards", "Exam Prep", "Projects", "Progress"] as const;
const SESSIONS_KEY = "ascend_tutor_sessions";

function bumpSessionCount() {
  try {
    const n = Number(localStorage.getItem(SESSIONS_KEY) ?? "0") + 1;
    localStorage.setItem(SESSIONS_KEY, String(n));
  } catch { /* noop */ }
}
function getSessionCount() {
  try { return Number(localStorage.getItem(SESSIONS_KEY) ?? "0"); } catch { return 0; }
}

export default function CSETutorView() {
  const [sub, setSub] = useState<(typeof SUBS)[number]>("Learn");
  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] tracking-[0.2em] uppercase text-[var(--gold)]">CSE Tutor</p>
        <h1 className="font-serif text-3xl md:text-4xl text-primary mt-2">The Private Tutor</h1>
        <p className="text-sm text-muted-foreground mt-2">First principles, always. Ask, understand, drill, repeat.</p>
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
        {sub === "Learn" && <LearnAI />}
        {sub === "Notes" && <NotesTab />}
        {sub === "Coding" && <CodingTab />}
        {sub === "Quiz" && <QuizAI />}
        {sub === "Flashcards" && <FlashcardsTab />}
        {sub === "Exam Prep" && <ExamPrepTab />}
        {sub === "Projects" && <AcademicProjectsTab />}
        {sub === "Progress" && <ProgressWithSessions />}
      </div>
    </div>
  );
}

const QUICK_TOPICS = ["DBMS Transactions", "ACID Properties", "Python OOP", "ML Basics", "Data Structures", "OS Concepts"];

function LearnAI() {
  const [topic, setTopic] = useState("");
  const [lesson, setLesson] = useState<string>("");
  const [questions, setQuestions] = useState<string[]>([]);
  const teach = useServerFn(teachTopic);
  const practice = useServerFn(practiceQuestions);

  const teachM = useMutation({
    mutationFn: async (t: string) => {
      const res = await teach({ data: { topic: t } });
      const pq = await practice({ data: { topic: t } }).catch(() => ({ questions: [] as string[] }));
      return { text: res.text, questions: pq.questions };
    },
    onSuccess: (data) => {
      setLesson(data.text);
      setQuestions(data.questions);
      bumpSessionCount();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to fetch lesson"),
  });

  function run(t: string) {
    if (!t.trim()) { toast.error("Enter a topic"); return; }
    setTopic(t);
    setLesson(""); setQuestions([]);
    teachM.mutate(t);
  }

  return (
    <div className="space-y-6">
      <SectionHeader kicker="AI Tutor" title="Teach me anything" subtitle="From first principles, in the language of an engineer." />

      <Card>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. DBMS Transactions, Gradient Descent, TCP handshake…"
            onKeyDown={(e) => { if (e.key === "Enter") run(topic); }}
            className="flex-1"
          />
          <Button onClick={() => run(topic)} disabled={teachM.isPending}>
            {teachM.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
            Teach me
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {QUICK_TOPICS.map((q) => (
            <button
              key={q}
              onClick={() => run(q)}
              className="px-3 py-1 rounded-full text-xs border border-[var(--gold)]/40 text-[var(--gold)] hover:bg-[var(--gold)]/10 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      </Card>

      {teachM.isPending && (
        <Card>
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Composing your lesson…</span>
          </div>
        </Card>
      )}

      {lesson && (
        <Card>
          <article className="prose prose-sm max-w-none prose-headings:font-serif prose-headings:text-primary prose-strong:text-primary prose-a:text-[var(--gold)] prose-code:text-primary prose-code:bg-secondary prose-code:px-1 prose-code:rounded">
            <ReactMarkdown>{lesson}</ReactMarkdown>
          </article>
        </Card>
      )}

      {questions.length > 0 && (
        <Card>
          <p className="text-[11px] tracking-[0.2em] uppercase text-[var(--gold)] mb-3">Practice Questions</p>
          <ol className="space-y-2 list-decimal pl-5">
            {questions.map((q, i) => (
              <li key={i} className="text-sm text-foreground">{q}</li>
            ))}
          </ol>
        </Card>
      )}

      {!lesson && !teachM.isPending && (
        <EmptyState title="What shall we learn today?" hint="Type any CSE concept above, or tap a quick topic to begin." />
      )}
    </div>
  );
}

const QUIZ_TOPICS = ["Python", "AI", "ML", "DBMS", "DSA", "OS", "Data Analytics"];

type MCQ = { question: string; options: string[]; correct: number; explanation: string };

function QuizAI() {
  const [topic, setTopic] = useState("DBMS");
  const [questions, setQuestions] = useState<MCQ[]>([]);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const gen = useServerFn(generateQuiz);

  const genM = useMutation({
    mutationFn: async () => gen({ data: { topic } }),
    onSuccess: (data) => {
      if (!data.questions.length) { toast.error("Couldn't generate quiz. Try again."); return; }
      setQuestions(data.questions);
      setIdx(0); setPicked(null); setScore(0);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  function pick(i: number) {
    if (picked !== null) return;
    setPicked(i);
    if (i === questions[idx].correct) setScore((s) => s + 1);
  }
  function next() {
    if (idx < questions.length - 1) { setIdx((i) => i + 1); setPicked(null); }
  }
  function reset() { setQuestions([]); setIdx(0); setPicked(null); setScore(0); }

  const q = questions[idx];
  const done = questions.length > 0 && idx === questions.length - 1 && picked !== null;

  return (
    <div className="space-y-6">
      <SectionHeader kicker="AI Quiz" title="Instant examination" subtitle="Five questions. Real explanations. No cheating." />

      <Card>
        <div className="flex flex-col sm:flex-row gap-2">
          <Select value={topic} onValueChange={setTopic}>
            <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
            <SelectContent>{QUIZ_TOPICS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
          <Button onClick={() => genM.mutate()} disabled={genM.isPending} className="flex-1 sm:flex-none">
            {genM.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
            Generate Quiz
          </Button>
          {questions.length > 0 && (
            <Button variant="outline" onClick={reset}><RotateCw className="h-4 w-4 mr-1" />Reset</Button>
          )}
        </div>
      </Card>

      {questions.length === 0 && !genM.isPending && (
        <EmptyState title="Pick a topic, generate five questions." hint="A tiny mock exam, tailored on demand." />
      )}

      {q && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] tracking-[0.2em] uppercase text-[var(--gold)]">Question {idx + 1} of {questions.length}</p>
            <p className="text-xs text-muted-foreground">Score: {score}/{questions.length}</p>
          </div>
          <p className="font-serif text-xl text-primary mb-4">{q.question}</p>
          <div className="space-y-2">
            {q.options.map((opt, i) => {
              const isCorrect = i === q.correct;
              const isPicked = picked === i;
              const revealed = picked !== null;
              return (
                <button
                  key={i}
                  onClick={() => pick(i)}
                  disabled={revealed}
                  className={cn(
                    "w-full text-left px-4 py-3 rounded-md border transition-colors flex items-center gap-3",
                    !revealed && "border-border hover:border-primary hover:bg-secondary",
                    revealed && isCorrect && "border-[var(--forest)] bg-[var(--forest)]/10 text-primary",
                    revealed && isPicked && !isCorrect && "border-destructive bg-destructive/10 text-destructive",
                    revealed && !isPicked && !isCorrect && "border-border opacity-60",
                  )}
                >
                  <span className="text-xs font-mono">{String.fromCharCode(65 + i)}</span>
                  <span className="flex-1 text-sm">{opt}</span>
                  {revealed && isCorrect && <Check className="h-4 w-4" />}
                  {revealed && isPicked && !isCorrect && <X className="h-4 w-4" />}
                </button>
              );
            })}
          </div>
          {picked !== null && q.explanation && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-[11px] tracking-[0.2em] uppercase text-muted-foreground mb-1">Explanation</p>
              <p className="text-sm text-foreground">{q.explanation}</p>
            </div>
          )}
          {picked !== null && !done && (
            <div className="mt-4 flex justify-end">
              <Button onClick={next}>Next question</Button>
            </div>
          )}
          {done && (
            <div className="mt-4 pt-4 border-t border-border text-center">
              <p className="font-serif text-2xl text-primary">Final score: {score} / {questions.length}</p>
              <Button onClick={() => genM.mutate()} className="mt-3"><RotateCw className="h-4 w-4 mr-1" />Try again</Button>
            </div>
          )}
        </Card>
      )}

      <div>
        <p className="text-[11px] tracking-[0.2em] uppercase text-[var(--gold)] mb-3">My Q&amp;A Bank</p>
        <QuizTab />
      </div>
    </div>
  );
}

function ProgressWithSessions() {
  const [count] = useState(() => getSessionCount());
  return (
    <div className="space-y-6">
      <Card>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">CSE Tutor Sessions</p>
        <p className="font-serif text-4xl text-[var(--gold)] mt-1">{count}</p>
        <p className="text-xs text-muted-foreground mt-1">Lessons requested from your private tutor.</p>
      </Card>
      <ProgressTab />
    </div>
  );
}
