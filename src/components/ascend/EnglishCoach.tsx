import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Card, SectionHeader, EmptyState, Badge, ProgressBar, Stat, formatDate } from "./ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { coachChat, coachReply } from "@/lib/english-coach.functions";
import { Send, RotateCcw, X, ChevronDown, Play } from "lucide-react";

const SUBS = ["🏠 Home", "📚 Lesson", "🎭 Roleplay", "🎤 Speaking", "💼 Interview", "📊 Progress"] as const;
type Sub = (typeof SUBS)[number];

type ChatMsg = { role: "user" | "assistant"; content: string };

const DAILY_GOALS = [
  "Introduce yourself confidently",
  "Practice professional small talk",
  "Master the job interview opening",
  "Stop translating — think in English",
  "Describe your work and skills fluently",
  "Handle difficult interview questions",
  "Give a 60-second self-pitch",
  "Practice negotiation language",
  "Present your project professionally",
  "Network confidently at an event",
];

const DAILY_TIPS = [
  "🧠 Tip: Don't translate. Think of the feeling, then find the English word directly.",
  "🗣 Tip: Slow down. Native speakers pause too. Pausing sounds confident, not weak.",
  "💡 Tip: Replace 'umm' with a pause + breath. Silence is professional.",
  "🎯 Tip: Start sentences with 'I think...', 'In my opinion...', 'What I mean is...'",
  "⚡ Tip: Practice one sentence 5 times. Repetition builds muscle memory for speech.",
  "🌟 Tip: Record yourself for 30 seconds today. Listen back. One thing to improve.",
  "🤝 Tip: In interviews, always answer with: Point → Example → Impact.",
  "📢 Tip: Volume and pace matter more than accent. Speak clearly, not fast.",
  "🔁 Tip: Learn phrases, not just words. 'Could you clarify?' beats 'Please explain'.",
  "💬 Tip: Every day, think one thought in English. Just one. That's how fluency starts.",
];

const SCENARIOS = [
  { emoji: "💼", title: "Job Interview", desc: "Answer HR and technical questions confidently", level: "Intermediate", prompt: "Let's do a job interview roleplay. You're interviewing for a Software Engineer / AI Engineer role at a top tech company. I'll be the interviewer. Ready? Let's begin. Tell me about yourself." },
  { emoji: "🤝", title: "Networking Event", desc: "Meet professionals and start conversations", level: "Elementary", prompt: "We're at a tech networking event. I'll be someone you just met. Start the conversation and introduce yourself naturally." },
  { emoji: "📊", title: "Project Presentation", desc: "Present your work clearly and confidently", level: "Intermediate", prompt: "Present your latest project to me. I'm a potential employer or investor. You have 60 seconds. Begin." },
  { emoji: "☕", title: "Coffee Chat", desc: "Casual professional conversation", level: "Elementary", prompt: "We're having a coffee chat. I'm a senior engineer at a company you'd love to work at. Have a natural conversation — ask me questions, share about yourself." },
  { emoji: "📞", title: "Client Call", desc: "Handle a professional phone conversation", level: "Upper Intermediate", prompt: "I'm a client calling about a project. Handle this professional call — greet me, understand my needs, and respond professionally." },
  { emoji: "🏢", title: "Team Meeting", desc: "Contribute confidently in a meeting", level: "Intermediate", prompt: "We're in a team meeting. I'll ask for your opinion on a project decision. Share your thoughts clearly and professionally." },
  { emoji: "🎓", title: "College Viva", desc: "Answer professor questions confidently", level: "Elementary", prompt: "I'm your professor. This is a viva exam. I'll ask you questions about your project. Answer confidently and clearly. First question: Tell me about your final year project." },
  { emoji: "🚀", title: "Startup Pitch", desc: "Pitch your idea to an investor", level: "Advanced", prompt: "Pitch me your startup idea in 90 seconds. I'm an investor. Make me want to invest. Begin." },
  { emoji: "🤝", title: "Salary Negotiation", desc: "Negotiate your package confidently", level: "Upper Intermediate", prompt: "You've received a job offer. I'm the HR manager. Negotiate your salary professionally. The offered package is ₹8 LPA. Begin." },
];

const SPEAKING_CHALLENGES = [
  { emoji: "🏙", topic: "Describe your hometown", time: "60 sec", tip: "Include: location, size, what it's known for, your favourite thing about it" },
  { emoji: "🤖", topic: "Talk about AI and its future", time: "90 sec", tip: "Include: what AI is, how it's changing things, your opinion" },
  { emoji: "🎯", topic: "What are your career goals?", time: "60 sec", tip: "Include: short-term, long-term, why this field, what you're doing about it" },
  { emoji: "📱", topic: "Your favourite app and why", time: "60 sec", tip: "Include: what it does, why you use it, how it helps you" },
  { emoji: "💡", topic: "A problem you solved recently", time: "90 sec", tip: "Include: the problem, your approach, the result, what you learned" },
  { emoji: "🌍", topic: "Talk about a person who inspires you", time: "60 sec", tip: "Include: who, why they inspire you, what you've learned from them" },
  { emoji: "🚀", topic: "Describe your dream job", time: "60 sec", tip: "Include: role, company type, what you'd do, why it excites you" },
  { emoji: "📚", topic: "How do you learn new things?", time: "60 sec", tip: "Include: your method, tools you use, example of something you recently learned" },
];

