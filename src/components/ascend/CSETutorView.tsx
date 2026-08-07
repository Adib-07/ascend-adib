import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Loader2, RotateCw, Send, Bug, ChevronLeft, ChevronRight, Check, X, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Card, AIThinking, AIError } from "./ui-bits";
import { teachTopic, practiceQuestions, generateQuiz, chatTutor, askTutor } from "@/lib/tutor.functions";

// ---------- localStorage utilities ----------

type Stats = { topicsDone: number; dayStreak: number; lastQuizPct: number; cardsReviewed: number; lastActive: string };
const STATS_KEY = "ascend_cse_stats";
const CHAT_KEY = "ascend_cse_chat";
const NOTES_KEY = "ascend_cse_notes";
const NOTES_SEEDED = "ascend_cse_notes_seeded";
const QUIZ_KEY = "ascend_quiz_scores";
const FLASH_KEY = "ascend_flashdecks";
const EXAMS_KEY = "ascend_exams";

function readJSON<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}
function writeJSON(key: string, v: unknown) { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* noop */ } }

function getStats(): Stats {
  const today = new Date().toISOString().slice(0, 10);
  const s = readJSON<Stats>(STATS_KEY, { topicsDone: 0, dayStreak: 0, lastQuizPct: 0, cardsReviewed: 0, lastActive: "" });
  if (s.lastActive !== today) {
    // update streak: consecutive day = +1, else reset to 1
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    s.dayStreak = s.lastActive === yesterday ? s.dayStreak + 1 : 1;
    s.lastActive = today;
    writeJSON(STATS_KEY, s);
  }
  return s;
}
function bumpStat(patch: Partial<Stats>) {
  const s = getStats();
  Object.assign(s, patch);
  writeJSON(STATS_KEY, s);
  window.dispatchEvent(new CustomEvent("ascend-stats-change"));
}

// ---------- Types ----------
type SubTab = "Home" | "Learn" | "Notes" | "Coding" | "Quiz" | "Flashcards" | "Exam Prep" | "Projects" | "Progress" | "Chat";
const SUBS: SubTab[] = ["Home", "Learn", "Notes", "Coding", "Quiz", "Flashcards", "Exam Prep", "Projects", "Progress", "Chat"];

// ---------- Root View ----------

export default function CSETutorView() {
  const [sub, setSub] = useState<SubTab>("Home");
  const [prefillLearn, setPrefillLearn] = useState<string>("");

  const jump = (target: SubTab, prefill?: string) => {
    if (prefill) setPrefillLearn(prefill);
    setSub(target);
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] tracking-[0.2em] uppercase text-[var(--gold)]">CSE Tutor</p>
        <h1 className="font-serif text-3xl md:text-4xl text-primary mt-2">The Private Tutor</h1>
        <p className="text-sm text-muted-foreground mt-2">First principles, always. Ask, understand, drill, repeat.</p>
      </div>

      <div className="border-b border-border">
        <nav className="flex overflow-x-auto gap-1 pb-1 scrollbar-hide -mx-4 px-4">
          {SUBS.map((s) => (
            <button
              key={s}
              onClick={() => setSub(s)}
              className={cn(
                "px-3 py-2 text-sm whitespace-nowrap flex-shrink-0 transition-colors border-b-2 -mb-px",
                sub === s ? "border-[var(--gold)] text-primary font-medium" : "border-transparent text-muted-foreground hover:text-primary"
              )}
            >
              {s}
            </button>
          ))}
        </nav>
      </div>

      <div key={sub} className="animate-in fade-in duration-300">
        {sub === "Home" && <HomeTab jump={jump} />}
        {sub === "Learn" && <LearnAI initial={prefillLearn} consumeInitial={() => setPrefillLearn("")} />}
        {sub === "Notes" && <NotesTab />}
        {sub === "Coding" && <CodingAI />}
        {sub === "Quiz" && <QuizAI />}
        {sub === "Flashcards" && <FlashcardsAI />}
        {sub === "Exam Prep" && <ExamPrepAI />}
        {sub === "Projects" && <ProjectsAI />}
        {sub === "Progress" && <ProgressTab />}
        {sub === "Chat" && <ChatTab />}
      </div>
    </div>
  );
}

// ---------- Shared UI atoms ----------

function StatCard({ label, value, tone = "primary" }: { label: string; value: string | number; tone?: "primary" | "gold" | "forest" | "red" }) {
  const color = tone === "gold" ? "text-[var(--gold)]" : tone === "forest" ? "text-[var(--forest)]" : tone === "red" ? "text-red-600" : "text-primary";
  return (
    <Card>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("font-serif text-3xl mt-1", color)}>{value}</p>
    </Card>
  );
}

function QuickCard({ emoji, title, subtitle, onClick }: { emoji: string; title: string; subtitle: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-left card-elegant p-4 hover:shadow-md transition-all hover:-translate-y-0.5 active:scale-[0.98]">
      <p className="text-2xl">{emoji}</p>
      <p className="font-serif text-base text-primary mt-2">{title}</p>
      <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
    </button>
  );
}