const INTERVIEW_QUESTIONS: Record<string, string[]> = {
  "HR & Behavioral": [
    "Tell me about yourself.",
    "What are your strengths and weaknesses?",
    "Where do you see yourself in 5 years?",
    "Why do you want to work here?",
    "Tell me about a time you failed and what you learned.",
    "How do you handle pressure and deadlines?",
    "Describe a situation where you worked in a team.",
  ],
  "Technical Communication": [
    "Explain your final year project in simple terms.",
    "What is machine learning? Explain to a non-technical person.",
    "Walk me through how you would approach a new coding problem.",
    "Tell me about a technical challenge you overcame.",
    "How do you stay updated with new technology?",
  ],
  "AI Engineering Specific": [
    "Why do you want to become an AI Engineer?",
    "What AI tools and frameworks have you worked with?",
    "Explain the difference between ML and AI in simple terms.",
    "What is your biggest AI project so far?",
    "Where do you see AI in 5 years and how does that excite you?",
  ],
  "Leadership & Soft Skills": [
    "Have you ever led a team or project? How did it go?",
    "How do you communicate technical concepts to non-technical people?",
    "Tell me about a time you had to persuade someone.",
    "How do you handle feedback and criticism?",
  ],
};

const SKILLS = [
  "Grammar", "Vocabulary", "Fluency", "Confidence",
  "Communication", "Professional English",
  "Interview Skills", "Presentation Skills",
  "Public Speaking", "Thinking in English",
  "Pronunciation", "Naturalness",
];

const LEVEL_NAMES = ["Beginner", "Elementary", "Intermediate", "Upper Intermediate", "Advanced", "Professional"];

type Stats = {
  level: number;
  scores: Record<string, number>;
  totalSessions: number;
  roleplays: number;
  speakingChallenges: number;
  interviewQuestions: number;
  streak: number;
  lastDate: string;
  wordsLearned: number;
};

const DEFAULT_STATS: Stats = {
  level: 2,
  scores: Object.fromEntries(SKILLS.map((s) => [s, 3])),
  totalSessions: 0,
  roleplays: 0,
  speakingChallenges: 0,
  interviewQuestions: 0,
  streak: 0,
  lastDate: "",
  wordsLearned: 0,
};

const ACHIEVEMENTS = [
  { id: "first", icon: "🎯", title: "First Step", desc: "Complete your first lesson", unlock: (s: Stats) => s.totalSessions >= 1 },
  { id: "week", icon: "🔥", title: "Week Warrior", desc: "7 sessions completed", unlock: (s: Stats) => s.totalSessions >= 7 },
  { id: "roleplay5", icon: "🎭", title: "Actor", desc: "Complete 5 roleplays", unlock: (s: Stats) => s.roleplays >= 5 },
  { id: "speaking10", icon: "🎤", title: "Speaker", desc: "10 speaking challenges done", unlock: (s: Stats) => s.speakingChallenges >= 10 },
  { id: "interview", icon: "💼", title: "Interview Ready", desc: "Practice 20 interview questions", unlock: (s: Stats) => s.interviewQuestions >= 20 },
  { id: "streak14", icon: "⚡", title: "Consistent", desc: "14 day learning streak", unlock: (s: Stats) => s.streak >= 14 },
  { id: "level3", icon: "📈", title: "Intermediate", desc: "Reach Intermediate level", unlock: (s: Stats) => s.level >= 3 },
  { id: "level5", icon: "🏆", title: "Advanced Speaker", desc: "Reach Advanced level", unlock: (s: Stats) => s.level >= 5 },
];

/* ---------- storage helpers ---------- */
function loadLS<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}
function saveLS<T>(key: string, val: T) { try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* noop */ } }

function loadStats(): Stats {
  const s = loadLS<Partial<Stats>>("ascend_english_stats", {});
  return { ...DEFAULT_STATS, ...s, scores: { ...DEFAULT_STATS.scores, ...(s.scores ?? {}) } };
}
function bumpStats(patch: (s: Stats) => Stats) {
  const next = patch(loadStats());
  saveLS("ascend_english_stats", next);
  return next;
}

function getOrInitDay(): number {
  try {
    const stored = JSON.parse(localStorage.getItem("ascend_english_day") ?? "{}") as { day?: number; lastDate?: string };
    const today = new Date().toDateString();
    if (stored.lastDate === today && stored.day) return stored.day;
    const newDay = (stored.day ?? 0) + 1;
    localStorage.setItem("ascend_english_day", JSON.stringify({ day: newDay, lastDate: today }));
    return newDay;
  } catch { return 1; }
}

function levelBadgeVariant(level: string) {
  if (level === "Elementary") return "success" as const;
  if (level === "Intermediate") return "warning" as const;
  if (level === "Upper Intermediate") return "gold" as const;
  return "danger" as const;
}

/* ---------- coach message rendering ---------- */
function CoachText({ text }: { text: string }) {
  return (
    <div className="space-y-1 text-sm leading-relaxed whitespace-pre-wrap">
      {text.split("\n").map((line, i) => {
        const t = line.trim();
        if (!t) return <div key={i} className="h-1" />;
        if (t.startsWith("❌")) return <p key={i} className="text-[var(--destructive)] font-medium">{t}</p>;
        if (t.startsWith("✅")) return <p key={i} className="text-[var(--forest)] font-medium">{t}</p>;
        if (t.startsWith("⭐")) return <p key={i} className="text-[var(--gold)] font-medium">{t}</p>;
        if (t.startsWith("💡")) return <p key={i} className="text-muted-foreground italic">{t}</p>;
        if (t.startsWith("🎤")) return <p key={i} className="text-[var(--forest)] font-semibold">{t}</p>;
        return <p key={i} className="text-foreground">{t}</p>;
      })}
    </div>
  );
}

/* ---------- reusable chat panel ---------- */
function ChatPanel({
  messages,
  loading,
  onSend,
  chips,
  hint = "💡 Speak your answer aloud first, then type exactly what you said",
  placeholder = "Type your answer or response...",
}: {
  messages: ChatMsg[];
  loading: boolean;
  onSend: (text: string) => void;
  chips?: string[];
  hint?: string;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  function submit(text?: string) {
    const val = (text ?? input).trim();
    if (!val || loading) return;
    setInput("");
    onSend(val);
  }

  const showChips = !loading && messages.length > 0 && messages[messages.length - 1].role === "assistant";

  return (
    <div className="space-y-3">
      <div ref={scrollRef} className="rounded-xl bg-[var(--card)] ring-1 ring-border/60 p-4 min-h-[320px] md:min-h-[420px] max-h-[50vh] md:max-h-[60vh] overflow-y-auto space-y-3">
        {messages.length === 0 && !loading && (
          <p className="text-sm text-muted-foreground italic">Your coach will begin shortly…</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] px-4 py-2.5",
                m.role === "assistant"
                  ? "bg-[var(--secondary)] rounded-2xl rounded-tl-none"
                  : "bg-[var(--gold)]/20 text-foreground rounded-2xl rounded-br-none",
              )}
            >
              {m.role === "assistant" ? <CoachText text={m.content} /> : <p className="text-sm whitespace-pre-wrap">{m.content}</p>}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-[var(--secondary)] rounded-2xl rounded-tl-none px-4 py-2.5">
              <p className="text-sm italic text-muted-foreground">Coach is thinking…</p>
            </div>
          </div>
        )}
      </div>

      {showChips && chips && chips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {chips.map((c) => (
            <button
              key={c}
              onClick={() => submit(c)}
              className="px-3 py-1 rounded-full text-xs border border-border text-muted-foreground hover:text-primary hover:bg-secondary transition-colors"
            >
              {c}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2 items-end">
        <Textarea
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
          }}
          placeholder={placeholder}
          className="flex-1 resize-none"
        />
        <Button onClick={() => submit()} disabled={loading} className="bg-[var(--forest)] text-[var(--gold)] hover:bg-[var(--forest)]/90">
          <Send className="h-4 w-4 mr-1" /> Send
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

/* ================= main ================= */
export default function EnglishCoach() {
  const [sub, setSub] = useState<Sub>("🏠 Home");
  const [day, setDay] = useState(1);
  const [stats, setStats] = useState<Stats>(DEFAULT_STATS);
  const [autoStart, setAutoStart] = useState(false);

  useEffect(() => {
    setDay(getOrInitDay());
    setStats(loadStats());
  }, []);

  const goal = DAILY_GOALS[(Math.max(1, day) - 1) % DAILY_GOALS.length];
  const tip = DAILY_TIPS[(Math.max(1, day) - 1) % DAILY_TIPS.length];

  const refreshStats = useCallback(() => setStats(loadStats()), []);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] tracking-[0.2em] uppercase text-[var(--gold)]">Communication · Fluency · Confidence</p>
        <h1 className="font-serif text-3xl md:text-4xl text-primary mt-2">English Coach</h1>
        <p className="text-sm text-muted-foreground mt-2">Your personal tutor — speak more, hesitate less, sound natural.</p>
      </div>

      <div className="border-b border-border overflow-x-auto">
        <nav className="flex gap-1 min-w-max">
          {SUBS.map((s) => (
            <button
              key={s}
              onClick={() => setSub(s)}
              className={cn(
                "px-3 py-2 text-sm whitespace-nowrap transition-colors border-b-2 -mb-px",
                sub === s ? "border-[var(--gold)] text-primary font-medium" : "border-transparent text-muted-foreground hover:text-primary",
              )}
            >
              {s}
            </button>
          ))}
        </nav>
      </div>

      {sub === "🏠 Home" && (
        <HomeTab
          day={day}
          goal={goal}
          tip={tip}
          stats={stats}
          onStart={() => { setAutoStart(true); setSub("📚 Lesson"); }}
          onGo={setSub}
        />
      )}
      {sub === "📚 Lesson" && (
        <LessonTab day={day} goal={goal} autoStart={autoStart} onAutoStarted={() => setAutoStart(false)} onStats={refreshStats} setDay={setDay} />
      )}
      {sub === "🎭 Roleplay" && <RoleplayTab onStats={refreshStats} />}
      {sub === "🎤 Speaking" && <SpeakingTab onStats={refreshStats} />}
      {sub === "💼 Interview" && <InterviewTab onStats={refreshStats} />}
      {sub === "📊 Progress" && <ProgressTab stats={stats} onStats={refreshStats} />}
    </div>
  );
}