function LessonRender({ text }: { text: string }) {
  return (
    <article className="prose prose-sm max-w-none prose-headings:font-serif prose-headings:text-primary prose-strong:text-primary prose-a:text-[var(--gold)] prose-code:text-primary prose-code:bg-secondary prose-code:px-1 prose-code:rounded prose-pre:bg-[#2B2B2B] prose-pre:text-[#F5F2EB]">
      <ReactMarkdown>{text}</ReactMarkdown>
    </article>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="my-3 rounded-xl overflow-hidden border border-border">
      <div className="bg-[#2B2B2B] px-4 py-2 flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Code</span>
        <button
          onClick={() => { navigator.clipboard.writeText(code).then(() => toast.success("Copied")).catch(() => toast.error("Copy failed")); }}
          className="text-[10px] text-[var(--gold)] hover:text-[var(--ivory)] transition-colors"
        >
          Copy
        </button>
      </div>
      <pre className="bg-[#1a1a1a] text-[#F5F2EB] p-4 overflow-x-auto text-xs leading-relaxed font-mono">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function formatTutorResponse(text: string) {
  return text.split("\n").map((line, i) => {
    if (line.startsWith("## ")) {
      return (
        <h3 key={i} className="font-serif text-lg text-[var(--forest)] font-semibold mt-6 mb-2 pb-1 border-b border-border">
          {line.replace("## ", "")}
        </h3>
      );
    }
    if (line.startsWith("### ")) {
      return <h4 key={i} className="font-serif text-base text-[var(--gold)] font-medium mt-4 mb-1">{line.replace("### ", "")}</h4>;
    }
    if (line.startsWith("🎯")) {
      return (
        <div key={i} className="bg-[var(--forest)]/10 border-l-4 border-[var(--forest)] px-4 py-3 rounded-r-xl my-3">
          <p className="text-sm font-medium text-[var(--forest)]">{line}</p>
        </div>
      );
    }
    if (line.startsWith("✅") || line.startsWith("✓")) return <p key={i} className="text-emerald-700 text-sm py-0.5">{line}</p>;
    if (line.startsWith("❌") || line.startsWith("✗")) return <p key={i} className="text-red-600 text-sm py-0.5">{line}</p>;
    if (line.startsWith("⚠️")) return <p key={i} className="text-amber-600 text-sm py-0.5">{line}</p>;
    if (line.startsWith("- ") || line.startsWith("• ")) {
      return (
        <p key={i} className="text-sm text-foreground pl-4 py-0.5 before:content-['•'] before:mr-2 before:text-[var(--gold)]">
          {line.replace(/^[-•]\s/, "")}
        </p>
      );
    }
    if (/^\d+\.\s/.test(line)) return <p key={i} className="text-sm text-foreground pl-4 py-0.5">{line}</p>;
    if (line.trim() === "") return <div key={i} className="h-2" />;
    return <p key={i} className="text-sm text-foreground leading-relaxed py-0.5">{line}</p>;
  });
}

function renderTutorResponse(text: string) {
  return text.split(/(```[\s\S]*?```)/g).map((part, i) => {
    if (part.startsWith("```")) {
      const code = part.replace(/^```\w*\n?/, "").replace(/```$/, "");
      return <CodeBlock key={i} code={code} />;
    }
    return <div key={i}>{formatTutorResponse(part)}</div>;
  });
}


// ============================================================
// HOME
// ============================================================
function HomeTab({ jump }: { jump: (sub: SubTab, prefill?: string) => void }) {
  const [stats, setStats] = useState<Stats>(() => getStats());
  useEffect(() => {
    const h = () => setStats(getStats());
    window.addEventListener("ascend-stats-change", h);
    return () => window.removeEventListener("ascend-stats-change", h);
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="font-serif text-2xl text-primary">Welcome back, Adib 👋</h2>
        <p className="text-sm text-muted-foreground mt-1">B.Tech CSE · AI Engineering goal · Continuing from last session</p>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Topics Done" value={stats.topicsDone} tone="primary" />
        <StatCard label="Day Streak" value={`${stats.dayStreak}d`} tone="gold" />
        <StatCard label="Last Quiz %" value={`${stats.lastQuizPct}%`} tone="forest" />
        <StatCard label="Cards Reviewed" value={stats.cardsReviewed} tone="primary" />
      </div>

      <Card>
        <div className="flex items-center gap-2">
          <p className="text-[11px] tracking-[0.2em] uppercase text-[var(--gold)]">Resume last session</p>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--forest)]/10 text-[var(--forest)] border border-[var(--forest)]/20">Done</span>
        </div>
        <h3 className="font-serif text-xl text-primary mt-2">DBMS — Normalization</h3>
        <p className="text-sm text-muted-foreground mt-2">1NF → 2NF → 3NF → BCNF covered. Suggested next: DBMS Transactions and ACID properties.</p>
        <div className="mt-4 flex gap-2 flex-wrap">
          <Button onClick={() => jump("Learn", "DBMS Transactions and ACID properties")}>Resume →</Button>
          <Button variant="outline" onClick={() => jump("Quiz")}>Quick Quiz</Button>
        </div>
      </Card>

      <div>
        <p className="text-[11px] tracking-[0.2em] uppercase text-[var(--gold)] mb-3">What do you want to do today?</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <QuickCard emoji="📚" title="Learn a topic" subtitle="Step by step" onClick={() => jump("Learn")} />
          <QuickCard emoji="💻" title="Coding practice" subtitle="DSA + algorithms" onClick={() => jump("Coding")} />
          <QuickCard emoji="❓" title="Take a quiz" subtitle="Test yourself" onClick={() => jump("Quiz")} />
          <QuickCard emoji="🃏" title="Flashcards" subtitle="Active recall" onClick={() => jump("Flashcards")} />
          <QuickCard emoji="📋" title="Exam prep" subtitle="80/20 strategy" onClick={() => jump("Exam Prep")} />
          <QuickCard emoji="🔧" title="Build project" subtitle="Full blueprint" onClick={() => jump("Projects")} />
        </div>
      </div>

      <Card>
        <p className="text-[11px] tracking-[0.2em] uppercase text-[var(--gold)] mb-3">Suggested next</p>
        <div className="space-y-2">
          {[
            { emoji: "🗄️", title: "DBMS Transactions + ACID", why: "Logical next after Normalization", topic: "DBMS Transactions and ACID Properties" },
            { emoji: "🌳", title: "Binary Trees", why: "Core DSA · High FAANG priority", topic: "Binary Trees data structure" },
            { emoji: "⚙️", title: "OS Process Scheduling", why: "Frequently tested in exams", topic: "OS Process Scheduling algorithms" },
          ].map((s) => (
            <div key={s.title} className="flex items-center gap-3 p-3 rounded-md border border-border hover:border-[var(--gold)]/40 hover:bg-[var(--linen)]/40 transition-colors">
              <span className="text-2xl">{s.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-primary text-sm">{s.title}</p>
                <p className="text-xs text-muted-foreground">{s.why}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => jump("Learn", s.topic)}>Learn →</Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ============================================================
// LEARN
// ============================================================
const LEARN_SUBJECTS = [
  { emoji: "🗄️", name: "DBMS", tag: "Transactions next" },
  { emoji: "🌳", name: "DSA", tag: "Trees, Graphs, DP" },
  { emoji: "⚙️", name: "OS", tag: "Scheduling · Memory" },
  { emoji: "🌐", name: "Networks", tag: "OSI · TCP/IP" },
  { emoji: "🐍", name: "Python", tag: "Priority AI skill" },
  { emoji: "🧠", name: "ML/AI", tag: "Your priority track" },
  { emoji: "🏗️", name: "System Design", tag: "FAANG must-know" },
  { emoji: "📊", name: "SQL", tag: "Queries + Joins" },
  { emoji: "📦", name: "OOP", tag: "4 pillars" },
];

const DEEP_TOPICS = [
  { label: "Python from Scratch", prompt: "I am starting Python from absolute zero. Teach me from first principles — what Python is, why it exists, and start with variables. Go very deep, use real examples, check my understanding after each concept." },
  { label: "DBMS Transactions", prompt: "Teach me DBMS Transactions and ACID properties deeply. I've completed normalization. Build on that knowledge and explain transactions from first principles with real database examples." },
  { label: "How VPN Works", prompt: "Teach me how a VPN actually works from first principles — the technical mechanism, tunneling, encryption, protocols. Not a summary — deep technical understanding with real examples." },
  { label: "OOP in Python", prompt: "Teach me Object Oriented Programming in Python from scratch. Start with WHY OOP exists, what problem it solves. Then teach class, object, __init__, inheritance, polymorphism — one by one with real code examples." },
  { label: "Data Structures", prompt: "Teach me the most important data structures in depth: Arrays, Linked Lists, Stacks, Queues, Trees, Hash Tables. For each: what it is, how it works internally, when to use it, real examples, time complexity." },
  { label: "How Internet Works", prompt: "Teach me how the internet actually works — from typing google.com to seeing the page. Every step in deep technical detail: DNS, TCP/IP, HTTP, routing, packets. Make it a complete journey." },
  { label: "Machine Learning Basics", prompt: "Teach me machine learning from first principles. What is it really? Why does it work? Start with the intuition before any math or code. Build my mental model from scratch." },
  { label: "OS & Memory", prompt: "Teach me how a computer's operating system manages memory. What is RAM really? How does the OS allocate memory to programs? What are stack and heap? Go deep with real examples." },
];

function LearnAI({ initial, consumeInitial }: { initial: string; consumeInitial: () => void }) {
  const [topic, setTopic] = useState(initial);
  const [lesson, setLesson] = useState("");
  const [questions, setQuestions] = useState<string[]>([]);
  const teach = useServerFn(teachTopic);
  const practice = useServerFn(practiceQuestions);

  useEffect(() => {
    if (initial) { setTopic(initial); run(initial); consumeInitial(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const teachM = useMutation({
    mutationFn: async (t: string) => {
      const res = await teach({ data: { topic: t } });
      const pq = await practice({ data: { topic: t } }).catch(() => ({ questions: [] as string[] }));
      return { text: res.text, questions: pq.questions };
    },
    onSuccess: (data) => {
      setLesson(data.text);
      setQuestions(data.questions);
      const s = getStats();
      bumpStat({ topicsDone: s.topicsDone + 1 });
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
      <Card>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. DBMS Transactions, Binary Trees, Gradient Descent…"
            onKeyDown={(e) => { if (e.key === "Enter") run(topic); }}
            className="flex-1"
          />
          <Button onClick={() => run(topic)} disabled={teachM.isPending}>
            {teachM.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
            Teach me →
          </Button>
        </div>
      </Card>

      <div className="-mx-1 px-1 overflow-x-auto scrollbar-hide">
        <div className="flex gap-2 w-max pb-1">
          {DEEP_TOPICS.map((t) => (
            <button
              key={t.label}
              onClick={() => run(t.prompt)}
              disabled={teachM.isPending}
              className="whitespace-nowrap px-3 py-1.5 rounded-full border border-border text-xs text-muted-foreground hover:text-primary hover:border-[var(--gold)]/50 transition-colors disabled:opacity-50"
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[11px] tracking-[0.2em] uppercase text-[var(--gold)] mb-3">Pick a subject</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {LEARN_SUBJECTS.map((s) => (
            <QuickCard key={s.name} emoji={s.emoji} title={s.name} subtitle={s.tag} onClick={() => run(s.name)} />
          ))}
        </div>
      </div>

      {teachM.isPending && (
        <Card>
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Preparing your lesson…</span>
          </div>
          <div className="mt-4 space-y-2">
            {[80, 60, 90, 70].map((w, i) => <div key={i} className="h-3 rounded bg-[var(--linen)]" style={{ width: `${w}%` }} />)}
          </div>
        </Card>
      )}

      {teachM.isPending && <AIThinking messages={["Preparing your lesson…", "Structuring the deep dive…", "Adding interview answers…"]} />}
      {teachM.isError && !teachM.isPending && <AIError message={teachM.error instanceof Error ? teachM.error.message : "Something went wrong"} onRetry={() => teachM.mutate(topic)} />}
      {lesson && (
        <Card>
          <div className="flex items-center gap-2 mb-4 px-1">
            <div className="w-2 h-2 rounded-full bg-[var(--forest)] animate-pulse" />
            <span className="text-[11px] uppercase tracking-[0.15em] text-[var(--gold)] font-medium">
              Professor Ascend · Deep Teaching Mode
            </span>
          </div>
          {renderTutorResponse(lesson)}
        </Card>
      )}

      {questions.length > 0 && (
        <Card>
          <p className="text-[11px] tracking-[0.2em] uppercase text-[var(--gold)] mb-3">Practice Questions</p>
          <ol className="space-y-2 list-decimal pl-5">
            {questions.map((q, i) => <li key={i} className="text-sm text-foreground">{q}</li>)}
          </ol>
        </Card>
      )}
    </div>
  );
}

// ============================================================
// NOTES
// ============================================================
type Note = { id: string; subject: string; title: string; content: string; badge?: string; createdAt: string };

const NOTE_SEEDS: Note[] = [
  { id: "seed-1", subject: "SQL & Databases", title: "DBMS — Normalization — 1NF to BCNF", content: "1NF: atomic values. 2NF: no partial dependency. 3NF: no transitive dependency. BCNF: every determinant is a superkey. Anomalies: Update, Insertion, Deletion.", badge: "Completed", createdAt: new Date().toISOString() },
  { id: "seed-2", subject: "Data Structures", title: "Big-O Cheat Sheet", content: "Array O(1) access. LinkedList O(n). BST avg O(log n). HashMap O(1). Merge Sort O(n log n).", badge: "Reference", createdAt: new Date().toISOString() },
  { id: "seed-3", subject: "AI Engineering", title: "Prompt Engineering Patterns", content: "Zero-shot: simple tasks. Few-shot: specific format. Chain of Thought: complex reasoning. RAG: external knowledge. ReAct: agent takes actions.", badge: "Priority skill", createdAt: new Date().toISOString() },
];

function NotesTab() {
  const [notes, setNotes] = useState<Note[]>(() => {
    if (!localStorage.getItem(NOTES_SEEDED)) {
      writeJSON(NOTES_KEY, NOTE_SEEDS);
      localStorage.setItem(NOTES_SEEDED, "1");
      return NOTE_SEEDS;
    }
    return readJSON<Note[]>(NOTES_KEY, []);
  });
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState<string>("All");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<Note>>({ subject: "", title: "", content: "" });

  const subjects = useMemo(() => ["All", ...Array.from(new Set(notes.map((n) => n.subject)))], [notes]);
  const filtered = notes.filter((n) =>
    (subject === "All" || n.subject === subject) &&
    (query === "" || (n.title + n.content).toLowerCase().includes(query.toLowerCase()))
  );

  function persist(next: Note[]) { setNotes(next); writeJSON(NOTES_KEY, next); }
  function save() {
    if (!draft.title?.trim() || !draft.subject?.trim()) { toast.error("Subject & title required"); return; }
    const note: Note = { id: crypto.randomUUID(), subject: draft.subject, title: draft.title, content: draft.content ?? "", createdAt: new Date().toISOString() };
    persist([note, ...notes]);
    setOpen(false); setDraft({ subject: "", title: "", content: "" });
    toast.success("Note saved");
  }
  function remove(id: string) { persist(notes.filter(n => n.id !== id)); }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search notes…" className="pl-9" />
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />Save note →</Button>
      </div>

      <div className="flex flex-wrap gap-1">
        {subjects.map((s) => (
          <button key={s} onClick={() => setSubject(s)}
            className={cn("px-3 py-1.5 text-xs rounded-full border transition-colors",
              subject === s ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-primary")}>
            {s}
          </button>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {filtered.length === 0 && <p className="text-sm text-muted-foreground">No notes match.</p>}
        {filtered.map((n) => (
          <div key={n.id} className="card-elegant p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-widest text-[var(--gold)]">{n.subject}</p>
                <p className="font-serif text-lg text-primary mt-0.5">{n.title}</p>
              </div>
              {n.badge && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--forest)]/10 text-[var(--forest)] border border-[var(--forest)]/20 shrink-0">{n.badge}</span>}
            </div>
            <p className="text-sm text-foreground mt-2 whitespace-pre-wrap">{n.content}</p>
            <div className="mt-3 flex justify-end">
              <Button size="sm" variant="ghost" onClick={() => remove(n.id)}><X className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-serif">Save note</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Subject</Label><Input className="mt-1" value={draft.subject ?? ""} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} placeholder="e.g. DBMS" /></div>
            <div><Label>Title</Label><Input className="mt-1" value={draft.title ?? ""} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></div>
            <div><Label>Content</Label><Textarea className="mt-1" rows={5} value={draft.content ?? ""} onChange={(e) => setDraft({ ...draft, content: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// CODING
// ============================================================
const CODING_PROBLEMS = [
  { emoji: "💡", title: "Two Sum", diff: "Easy" },
  { emoji: "🔍", title: "Binary Search", diff: "Easy" },
  { emoji: "🔗", title: "Reverse Linked List", diff: "Medium" },
  { emoji: "🕸️", title: "BFS/DFS", diff: "Medium" },
  { emoji: "⚡", title: "Merge Sort", diff: "Medium" },
  { emoji: "🧩", title: "DP Fibonacci", diff: "Medium" },
  { emoji: "💾", title: "LRU Cache", diff: "Hard" },
  { emoji: "🌳", title: "Tree Traversal", diff: "Medium" },
  { emoji: "📐", title: "Longest Common Subsequence", diff: "Hard" },
];

function CodingAI() {
  const [problem, setProblem] = useState("");
  const [answer, setAnswer] = useState("");
  const [debugCode, setDebugCode] = useState("");
  const [debugDesc, setDebugDesc] = useState("");
  const [debugAns, setDebugAns] = useState("");
  const ask = useServerFn(askTutor);

  const solveM = useMutation({
    mutationFn: async (p: string) => ask({ data: { kind: "coding", prompt: p } }),
    onSuccess: (d) => setAnswer(d.text),
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const debugM = useMutation({
    mutationFn: async () => ask({ data: { kind: "debug", prompt: `Description: ${debugDesc}\n\nCode:\n${debugCode}` } }),
    onSuccess: (d) => setDebugAns(d.text),
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  function solve(p: string) {
    if (!p.trim()) { toast.error("Enter a problem"); return; }
    setProblem(p); setAnswer("");
    solveM.mutate(p);
  }

  const diffColor = (d: string) => d === "Easy" ? "text-[var(--forest)] bg-[var(--forest)]/10 border-[var(--forest)]/20" : d === "Medium" ? "text-[var(--gold)] bg-[var(--gold)]/10 border-[var(--gold)]/30" : "text-red-700 bg-red-50 border-red-200";

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input value={problem} onChange={(e) => setProblem(e.target.value)} placeholder="e.g. Detect a cycle in a linked list" onKeyDown={(e) => e.key === "Enter" && solve(problem)} className="flex-1" />
          <Button onClick={() => solve(problem)} disabled={solveM.isPending}>
            {solveM.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
            Solve →
          </Button>
        </div>
      </Card>

      <div>
        <p className="text-[11px] tracking-[0.2em] uppercase text-[var(--gold)] mb-3">Problem library</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {CODING_PROBLEMS.map((p) => (
            <button key={p.title} onClick={() => solve(p.title)} className="text-left card-elegant p-4 hover:shadow-md transition-all hover:-translate-y-0.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-2xl">{p.emoji}</p>
                <span className={cn("text-[10px] px-2 py-0.5 rounded-full border", diffColor(p.diff))}>{p.diff}</span>
              </div>
              <p className="font-serif text-base text-primary mt-2">{p.title}</p>
            </button>
          ))}
        </div>
      </div>

      {solveM.isPending && <Card><div className="flex items-center gap-3 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /><span className="text-sm">Solving…</span></div></Card>}
      {answer && <Card><LessonRender text={answer} /></Card>}

      <Card>
        <p className="text-[11px] tracking-[0.2em] uppercase text-[var(--gold)] mb-3">Debug my code</p>
        <div className="space-y-3">
          <div>
            <Label>What's broken?</Label>
            <Input className="mt-1" value={debugDesc} onChange={(e) => setDebugDesc(e.target.value)} placeholder="Describe the bug or expected behavior" />
          </div>
          <div>
            <Label>Your code</Label>
            <Textarea className="mt-1 font-mono text-xs" rows={8} value={debugCode} onChange={(e) => setDebugCode(e.target.value)} placeholder="Paste your code here" />
          </div>
          <Button onClick={() => debugCode.trim() ? debugM.mutate() : toast.error("Paste your code")} disabled={debugM.isPending}>
            {debugM.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Bug className="h-4 w-4 mr-1" />}
            🐛 Debug with AI →
          </Button>
        </div>
        {debugAns && <div className="mt-4"><LessonRender text={debugAns} /></div>}
      </Card>
    </div>
  );
}

// ============================================================
// QUIZ
// ============================================================
type MCQ = { question: string; options: string[]; correct: number; explanation: string };
type QuizDifficulty = "Beginner" | "Intermediate" | "Advanced" | "Interview";
const QUIZ_STARTERS = [
  { emoji: "🗄️", title: "DBMS Normalization", note: "You've studied this — test yourself" },
  { emoji: "🌳", title: "Binary Trees", note: "Beginner" },
  { emoji: "⚙️", title: "OS Scheduling", note: "Intermediate" },
];

function QuizAI() {
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<QuizDifficulty>("Intermediate");
  const [questions, setQuestions] = useState<MCQ[]>([]);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [wrong, setWrong] = useState(0);
  const gen = useServerFn(generateQuiz);

  const genM = useMutation({
    mutationFn: async (t: string) => gen({ data: { topic: `${t} (${difficulty} level, 8 questions)` } }),
    onSuccess: (data) => {
      if (!data.questions.length) { toast.error("Couldn't generate quiz. Try again."); return; }
      setQuestions(data.questions.slice(0, 8));
      setIdx(0); setPicked(null); setScore(0); setWrong(0);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  function start(t: string) {
    if (!t.trim()) { toast.error("Enter a topic"); return; }
    setTopic(t);
    genM.mutate(t);
  }
  function pick(i: number) {
    if (picked !== null) return;
    setPicked(i);
    if (i === questions[idx].correct) setScore((s) => s + 1);
    else setWrong((w) => w + 1);
  }
  function next() {
    if (idx < questions.length - 1) { setIdx((i) => i + 1); setPicked(null); }
  }
  function reset() { setQuestions([]); setIdx(0); setPicked(null); setScore(0); setWrong(0); }

  const q = questions[idx];
  const done = questions.length > 0 && idx === questions.length - 1 && picked !== null;

  useEffect(() => {
    if (done) {
      const pct = Math.round((score / questions.length) * 100);
      const scores = readJSON<Array<{ topic: string; score: number; total: number; date: string }>>(QUIZ_KEY, []);
      scores.unshift({ topic, score, total: questions.length, date: new Date().toISOString() });
      writeJSON(QUIZ_KEY, scores.slice(0, 50));
      bumpStat({ lastQuizPct: pct });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  if (questions.length === 0) {
    return (
      <div className="space-y-6">
        <Card>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. DBMS Transactions" onKeyDown={(e) => e.key === "Enter" && start(topic)} className="flex-1" />
            <Button onClick={() => start(topic)} disabled={genM.isPending}>
              {genM.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
              Start →
            </Button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {(["Beginner", "Intermediate", "Advanced", "Interview"] as QuizDifficulty[]).map((d) => (
              <button key={d} onClick={() => setDifficulty(d)}
                className={cn("px-3 py-1.5 rounded-full text-xs border transition-colors",
                  difficulty === d ? "bg-[var(--forest)] text-white border-[var(--forest)]" : "border-border text-muted-foreground hover:text-primary")}>
                {d}
              </button>
            ))}
          </div>
        </Card>

        <div>
          <p className="text-[11px] tracking-[0.2em] uppercase text-[var(--gold)] mb-3">Quick start</p>
          <div className="space-y-2">
            {QUIZ_STARTERS.map((s) => (
              <div key={s.title} className="flex items-center gap-3 p-3 rounded-md border border-border hover:border-[var(--gold)]/40 transition-colors">
                <span className="text-2xl">{s.emoji}</span>
                <div className="flex-1"><p className="font-medium text-primary text-sm">{s.title}</p><p className="text-xs text-muted-foreground">{s.note}</p></div>
                <Button size="sm" variant="ghost" onClick={() => start(s.title)}>Quiz →</Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Correct" value={score} tone="forest" />
        <StatCard label="Wrong" value={wrong} tone="red" />
        <StatCard label="Question" value={`${idx + 1}/${questions.length}`} tone="primary" />
      </div>

      {q && (
        <Card>
          <p className="font-serif text-xl text-primary mb-4">{q.question}</p>
          <div className="space-y-2">
            {q.options.map((opt, i) => {
              const isCorrect = i === q.correct;
              const isPicked = picked === i;
              const revealed = picked !== null;
              return (
                <button key={i} onClick={() => pick(i)} disabled={revealed}
                  className={cn("w-full text-left px-4 py-3 rounded-md border transition-colors flex items-center gap-3",
                    !revealed && "border-border hover:border-primary hover:bg-secondary",
                    revealed && isCorrect && "border-[var(--forest)] bg-[var(--forest)]/10 text-primary",
                    revealed && isPicked && !isCorrect && "border-red-400 bg-red-50 text-red-700",
                    revealed && !isPicked && !isCorrect && "border-border opacity-60")}>
                  <span className="text-xs font-mono">{String.fromCharCode(65 + i)}</span>
                  <span className="flex-1 text-sm">{opt}</span>
                  {revealed && isCorrect && <Check className="h-4 w-4" />}
                  {revealed && isPicked && !isCorrect && <X className="h-4 w-4" />}
                </button>
              );
            })}
          </div>
          {picked !== null && q.explanation && (
            <div className={cn("mt-4 p-3 rounded-md border",
              picked === q.correct ? "bg-[var(--forest)]/5 border-[var(--forest)]/20" : "bg-red-50 border-red-200")}>
              <p className="text-[11px] tracking-[0.2em] uppercase text-muted-foreground mb-1">Explanation</p>
              <p className="text-sm text-foreground">{q.explanation}</p>
            </div>
          )}
          {picked !== null && !done && <div className="mt-4 flex justify-end"><Button onClick={next}>Next →</Button></div>}
          {done && (
            <div className="mt-6 pt-4 border-t border-border text-center">
              <p className="font-serif text-3xl text-primary">You scored {score}/{questions.length}</p>
              <p className="text-sm text-muted-foreground mt-2">
                {score / questions.length >= 0.8 ? "Excellent — mastery approaching." : score / questions.length >= 0.5 ? "Solid start. Drill the misses." : "Weak spots found. Study, then retake."}
              </p>
              <div className="mt-4 flex justify-center gap-2">
                <Button onClick={() => start(topic)}><RotateCw className="h-4 w-4 mr-1" />Try Again</Button>
                <Button variant="outline" onClick={reset}>New Topic</Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// ============================================================
// FLASHCARDS
// ============================================================
type FlashCard = { q: string; a: string; category?: string; known?: boolean };
type FlashDeck = { topic: string; cards: FlashCard[] };

const FLASH_STARTERS = [
  { emoji: "🗄️", title: "DBMS Normalization", note: "16 cards", cta: "Load →" },
  { emoji: "🌳", title: "Binary Trees", note: "", cta: "Generate →" },
  { emoji: "🧠", title: "ML Algorithms", note: "", cta: "Generate →" },
];

const DBMS_NORM_DECK: FlashCard[] = [
  { q: "What is 1NF?", a: "First Normal Form — every column contains atomic (indivisible) values; no repeating groups.", category: "DBMS" },
  { q: "What is 2NF?", a: "In 1NF and no partial dependency — non-key attributes depend on the whole primary key.", category: "DBMS" },
  { q: "What is 3NF?", a: "In 2NF and no transitive dependency — non-key attributes don't depend on other non-key attributes.", category: "DBMS" },
  { q: "What is BCNF?", a: "Boyce-Codd Normal Form — for every non-trivial FD X→Y, X must be a superkey.", category: "DBMS" },
  { q: "Partial dependency?", a: "A non-key attribute depends only on part of a composite primary key.", category: "DBMS" },
  { q: "Transitive dependency?", a: "A non-key attribute depends on another non-key attribute (A → B → C).", category: "DBMS" },
  { q: "Insertion anomaly?", a: "Can't insert a row without inserting unrelated data due to poor schema.", category: "DBMS" },
  { q: "Deletion anomaly?", a: "Deleting a row unintentionally removes other useful information.", category: "DBMS" },
  { q: "Update anomaly?", a: "Same data stored in multiple places must be updated everywhere — risk of inconsistency.", category: "DBMS" },
  { q: "What is a superkey?", a: "Any set of columns that uniquely identifies rows (may contain extra attributes).", category: "DBMS" },
  { q: "Candidate key?", a: "A minimal superkey — no proper subset is also a superkey.", category: "DBMS" },
  { q: "Primary key?", a: "The chosen candidate key used to uniquely identify rows in a table.", category: "DBMS" },
  { q: "Functional dependency?", a: "X → Y means the value of X determines the value of Y.", category: "DBMS" },
  { q: "Why normalize?", a: "Eliminate redundancy, prevent anomalies, ensure data integrity.", category: "DBMS" },
  { q: "Denormalization?", a: "Intentionally adding redundancy for read performance in analytical workloads.", category: "DBMS" },
  { q: "4NF?", a: "In BCNF and no non-trivial multi-valued dependencies.", category: "DBMS" },
];

function FlashcardsAI() {
  const [topic, setTopic] = useState("");
  const [deck, setDeck] = useState<FlashDeck | null>(null);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const ask = useServerFn(askTutor);

  const genM = useMutation({
    mutationFn: async (t: string) => ask({ data: { kind: "flashcards", prompt: t } }),
    onSuccess: (d) => {
      try {
        const cleaned = d.text.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(cleaned) as FlashCard[];
        if (Array.isArray(parsed) && parsed.length) {
          const newDeck: FlashDeck = { topic, cards: parsed.map((c) => ({ q: String(c.q), a: String(c.a), category: c.category ?? topic })) };
          saveDeck(newDeck);
          setDeck(newDeck); setIdx(0); setFlipped(false);
          return;
        }
      } catch { /* noop */ }
      toast.error("Couldn't parse flashcards. Try another topic.");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  function saveDeck(d: FlashDeck) {
    const all = readJSON<Record<string, FlashDeck>>(FLASH_KEY, {});
    all[d.topic] = d;
    writeJSON(FLASH_KEY, all);
  }
  function loadDBMS() {
    const d: FlashDeck = { topic: "DBMS Normalization", cards: DBMS_NORM_DECK };
    saveDeck(d); setDeck(d); setIdx(0); setFlipped(false);
  }
  function generate(t: string) {
    if (!t.trim()) return toast.error("Enter a topic");
    setTopic(t); genM.mutate(t);
  }
  function markKnown(known: boolean) {
    if (!deck) return;
    const next = { ...deck, cards: deck.cards.map((c, i) => i === idx ? { ...c, known } : c) };
    setDeck(next); saveDeck(next);
    const s = getStats();
    bumpStat({ cardsReviewed: s.cardsReviewed + 1 });
    if (idx < deck.cards.length - 1) { setIdx(idx + 1); setFlipped(false); }
    else toast.success("Deck complete");
  }
  function nav(delta: number) {
    if (!deck) return;
    const n = Math.max(0, Math.min(deck.cards.length - 1, idx + delta));
    setIdx(n); setFlipped(false);
    if (delta !== 0) {
      const s = getStats();
      bumpStat({ cardsReviewed: s.cardsReviewed + 1 });
    }
  }

  const total = deck?.cards.length ?? 0;
  const known = deck?.cards.filter((c) => c.known).length ?? 0;
  const current = deck ? idx + 1 : 0;
  const card = deck?.cards[idx];

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Binary Trees" onKeyDown={(e) => e.key === "Enter" && generate(topic)} className="flex-1" />
          <Button onClick={() => generate(topic)} disabled={genM.isPending}>
            {genM.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
            Generate →
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Cards" value={total} tone="primary" />
        <StatCard label="Known" value={known} tone="forest" />
        <StatCard label="Current" value={current} tone="gold" />
      </div>

      {!deck && (
        <Card>
          <p className="text-[11px] tracking-[0.2em] uppercase text-[var(--gold)] mb-3">Quick generate</p>
          <div className="space-y-2">
            {FLASH_STARTERS.map((s) => (
              <div key={s.title} className="flex items-center gap-3 p-3 rounded-md border border-border hover:border-[var(--gold)]/40 transition-colors">
                <span className="text-2xl">{s.emoji}</span>
                <div className="flex-1"><p className="font-medium text-primary text-sm">{s.title}</p>{s.note && <p className="text-xs text-muted-foreground">{s.note}</p>}</div>
                <Button size="sm" variant="ghost" onClick={() => s.title === "DBMS Normalization" ? loadDBMS() : generate(s.title)}>{s.cta}</Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {deck && card && (
        <>
          <div className="[perspective:1200px]">
            <button onClick={() => setFlipped(!flipped)}
              className={cn("relative w-full min-h-[220px] rounded-2xl transition-transform duration-500 [transform-style:preserve-3d]",
                flipped && "[transform:rotateY(180deg)]")}>
              <div className="absolute inset-0 [backface-visibility:hidden] card-elegant p-8 flex flex-col justify-center">
                <p className="text-[10px] uppercase tracking-widest text-[var(--gold)]">{card.category ?? deck.topic}</p>
                <p className="font-serif font-medium text-2xl text-primary mt-3">{card.q}</p>
                <p className="text-xs text-muted-foreground mt-auto pt-4 text-center">Tap to reveal answer</p>
              </div>
              <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] card-elegant p-8 flex flex-col justify-center bg-[var(--linen)]">
                <p className="text-[10px] uppercase tracking-widest text-[var(--gold)]">Answer</p>
                <p className="text-lg text-foreground mt-3">{card.a}</p>
                <p className="text-xs text-muted-foreground mt-auto pt-4 text-center">Tap to flip back</p>
              </div>
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button variant="outline" onClick={() => nav(-1)} disabled={idx === 0}><ChevronLeft className="h-4 w-4 mr-1" />Prev</Button>
            <Button className="bg-[var(--forest)] hover:bg-[var(--forest)]/90" onClick={() => markKnown(true)}><Check className="h-4 w-4 mr-1" />Know this</Button>
            <Button variant="outline" className="text-red-700 border-red-300 hover:bg-red-50" onClick={() => markKnown(false)}>Review again</Button>
            <Button variant="outline" onClick={() => nav(1)} disabled={idx === deck.cards.length - 1}>Next<ChevronRight className="h-4 w-4 ml-1" /></Button>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================
// EXAM PREP
// ============================================================
type ExamEntry = { id: string; subject: string; date: string; status: string };
const EXAM_STARTERS = [
  { emoji: "🗄️", title: "DBMS exam", topics: "Normalization + Transactions + SQL" },
  { emoji: "⚙️", title: "OS exam", topics: "Scheduling + Memory + Deadlocks" },
  { emoji: "🌐", title: "Networks exam", topics: "OSI + TCP/IP + HTTP + DNS" },
  { emoji: "🌳", title: "DSA exam", topics: "Trees + Graphs + Sorting + DP" },
];

function ExamPrepAI() {
  const [topic, setTopic] = useState("");
  const [plan, setPlan] = useState("");
  const [exams, setExams] = useState<ExamEntry[]>(() => readJSON<ExamEntry[]>(EXAMS_KEY, []));
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<ExamEntry>>({ subject: "", date: "", status: "Upcoming" });
  const ask = useServerFn(askTutor);

  const prepM = useMutation({
    mutationFn: async (t: string) => ask({ data: { kind: "exam", prompt: t } }),
    onSuccess: (d) => setPlan(d.text),
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  function prepare(t: string) {
    if (!t.trim()) return toast.error("Enter an exam");
    setTopic(t); setPlan(""); prepM.mutate(t);
  }
  function addExam() {
    if (!draft.subject?.trim() || !draft.date) return toast.error("Subject & date required");
    const next = [...exams, { id: crypto.randomUUID(), subject: draft.subject, date: draft.date, status: draft.status ?? "Upcoming" }];
    setExams(next); writeJSON(EXAMS_KEY, next);
    setScheduleOpen(false); setDraft({ subject: "", date: "", status: "Upcoming" });
    toast.success("Exam scheduled");
  }
  function removeExam(id: string) {
    const next = exams.filter((e) => e.id !== id);
    setExams(next); writeJSON(EXAMS_KEY, next);
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. DBMS end-sem exam" onKeyDown={(e) => e.key === "Enter" && prepare(topic)} className="flex-1" />
          <Button onClick={() => prepare(topic)} disabled={prepM.isPending}>
            {prepM.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
            Prepare →
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {EXAM_STARTERS.map((s) => (
          <button key={s.title} onClick={() => prepare(`${s.title}: ${s.topics}`)} className="text-left card-elegant p-4 hover:shadow-md transition-all hover:-translate-y-0.5">
            <p className="text-2xl">{s.emoji}</p>
            <p className="font-serif text-lg text-primary mt-2">{s.title}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.topics}</p>
          </button>
        ))}
      </div>

      {prepM.isPending && <Card><div className="flex items-center gap-3 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /><span className="text-sm">Building your plan…</span></div></Card>}
      {plan && <Card><LessonRender text={plan} /></Card>}

      <Card>
        <p className="text-[11px] tracking-[0.2em] uppercase text-[var(--gold)] mb-2">Set exam schedule</p>
        <p className="text-sm text-muted-foreground">Tell me your exam dates and I'll build a day-by-day revision plan.</p>
        <div className="mt-3">
          <Button onClick={() => setScheduleOpen(true)}>Set my exam dates →</Button>
        </div>
        {exams.length > 0 && (
          <div className="mt-4 space-y-2">
            {exams.map((e) => (
              <div key={e.id} className="flex items-center gap-3 p-2 rounded-md border border-border">
                <div className="flex-1"><p className="font-medium text-sm text-primary">{e.subject}</p><p className="text-xs text-muted-foreground">{new Date(e.date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p></div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--gold)]/10 text-[var(--gold)] border border-[var(--gold)]/30">{e.status}</span>
                <Button size="icon" variant="ghost" onClick={() => removeExam(e.id)}><X className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-serif">Add exam</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Subject</Label><Input className="mt-1" value={draft.subject ?? ""} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} /></div>
            <div><Label>Date</Label><Input type="date" className="mt-1" value={draft.date ?? ""} onChange={(e) => setDraft({ ...draft, date: e.target.value })} /></div>
            <div><Label>Status</Label>
              <Select value={draft.status ?? "Upcoming"} onValueChange={(v) => setDraft({ ...draft, status: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{["Upcoming", "Preparing", "Done"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={addExam}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// PROJECTS
// ============================================================
const PROJECT_STARTERS = [
  { emoji: "🤖", title: "AI Study Assistant", stack: "Python · LangChain · Claude API · React" },
  { emoji: "📈", title: "ML Price Predictor", stack: "Python · scikit-learn · Flask · PostgreSQL" },
  { emoji: "💬", title: "Real-time Chat App", stack: "Node.js · Socket.io · React · MongoDB" },
  { emoji: "🔍", title: "RAG Document Q&A Bot", stack: "Python · LangChain · pgvector · FastAPI" },
];

function ProjectsAI() {
  const [topic, setTopic] = useState("");
  const [blueprint, setBlueprint] = useState("");
  const ask = useServerFn(askTutor);
  const buildM = useMutation({
    mutationFn: async (t: string) => ask({ data: { kind: "project", prompt: t } }),
    onSuccess: (d) => setBlueprint(d.text),
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  function build(t: string) {
    if (!t.trim()) return toast.error("Enter a project idea");
    setTopic(t); setBlueprint(""); buildM.mutate(t);
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Personal finance dashboard with AI insights" onKeyDown={(e) => e.key === "Enter" && build(topic)} className="flex-1" />
          <Button onClick={() => build(topic)} disabled={buildM.isPending}>
            {buildM.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
            Build →
          </Button>
        </div>
      </Card>

      <div>
        <p className="text-[11px] tracking-[0.2em] uppercase text-[var(--gold)] mb-3">Suggested for AI Engineering goal</p>
        <div className="space-y-2">
          {PROJECT_STARTERS.map((p) => (
            <div key={p.title} className="flex items-center gap-3 p-3 rounded-md border border-border hover:border-[var(--gold)]/40 transition-colors">
              <span className="text-2xl">{p.emoji}</span>
              <div className="flex-1 min-w-0"><p className="font-medium text-primary text-sm">{p.title}</p><p className="text-xs text-muted-foreground truncate">{p.stack}</p></div>
              <Button size="sm" variant="ghost" onClick={() => build(`${p.title} (${p.stack})`)}>Build →</Button>
            </div>
          ))}
        </div>
      </div>

      {buildM.isPending && <Card><div className="flex items-center gap-3 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /><span className="text-sm">Designing your project…</span></div></Card>}
      {blueprint && <Card><LessonRender text={blueprint} /></Card>}
    </div>
  );
}

// ============================================================
// PROGRESS
// ============================================================
const SKILL_ORDER = ["DBMS", "DSA", "OS", "Python", "ML/AI", "System Design"];
const SKILL_INIT: Record<string, number> = { DBMS: 15, DSA: 3, OS: 0, Python: 0, "ML/AI": 0, "System Design": 0 };
const ROADMAP = [
  { title: "CS Fundamentals", state: "done" as const },
  { title: "Python + DSA", state: "current" as const },
  { title: "ML + AI Engineering", state: "future" as const },
  { title: "Portfolio + Projects", state: "future" as const },
  { title: "FAANG Placement", state: "future" as const },
];
const COMPLETED_TOPICS = [{ title: "DBMS Normalization", note: "1NF · 2NF · 3NF · BCNF — fully understood", badge: "Mastered" }];

function ProgressTab() {
  const [stats, setStats] = useState<Stats>(() => getStats());
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(id);
  }, []);
  useEffect(() => {
    const h = () => setStats(getStats());
    window.addEventListener("ascend-stats-change", h);
    return () => window.removeEventListener("ascend-stats-change", h);
  }, []);

  const weakAreas = SKILL_ORDER.filter((s) => (SKILL_INIT[s] ?? 0) < 10).length;
  const overall = Math.round(Object.values(SKILL_INIT).reduce((a, b) => a + b, 0) / SKILL_ORDER.length);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Topics Done" value={stats.topicsDone} tone="primary" />
        <StatCard label="Weak Areas" value={weakAreas} tone="red" />
        <StatCard label="Day Streak" value={`${stats.dayStreak}d`} tone="gold" />
        <StatCard label="Overall %" value={`${overall}%`} tone="forest" />
      </div>

      <Card>
        <p className="text-[11px] tracking-[0.2em] uppercase text-[var(--gold)] mb-4">Subject progress</p>
        <div className="space-y-4">
          {SKILL_ORDER.map((s) => {
            const v = SKILL_INIT[s] ?? 0;
            return (
              <div key={s}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-primary">{s}</span>
                  <span className="text-muted-foreground">{v}%</span>
                </div>
                <div className="h-[5px] bg-[#EAE4D8] rounded-full overflow-hidden">
                  <div className="h-full bg-[#B08D57] rounded-full transition-all duration-700 ease-out" style={{ width: animate ? `${v}%` : "0%" }} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <p className="text-[11px] tracking-[0.2em] uppercase text-[var(--gold)] mb-3">Completed topics</p>
        <div className="space-y-2">
          {COMPLETED_TOPICS.map((t) => (
            <div key={t.title} className="flex items-center gap-3 p-3 rounded-md border border-border">
              <Check className="h-5 w-5 text-[var(--forest)]" />
              <div className="flex-1"><p className="font-medium text-primary text-sm">{t.title}</p><p className="text-xs text-muted-foreground">{t.note}</p></div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--forest)]/10 text-[var(--forest)] border border-[var(--forest)]/20">{t.badge}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <p className="text-[11px] tracking-[0.2em] uppercase text-[var(--gold)] mb-4">Roadmap to AI Engineer</p>
        <div className="relative pl-8">
          <div className="absolute left-[13px] top-3 bottom-3 w-px bg-border" />
          {ROADMAP.map((r) => (
            <div key={r.title} className="relative py-2.5">
              <span className={cn("absolute -left-[26px] top-3.5 h-4 w-4 rounded-full border-2 flex items-center justify-center",
                r.state === "done" && "bg-[var(--forest)] border-[var(--forest)]",
                r.state === "current" && "bg-[var(--gold)] border-[var(--gold)] animate-pulse",
                r.state === "future" && "bg-transparent border-border")}>
                {r.state === "done" && <Check className="h-2.5 w-2.5 text-white" />}
              </span>
              <p className={cn("text-sm",
                r.state === "done" && "text-[var(--forest)] font-medium",
                r.state === "current" && "text-primary font-medium",
                r.state === "future" && "text-muted-foreground")}>
                {r.title}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ============================================================
// CHAT
// ============================================================
type ChatMsg = { role: "user" | "assistant"; content: string };
const CHAT_WELCOME: ChatMsg = { role: "assistant", content: "Hi Adib! 👋 I'm your personal CSE tutor. Ask me anything — concepts, code, career advice, or just say 'teach me DBMS transactions'." };
const CHAT_SUGGESTIONS = ["Explain ACID Properties", "Binary Trees explained", "Python OOP guide", "FAANG prep tips"];

function ChatTab() {
  const [messages, setMessages] = useState<ChatMsg[]>(() => {
    const stored = readJSON<ChatMsg[]>(CHAT_KEY, []);
    return stored.length > 0 ? stored : [CHAT_WELCOME];
  });
  const [input, setInput] = useState("");
  const chat = useServerFn(chatTutor);
  const scrollRef = useRef<HTMLDivElement>(null);

  const sendM = useMutation({
    mutationFn: async (nextMsgs: ChatMsg[]) => chat({ data: { messages: nextMsgs.slice(-20) } }),
    onSuccess: (d) => {
      setMessages((m) => {
        const updated: ChatMsg[] = [...m, { role: "assistant", content: d.text }];
        writeJSON(CHAT_KEY, updated.slice(-50));
        return updated;
      });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sendM.isPending]);

  function send(text: string) {
    if (!text.trim()) return;
    const userMsg: ChatMsg = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    writeJSON(CHAT_KEY, next.slice(-50));
    setInput("");
    sendM.mutate(next.filter((m) => m !== CHAT_WELCOME || messages.length > 1));
  }

  function clearChat() {
    setMessages([CHAT_WELCOME]);
    writeJSON(CHAT_KEY, [CHAT_WELCOME]);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] tracking-[0.2em] uppercase text-[var(--gold)]">Personal Tutor Chat</p>
        <Button size="sm" variant="ghost" onClick={clearChat}><RotateCw className="h-3.5 w-3.5 mr-1" />Clear</Button>
      </div>

      <div ref={scrollRef} className="min-h-[320px] max-h-[520px] overflow-y-auto flex flex-col gap-3 p-4 rounded-lg bg-[var(--ivory)] border border-border">
        {messages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[85%] px-4 py-2.5 text-sm",
              m.role === "user"
                ? "bg-[var(--forest)]/10 text-[#2B2B2B] rounded-2xl rounded-tr-none"
                : "bg-[#EAE4D8] text-foreground rounded-2xl rounded-tl-none")}>
              {m.role === "assistant" ? (
                <article className="prose prose-sm max-w-none prose-headings:font-serif prose-p:my-1 prose-strong:text-primary prose-code:text-primary prose-code:bg-white/50 prose-code:px-1 prose-code:rounded prose-pre:bg-[#2B2B2B] prose-pre:text-[#F5F2EB]">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </article>
              ) : (
                <p className="whitespace-pre-wrap">{m.content}</p>
              )}
            </div>
          </div>
        ))}
        {sendM.isPending && (
          <div className="flex justify-start">
            <div className="bg-[#EAE4D8] rounded-2xl rounded-tl-none px-4 py-2.5 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {CHAT_SUGGESTIONS.map((s) => (
          <button key={s} onClick={() => send(s)}
            className="px-3 py-1 rounded-full text-xs border border-[var(--gold)]/40 text-[var(--gold)] hover:bg-[var(--gold)]/10 transition-colors">
            {s}
          </button>
        ))}
      </div>

      <div className="sticky bottom-0 bg-background pt-2 flex gap-2">
        <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask your tutor anything…"
          onKeyDown={(e) => e.key === "Enter" && !sendM.isPending && send(input)} className="flex-1" />
        <Button onClick={() => send(input)} disabled={sendM.isPending || !input.trim()}>
          <Send className="h-4 w-4 mr-1" />Send
        </Button>
      </div>
    </div>
  );
}