/* ---------- HOME ---------- */
function HomeTab({ day, goal, tip, stats, onStart, onGo }: {
  day: number; goal: string; tip: string; stats: Stats; onStart: () => void; onGo: (s: Sub) => void;
}) {
  const quick: { emoji: string; title: string; desc: string; target: Sub }[] = [
    { emoji: "🎭", title: "Roleplay", desc: "Practice real scenarios", target: "🎭 Roleplay" },
    { emoji: "🎤", title: "Speaking", desc: "60-second challenges", target: "🎤 Speaking" },
    { emoji: "💼", title: "Interview", desc: "Mock interviews", target: "💼 Interview" },
    { emoji: "📊", title: "Progress", desc: "Track improvement", target: "📊 Progress" },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-[var(--forest)] p-6 md:p-8 shadow-[var(--shadow-md)]">
        <p className="text-[11px] tracking-[0.2em] uppercase text-[var(--gold)]">Start Today's Session</p>
        <p className="font-serif text-3xl md:text-4xl text-[#F5F2EB] mt-2">Day {day}</p>
        <p className="text-sm text-[#F5F2EB]/80 mt-2">🎯 Today's goal: {goal}</p>
        <Button onClick={onStart} className="mt-5 bg-[var(--gold)] text-[#2B2B2B] hover:bg-[var(--gold)]/90">
          <Play className="h-4 w-4 mr-1" /> Start Session →
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {quick.map((q) => (
          <Card key={q.title} interactive onClick={() => onGo(q.target)}>
            <p className="text-2xl">{q.emoji}</p>
            <p className="font-serif text-lg text-primary mt-2">{q.title}</p>
            <p className="text-sm text-muted-foreground">{q.desc}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat kicker="Sessions" value={stats.totalSessions} />
        <Stat kicker="Level" value={LEVEL_NAMES[Math.min(5, Math.max(0, stats.level - 1))]} tone="gold" />
        <Stat kicker="Last session" value={stats.lastDate ? formatDate(stats.lastDate) : "—"} tone="forest" />
      </div>

      <Card className="border-l-4 border-l-[var(--gold)]">
        <p className="text-[11px] tracking-[0.2em] uppercase text-[var(--gold)]">Today's Tip</p>
        <p className="text-sm text-foreground mt-2">{tip}</p>
      </Card>
    </div>
  );
}

/* ---------- LESSON ---------- */
function LessonTab({ day, goal, autoStart, onAutoStarted, onStats, setDay }: {
  day: number; goal: string; autoStart: boolean; onAutoStarted: () => void; onStats: () => void; setDay: (d: number) => void;
}) {
  const chat = useServerFn(coachChat);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    setMessages(loadLS<ChatMsg[]>("ascend_english_chat", []));
    setReady(true);
  }, []);

  const runOpening = useCallback(async () => {
    if (started.current) return;
    started.current = true;
    const opening: ChatMsg = {
      role: "user",
      content: `START_SESSION: Day ${day}. Goal: ${goal}. Begin the lesson with the standard welcome, today's goal, and the first warm-up question only. Keep it short.`,
    };
    setLoading(true);
    try {
      const res = await chat({ data: { messages: [opening], sessionDay: day } });
      const next: ChatMsg[] = [{ role: "assistant", content: res.text }];
      setMessages(next);
      saveLS("ascend_english_chat", next);
      const today = new Date().toISOString();
      bumpStats((s) => ({ ...s, totalSessions: s.totalSessions + 1, streak: s.streak + 1, lastDate: today }));
      const sessions = loadLS<{ date: string; day: number; goal: string }[]>("ascend_english_sessions", []);
      saveLS("ascend_english_sessions", [{ date: today, day, goal }, ...sessions].slice(0, 50));
      onStats();
    } catch {
      toast.error("Coach unavailable. Please try again.");
      started.current = false;
    } finally {
      setLoading(false);
    }
  }, [chat, day, goal, onStats]);

  useEffect(() => {
    if (!ready) return;
    if (messages.length === 0 || autoStart) {
      if (autoStart) onAutoStarted();
      if (messages.length === 0) void runOpening();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  async function send(text: string) {
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    saveLS("ascend_english_chat", next);
    setLoading(true);
    try {
      const res = await chat({ data: { messages: next.slice(-40), sessionDay: day } });
      const final = [...next, { role: "assistant" as const, content: res.text }];
      setMessages(final);
      saveLS("ascend_english_chat", final.slice(-80));
    } catch {
      toast.error("Coach unavailable. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function newSession() {
    if (!window.confirm("Start a fresh session? This clears the current lesson chat.")) return;
    const nextDay = day + 1;
    saveLS("ascend_english_day", { day: nextDay, lastDate: new Date().toDateString() });
    setDay(nextDay);
    setMessages([]);
    saveLS("ascend_english_chat", []);
    started.current = false;
    void runOpening();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--card)] ring-1 ring-border/60 px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="font-serif text-lg text-primary">Day {day}</span>
          <span className="text-muted-foreground">🎯 {goal}</span>
          <Badge variant="gold">Level: Elementary</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={newSession}>
          <RotateCcw className="h-3.5 w-3.5 mr-1" /> New Session
        </Button>
      </div>

      <ChatPanel
        messages={messages}
        loading={loading}
        onSend={send}
        chips={["I don't know", "Can you help me?", "Give me an example", "Let's continue"]}
      />
    </div>
  );
}

/* ---------- ROLEPLAY ---------- */
function RoleplayTab({ onStats }: { onStats: () => void }) {
  const chat = useServerFn(coachChat);
  const [active, setActive] = useState<(typeof SCENARIOS)[number] | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(false);

  const storeKey = active ? `ascend_english_roleplay_${active.title}` : "";

  function start(sc: (typeof SCENARIOS)[number]) {
    setActive(sc);
    const existing = loadLS<ChatMsg[]>(`ascend_english_roleplay_${sc.title}`, []);
    if (existing.length > 0) { setMessages(existing); return; }
    const first: ChatMsg[] = [{ role: "assistant", content: sc.prompt }];
    setMessages(first);
    saveLS(`ascend_english_roleplay_${sc.title}`, first);
    bumpStats((s) => ({ ...s, roleplays: s.roleplays + 1 }));
    onStats();
  }

  async function send(text: string) {
    if (!active) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    saveLS(storeKey, next);
    setLoading(true);
    try {
      const res = await chat({
        data: {
          messages: next.slice(-40),
          mode: `You are now in ROLEPLAY MODE for: ${active.title}. Stay in character. One question or response at a time. After the roleplay ends (when the user says 'end' or after 10 exchanges), give a detailed debrief: what they did well, mistakes, better phrases to use.`,
        },
      });
      const final = [...next, { role: "assistant" as const, content: res.text }];
      setMessages(final);
      saveLS(storeKey, final.slice(-80));
    } catch {
      toast.error("Coach unavailable. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader kicker="Practice" title="Roleplay Scenarios" subtitle="Practice real conversations before they happen in real life." />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {SCENARIOS.map((sc) => (
          <Card key={sc.title} className="flex flex-col">
            <p className="text-2xl">{sc.emoji}</p>
            <p className="font-serif text-lg text-primary mt-2">{sc.title}</p>
            <p className="text-sm text-muted-foreground mt-1 flex-1">{sc.desc}</p>
            <div className="mt-3"><Badge variant={levelBadgeVariant(sc.level)}>{sc.level}</Badge></div>
            <Button className="mt-4 w-full bg-[var(--forest)] text-[var(--gold)] hover:bg-[var(--forest)]/90" onClick={() => start(sc)}>
              Start Roleplay →
            </Button>
          </Card>
        ))}
      </div>

      {active && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="font-serif text-xl text-primary truncate">{active.emoji} {active.title}</h3>
              <Badge variant={levelBadgeVariant(active.level)}>{active.level}</Badge>
            </div>
            <Button variant="ghost" size="sm" onClick={() => { setActive(null); setMessages([]); }}>
              <X className="h-4 w-4 mr-1" /> End Roleplay
            </Button>
          </div>
          <ChatPanel messages={messages} loading={loading} onSend={send} chips={["Can you repeat that?", "end"]} placeholder="Your reply..." />
        </div>
      )}
    </div>
  );
}

/* ---------- SPEAKING ---------- */
type SpeakingEntry = { topic: string; response: string; feedback: string; date: string };

function SpeakingTab({ onStats }: { onStats: () => void }) {
  const reply = useServerFn(coachReply);
  const [active, setActive] = useState<{ topic: string; time: string; tip: string } | null>(null);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);
  const [custom, setCustom] = useState("");
  const [history, setHistory] = useState<SpeakingEntry[]>([]);

  useEffect(() => { setHistory(loadLS<SpeakingEntry[]>("ascend_english_speaking", [])); }, []);

  async function submit() {
    if (!active || !answer.trim()) return;
    setLoading(true);
    setFeedback("");
    try {
      const res = await reply({
        data: { kind: "speaking", prompt: `Speaking challenge topic: "${active.topic}" (${active.time}).\n\nWhat the student said:\n${answer.trim()}` },
      });
      setFeedback(res.text);
      const entry: SpeakingEntry = { topic: active.topic, response: answer.trim(), feedback: res.text, date: new Date().toISOString() };
      const next = [entry, ...loadLS<SpeakingEntry[]>("ascend_english_speaking", [])].slice(0, 50);
      saveLS("ascend_english_speaking", next);
      setHistory(next);
      bumpStats((s) => ({ ...s, speakingChallenges: s.speakingChallenges + 1 }));
      onStats();
    } catch {
      toast.error("Coach unavailable. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader kicker="Fluency" title="Speaking Challenges" subtitle="Speak for 60–90 seconds. Build fluency, reduce hesitation." />

      {active ? (
        <Card className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-serif text-2xl text-primary">{active.topic}</h3>
              <p className="text-sm text-muted-foreground italic mt-1">{active.tip}</p>
            </div>
            <Badge variant="gold">{active.time}</Badge>
          </div>
          <p className="text-sm font-semibold text-[var(--forest)]">🎤 SPEAK FIRST. Speak aloud for {active.time}. Then type exactly what you said.</p>
          <Textarea rows={5} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Type what you said..." />
          <div className="flex flex-wrap gap-2">
            <Button onClick={submit} disabled={loading || !answer.trim()} className="bg-[var(--forest)] text-[var(--gold)] hover:bg-[var(--forest)]/90">
              {loading ? "Coach is thinking…" : "Submit for Feedback →"}
            </Button>
            <Button variant="outline" onClick={() => { setActive(null); setAnswer(""); setFeedback(""); }}>Back to challenges</Button>
          </div>
          {feedback && (
            <div className="rounded-xl bg-[var(--secondary)] p-4">
              <CoachText text={feedback} />
            </div>
          )}
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {SPEAKING_CHALLENGES.map((c) => (
              <Card key={c.topic} className="flex flex-col">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-2xl">{c.emoji}</p>
                  <Badge variant="gold">{c.time}</Badge>
                </div>
                <p className="font-serif text-lg text-primary mt-2">{c.topic}</p>
                <p className="text-sm text-muted-foreground italic mt-1 flex-1">{c.tip}</p>
                <Button className="mt-4 w-full bg-[var(--forest)] text-[var(--gold)] hover:bg-[var(--forest)]/90" onClick={() => { setActive(c); setAnswer(""); setFeedback(""); }}>
                  🎤 Start Challenge →
                </Button>
              </Card>
            ))}
          </div>

          <Card>
            <p className="text-[11px] tracking-[0.2em] uppercase text-[var(--gold)]">Custom Challenge</p>
            <div className="flex flex-col sm:flex-row gap-2 mt-3">
              <Input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Type your own topic..." />
              <Button
                disabled={!custom.trim()}
                onClick={() => { setActive({ topic: custom.trim(), time: "60 sec", tip: "Structure it: opening, two points, closing." }); setCustom(""); setAnswer(""); setFeedback(""); }}
              >
                Create Challenge →
              </Button>
            </div>
          </Card>

          {history.length === 0 ? (
            <EmptyState title="No challenges completed yet" hint="Pick a topic above, speak aloud, then type what you said for instant feedback." />
          ) : (
            <div className="space-y-2">
              <h3 className="font-serif text-xl text-primary">Recent attempts</h3>
              {history.slice(0, 5).map((h, i) => (
                <Card key={i}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-primary">{h.topic}</p>
                    <span className="text-xs text-muted-foreground">{formatDate(h.date)}</span>
                  </div>
                  <div className="mt-2"><CoachText text={h.feedback} /></div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ---------- INTERVIEW ---------- */
type InterviewEntry = { question: string; answer: string; feedback: string; date: string };

function InterviewTab({ onStats }: { onStats: () => void }) {
  const reply = useServerFn(coachReply);
  const chat = useServerFn(coachChat);
  const [open, setOpen] = useState<string | null>("HR & Behavioral");
  const [question, setQuestion] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);
  const [mock, setMock] = useState(false);
  const [mockMsgs, setMockMsgs] = useState<ChatMsg[]>([]);
  const [mockLoading, setMockLoading] = useState(false);

  const allQuestions = useMemo(() => Object.values(INTERVIEW_QUESTIONS).flat(), []);

  async function submit() {
    if (!question || !answer.trim()) return;
    setLoading(true);
    setFeedback("");
    try {
      const res = await reply({ data: { kind: "interview", prompt: `Interview question: "${question}"\n\nStudent's answer:\n${answer.trim()}` } });
      setFeedback(res.text);
      const entry: InterviewEntry = { question, answer: answer.trim(), feedback: res.text, date: new Date().toISOString() };
      saveLS("ascend_english_interview", [entry, ...loadLS<InterviewEntry[]>("ascend_english_interview", [])].slice(0, 50));
      bumpStats((s) => ({ ...s, interviewQuestions: s.interviewQuestions + 1 }));
      onStats();
    } catch {
      toast.error("Coach unavailable. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function nextQuestion() {
    if (!question) return;
    const idx = allQuestions.indexOf(question);
    setQuestion(allQuestions[(idx + 1) % allQuestions.length]);
    setAnswer("");
    setFeedback("");
  }

  const MOCK_MODE = "You are now in MOCK INTERVIEW MODE. Ask exactly 5 interview questions, one at a time, from different categories (HR, technical communication, AI engineering, leadership). Never ask the next question before the student answers. After the 5th answer, give a comprehensive feedback report with scores out of 10 for structure, content, language and overall.";

  async function startMock() {
    setMock(true);
    setMockMsgs([]);
    setMockLoading(true);
    try {
      const res = await chat({ data: { messages: [{ role: "user", content: "Start the mock interview. Ask question 1 only." }], mode: MOCK_MODE } });
      setMockMsgs([{ role: "assistant", content: res.text }]);
    } catch {
      toast.error("Coach unavailable. Please try again.");
    } finally {
      setMockLoading(false);
    }
  }

  async function sendMock(text: string) {
    const next = [...mockMsgs, { role: "user" as const, content: text }];
    setMockMsgs(next);
    setMockLoading(true);
    try {
      const res = await chat({ data: { messages: next.slice(-40), mode: MOCK_MODE } });
      setMockMsgs([...next, { role: "assistant", content: res.text }]);
      bumpStats((s) => ({ ...s, interviewQuestions: s.interviewQuestions + 1 }));
      onStats();
    } catch {
      toast.error("Coach unavailable. Please try again.");
    } finally {
      setMockLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        kicker="Preparation"
        title="Interview Training"
        subtitle="Get interview-ready with mock questions and AI feedback."
        right={<Button onClick={startMock} className="bg-[var(--forest)] text-[var(--gold)] hover:bg-[var(--forest)]/90">▶ Start Full Mock Interview →</Button>}
      />

      {mock && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-xl text-primary">Mock Interview</h3>
            <Button variant="ghost" size="sm" onClick={() => { setMock(false); setMockMsgs([]); }}><X className="h-4 w-4 mr-1" /> End</Button>
          </div>
          <ChatPanel messages={mockMsgs} loading={mockLoading} onSend={sendMock} placeholder="Your answer..." />
        </div>
      )}

      {question ? (
        <Card className="space-y-4">
          <h3 className="font-serif text-2xl text-primary">{question}</h3>
          <p className="text-sm font-semibold text-[var(--forest)]">🎤 Answer aloud first, then type your response:</p>
          <Textarea rows={5} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Type your answer..." />
          <div className="flex flex-wrap gap-2">
            <Button onClick={submit} disabled={loading || !answer.trim()} className="bg-[var(--forest)] text-[var(--gold)] hover:bg-[var(--forest)]/90">
              {loading ? "Coach is thinking…" : "Submit Answer →"}
            </Button>
            <Button variant="outline" onClick={() => { setAnswer(""); setFeedback(""); }}>Try Again</Button>
            <Button variant="outline" onClick={nextQuestion}>Next Question</Button>
            <Button variant="ghost" onClick={() => { setQuestion(null); setAnswer(""); setFeedback(""); }}>Back</Button>
          </div>
          {feedback && <div className="rounded-xl bg-[var(--secondary)] p-4"><CoachText text={feedback} /></div>}
        </Card>
      ) : (
        <div className="space-y-3">
          {Object.entries(INTERVIEW_QUESTIONS).map(([group, qs]) => (
            <div key={group} className="rounded-xl bg-[var(--card)] ring-1 ring-border/60 overflow-hidden">
              <button
                onClick={() => setOpen(open === group ? null : group)}
                className="w-full flex items-center justify-between px-5 py-4 text-left"
              >
                <span className="font-serif text-lg text-primary">{group}</span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  {qs.length} questions
                  <ChevronDown className={cn("h-4 w-4 transition-transform", open === group && "rotate-180")} />
                </span>
              </button>
              {open === group && (
                <div className="px-5 pb-5 space-y-2">
                  {qs.map((q) => (
                    <div key={q} className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3">
                      <p className="text-sm text-foreground">{q}</p>
                      <Button size="sm" variant="outline" onClick={() => { setQuestion(q); setAnswer(""); setFeedback(""); }}>Practice →</Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- PROGRESS ---------- */
type VocabEntry = { word: string; meaning: string; example: string; dateAdded: string };

function ProgressTab({ stats, onStats }: { stats: Stats; onStats: () => void }) {
  const [editing, setEditing] = useState(false);
  const [scores, setScores] = useState<Record<string, number>>(stats.scores);
  const [sessions, setSessions] = useState<{ date: string; day: number; goal: string }[]>([]);
  const [vocab, setVocab] = useState<VocabEntry[]>([]);
  const [form, setForm] = useState({ word: "", meaning: "", example: "" });

  useEffect(() => {
    setSessions(loadLS("ascend_english_sessions", []));
    setVocab(loadLS("ascend_english_vocab", []));
  }, []);
  useEffect(() => { setScores(stats.scores); }, [stats.scores]);

  const levelIdx = Math.min(6, Math.max(1, stats.level));
  const levelName = LEVEL_NAMES[levelIdx - 1];
  const nextName = LEVEL_NAMES[Math.min(5, levelIdx)];
  const avg = SKILLS.reduce((a, s) => a + (scores[s] ?? 3), 0) / SKILLS.length;
  const progressPct = Math.round(Math.min(100, (avg / 10) * 100));

  function saveScores() {
    bumpStats((s) => ({ ...s, scores }));
    setEditing(false);
    onStats();
    toast.success("Scores updated");
  }

  function addWord() {
    if (!form.word.trim()) return;
    const entry: VocabEntry = { ...form, word: form.word.trim(), dateAdded: new Date().toISOString() };
    const next = [entry, ...vocab];
    setVocab(next);
    saveLS("ascend_english_vocab", next);
    bumpStats((s) => ({ ...s, wordsLearned: next.length }));
    onStats();
    setForm({ word: "", meaning: "", example: "" });
  }

  return (
    <div className="space-y-6">
      <SectionHeader kicker="Growth" title="Your Progress" subtitle="Track your fluency, confidence and consistency." />

      <Card>
        <p className="text-[11px] tracking-[0.2em] uppercase text-muted-foreground">Current Level</p>
        <p className="font-serif text-3xl text-primary mt-1">{levelName} <span className="text-lg text-muted-foreground">(Level {levelIdx})</span></p>
        <div className="mt-4"><ProgressBar value={progressPct} label={`Progress to ${nextName}`} showPercent /></div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat kicker="Total Sessions" value={stats.totalSessions} />
        <Stat kicker="Days Streak" value={stats.streak} tone="gold" />
        <Stat kicker="Words Learned" value={vocab.length} tone="forest" />
        <Stat kicker="Roleplays Done" value={stats.roleplays} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-serif text-xl text-primary">Skill Scores</h3>
          {editing ? (
            <div className="flex gap-2">
              <Button size="sm" onClick={saveScores}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => { setScores(stats.scores); setEditing(false); }}>Cancel</Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Edit Scores</Button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SKILLS.map((s) => (
            <Card key={s}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-primary">{s}</p>
                {editing ? (
                  <Input
                    type="number" min={0} max={10}
                    className="h-8 w-16"
                    value={scores[s] ?? 3}
                    onChange={(e) => setScores({ ...scores, [s]: Math.max(0, Math.min(10, Number(e.target.value) || 0)) })}
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">{scores[s] ?? 3}/10</span>
                )}
              </div>
              <ProgressBar value={(scores[s] ?? 3) * 10} />
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-serif text-xl text-primary mb-3">Session History</h3>
        {sessions.length === 0 ? (
          <EmptyState title="No sessions yet" hint="Start your first lesson to begin tracking your journey." />
        ) : (
          <div className="space-y-2">
            {sessions.slice(0, 10).map((s, i) => (
              <div key={i} className="flex items-center justify-between gap-3 rounded-lg bg-[var(--card)] ring-1 ring-border/60 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm text-primary font-medium">Day {s.day}</p>
                  <p className="text-xs text-muted-foreground truncate">{s.goal}</p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{formatDate(s.date)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="font-serif text-xl text-primary mb-3">Achievements</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {ACHIEVEMENTS.map((a) => {
            const unlocked = a.unlock(stats);
            return (
              <Card key={a.id} className={cn(!unlocked && "opacity-60 grayscale")}>
                <p className="text-2xl">{a.icon}</p>
                <p className="font-serif text-base text-primary mt-1">{a.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{a.desc}</p>
                {!unlocked && <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-2">🔒 Locked</p>}
              </Card>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="font-serif text-xl text-primary mb-3">Vocabulary Bank <span className="text-sm text-muted-foreground">({vocab.length})</span></h3>
        <Card className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Input placeholder="Word or phrase" value={form.word} onChange={(e) => setForm({ ...form, word: e.target.value })} />
            <Input placeholder="Meaning" value={form.meaning} onChange={(e) => setForm({ ...form, meaning: e.target.value })} />
            <Input placeholder="Example sentence" value={form.example} onChange={(e) => setForm({ ...form, example: e.target.value })} />
          </div>
          <Button size="sm" onClick={addWord} disabled={!form.word.trim()}>+ Add Word</Button>
        </Card>
        {vocab.length === 0 ? (
          <div className="mt-4"><EmptyState title="No words saved yet" hint="Add new words and phrases you learn during coaching sessions." /></div>
        ) : (
          <div className="mt-4 space-y-2">
            {vocab.slice(0, 10).map((v, i) => (
              <Card key={i}>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-primary">{v.word}</p>
                  <span className="text-xs text-muted-foreground">{formatDate(v.dateAdded)}</span>
                </div>
                {v.meaning && <p className="text-sm text-muted-foreground mt-1">{v.meaning}</p>}
                {v.example && <p className="text-sm italic text-muted-foreground mt-1">“{v.example}”</p>}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
