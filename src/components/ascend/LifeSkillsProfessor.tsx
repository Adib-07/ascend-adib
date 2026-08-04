import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Card, SectionHeader, EmptyState, AIThinking, AIError, AI_LOADING_MESSAGES } from "./ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { askProfessor, chatMentor } from "@/lib/life-skills.functions";
import { ExternalLink, Send, Sparkles, BookOpen, RotateCcw } from "lucide-react";

const SUBS = ["Home", "Learn", "Book Professor", "Business Professor", "Mentor", "Resources", "Memory", "Progress"] as const;
type Sub = (typeof SUBS)[number];

const CATEGORIES = [
  "Communication", "Negotiation", "Decision Making", "Critical Thinking",
  "Focus & Deep Work", "Money Management", "Business & Entrepreneurship", "Leadership",
  "Emotional Intelligence", "Psychology", "Sales & Marketing", "Productivity",
  "Networking", "Habit Building", "Time Management", "Career Growth",
  "Learning How to Learn", "Problem Solving", "Systems Thinking", "Influence & Persuasion",
] as const;

const HERO_CARDS: { emoji: string; name: string; tagline: string; category: string }[] = [
  { emoji: "🧠", name: "Decision Making", tagline: "Think clearer, choose better", category: "Decision Making" },
  { emoji: "💬", name: "Communication", tagline: "Speak so people listen", category: "Communication" },
  { emoji: "💰", name: "Money & Finance", tagline: "Build wealth from first principles", category: "Money Management" },
  { emoji: "🚀", name: "Entrepreneurship", tagline: "From idea to business", category: "Business & Entrepreneurship" },
  { emoji: "🎯", name: "Focus & Deep Work", tagline: "Do more of what matters", category: "Focus & Deep Work" },
  { emoji: "❤️", name: "Emotional Intelligence", tagline: "Master yourself first", category: "Emotional Intelligence" },
  { emoji: "🤝", name: "Negotiation", tagline: "Get what you deserve", category: "Negotiation" },
  { emoji: "📈", name: "Leadership", tagline: "Inspire people to follow", category: "Leadership" },
];

const DAILY_WISDOM = [
  { quote: "The first principle is that you must not fool yourself — and you are the easiest person to fool.", author: "Richard Feynman" },
  { quote: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin" },
  { quote: "The measure of intelligence is the ability to change.", author: "Albert Einstein" },
  { quote: "It is not enough to be busy. The question is: what are we busy about?", author: "Henry David Thoreau" },
  { quote: "You do not rise to the level of your goals. You fall to the level of your systems.", author: "James Clear" },
  { quote: "The most important thing is to try and inspire people so that they can be great in whatever they want to do.", author: "Kobe Bryant" },
  { quote: "Seek wealth, not money or status. Wealth is having assets that earn while you sleep.", author: "Naval Ravikant" },
  { quote: "All courses of action are risky, so prudence is not in avoiding danger but calculating risk.", author: "Machiavelli" },
  { quote: "We cannot solve our problems with the same thinking we used when we created them.", author: "Albert Einstein" },
  { quote: "The impediment to action advances action. What stands in the way becomes the way.", author: "Marcus Aurelius" },
];

const QUICK_PROMPTS = [
  "How do I make better decisions?",
  "Explain compound interest",
  "How to influence people ethically?",
  "What is Systems Thinking?",
  "How do I build better habits?",
  "Explain the 80/20 principle",
  "How to negotiate salary?",
  "What is Emotional Intelligence?",
];

const CURATED_BOOKS = [
  { emoji: "📗", title: "Atomic Habits", author: "James Clear", tag: "The science of building any habit" },
  { emoji: "📘", title: "Thinking Fast and Slow", author: "Daniel Kahneman", tag: "How your mind actually works" },
  { emoji: "📙", title: "The Psychology of Money", author: "Morgan Housel", tag: "Why smart people make dumb money decisions" },
  { emoji: "📕", title: "Zero to One", author: "Peter Thiel", tag: "The only business book that matters for startups" },
  { emoji: "📗", title: "Deep Work", author: "Cal Newport", tag: "The superpower of the 21st century" },
  { emoji: "📘", title: "Influence", author: "Robert Cialdini", tag: "The 6 principles that move people to act" },
  { emoji: "📙", title: "The 48 Laws of Power", author: "Robert Greene", tag: "How power actually works in the world" },
  { emoji: "📕", title: "Thinking in Systems", author: "Donella Meadows", tag: "See the world in a completely new way" },
  { emoji: "📗", title: "Essentialism", author: "Greg McKeown", tag: "The disciplined pursuit of less" },
];

const BUSINESS_TERMS = [
  ["EBITDA", "Earnings before interest, tax, depreciation"], ["CAC", "Customer Acquisition Cost"],
  ["LTV", "Lifetime Value"], ["ROI", "Return on Investment"],
  ["Burn Rate", "How fast a startup spends cash"], ["Runway", "Months of cash left"],
  ["Equity", "Ownership stake in a company"], ["Moat", "Sustainable competitive advantage"],
  ["TAM/SAM/SOM", "Market sizing framework"], ["Cash Flow", "Money in vs money out"],
  ["Valuation", "What a company is worth"], ["MVP", "Minimum Viable Product"],
  ["Product-Market Fit", "When users can't live without you"], ["Unit Economics", "Profit per customer"],
  ["Churn", "Rate customers leave"], ["ARR", "Annual Recurring Revenue"],
];

const CONCEPT_MAP: { group: string; items: string[] }[] = [
  { group: "Finance & Accounting", items: ["EBITDA", "Revenue", "Profit", "Cash Flow", "Burn Rate", "Runway", "Valuation"] },
  { group: "Growth & Marketing", items: ["CAC", "LTV", "Churn", "ARR", "NPS", "GMV", "Conversion Rate"] },
  { group: "Strategy", items: ["Moat", "TAM", "MVP", "PMF", "Unit Economics", "Competitive Advantage"] },
  { group: "Fundraising", items: ["Equity", "Valuation", "Term Sheet", "Cap Table", "Series A/B/C", "VC", "Angel"] },
];

const MENTOR_STARTERS = [
  "I'm struggling to stay consistent with studying",
  "Should I start freelancing now or wait?",
  "How do I get better at saying no?",
  "I feel overwhelmed — where do I start?",
  "How do I build a personal brand as a student?",
  "What skill should I focus on next?",
];

const MENTOR_INTRO = "Hello. I'm here to help you think more clearly, make better decisions, and become the person you want to be. I won't tell you what you want to hear — I'll tell you what you need to hear, as kindly as possible. What's on your mind? You can share a decision you're struggling with, a goal you're working toward, or simply ask 'what should I focus on right now?'";

type ResourceType = "TED Talk" | "YouTube" | "Book" | "Course" | "Podcast" | "Lecture";
type Resource = { category: string; type: ResourceType; title: string; creator: string; why: string; url: string; duration: string };

const CURATED_RESOURCES: Resource[] = [
  { category: "Communication", type: "TED Talk", title: "How to speak so that people want to listen", creator: "Julian Treasure", why: "Best 10 minutes on vocal delivery and structure", url: "https://www.youtube.com/watch?v=eIho2S0ZahI", duration: "10 min" },
  { category: "Communication", type: "Book", title: "Crucial Conversations", creator: "Patterson et al.", why: "The definitive guide to high-stakes conversations", url: "", duration: "6 hr read" },
  { category: "Decision Making", type: "YouTube", title: "How to Make Good Decisions", creator: "Veritasium", why: "Mental models explained with physics-level clarity", url: "https://www.youtube.com/watch?v=VfRkPPOyxqM", duration: "18 min" },
  { category: "Decision Making", type: "Book", title: "Thinking Fast and Slow", creator: "Daniel Kahneman", why: "The complete manual for your own biases", url: "", duration: "12 hr read" },
  { category: "Focus & Deep Work", type: "YouTube", title: "Deep Work — How to focus in the age of distraction", creator: "Cal Newport", why: "The author explains his own system in 15 minutes", url: "https://www.youtube.com/watch?v=y3Umo_jd5AA", duration: "15 min" },
  { category: "Focus & Deep Work", type: "Course", title: "Learning How to Learn", creator: "Barbara Oakley / Coursera", why: "Most enrolled course in Coursera history — for good reason", url: "https://www.coursera.org/learn/learning-how-to-learn", duration: "4 weeks" },
  { category: "Money Management", type: "YouTube", title: "The ULTIMATE Money Management Guide", creator: "Graham Stephan", why: "Practical, non-preachy, clear — especially for beginners", url: "https://www.youtube.com/watch?v=J9bCS-S-8G4", duration: "22 min" },
  { category: "Money Management", type: "Book", title: "The Psychology of Money", creator: "Morgan Housel", why: "Explains money behaviour better than any textbook", url: "", duration: "5 hr read" },
  { category: "Entrepreneurship", type: "Lecture", title: "How to Start a Startup", creator: "Sam Altman / Y Combinator", why: "Literal curriculum used to train YC founders", url: "https://www.youtube.com/playlist?list=PL5q_lef6zVkaTY_cT1k7qFNF2TidHCe-1", duration: "20 lectures" },
  { category: "Entrepreneurship", type: "Podcast", title: "The Tim Ferriss Show", creator: "Tim Ferriss", why: "World-class performers share their actual systems and routines", url: "https://tim.blog/podcast/", duration: "Ongoing" },
  { category: "Habit Building", type: "YouTube", title: "The Science of Habits", creator: "Andrew Huberman", why: "Neuroscience of habit formation — practical and evidence-based", url: "https://www.youtube.com/watch?v=Wcs2PFz5q6g", duration: "25 min" },
  { category: "Habit Building", type: "Book", title: "Atomic Habits", creator: "James Clear", why: "The clearest system for building habits that actually stick", url: "", duration: "5 hr read" },
  { category: "Leadership", type: "TED Talk", title: "How Great Leaders Inspire Action", creator: "Simon Sinek", why: "The most watched TED Talk on leadership — the Golden Circle framework", url: "https://www.youtube.com/watch?v=qp0HIF3SfI4", duration: "18 min" },
  { category: "Psychology", type: "YouTube", title: "The Psychology of Human Behaviour", creator: "Robert Sapolsky / Stanford", why: "Full Stanford university course, free on YouTube — life changing", url: "https://www.youtube.com/playlist?list=PL848F2368C90DDC3D", duration: "25 lectures" },
  { category: "Productivity", type: "YouTube", title: "My Productivity System — Full Breakdown", creator: "Ali Abdaal", why: "Practical, student-friendly, evidence-backed system", url: "https://www.youtube.com/watch?v=A2sS00egAzg", duration: "20 min" },
];

const ROADMAP = [
  { week: "Week 1", title: "Foundation of Everything", topics: ["Decision Making", "Mental Models"], seed: "Teach me mental models and decision making from first principles" },
  { week: "Week 2", title: "Multipliers", topics: ["Communication", "Emotional Intelligence"], seed: "How do I master communication and emotional intelligence?" },
  { week: "Week 3", title: "Build Wealth", topics: ["Money Management", "Entrepreneurship"], seed: "Teach me money management and entrepreneurship from scratch" },
  { week: "Week 4", title: "The System", topics: ["Focus", "Habit Building"], seed: "How do I build focus and habits that last?" },
];

// ---- storage helpers ----
type HistoryEntry = { topic: string; category?: string; timestamp: number };
type NoteEntry = { id: string; topic: string; summary: string; timestamp: number };
type Flashcard = { id: string; q: string; a: string; deck: string; known: boolean };
type BookEntry = { title: string; author: string; timestamp: number };
type ChatMsg = { role: "user" | "assistant"; content: string };

function loadLS<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}
function saveLS<T>(key: string, val: T) { try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* noop */ } }

// ---- response parser ----
type Section = { title: string; body: string };
function parseResponse(text: string): Section[] {
  if (!text) return [];
  const parts = text.split(/\n##\s+/);
  const first = parts.shift() ?? "";
  const sections: Section[] = [];
  const firstTrim = first.replace(/^##\s+/, "").trim();
  if (firstTrim.includes("\n")) {
    const [t, ...rest] = firstTrim.split("\n");
    sections.push({ title: t.trim(), body: rest.join("\n").trim() });
  } else if (firstTrim) {
    sections.push({ title: "", body: firstTrim });
  }
  for (const p of parts) {
    const [t, ...rest] = p.split("\n");
    sections.push({ title: t.trim(), body: rest.join("\n").trim() });
  }
  return sections.filter((s) => s.title || s.body);
}

function sectionStyle(title: string): "core" | "why" | "deep" | "examples" | "mistakes" | "action" | "model" | "remember" | "test" | "default" {
  const t = title.toLowerCase();
  if (t.includes("core idea") || t.includes("simple definition") || t.includes("what this book")) return "core";
  if (t.includes("why")) return "why";
  if (t.includes("deep explanation") || t.includes("core ideas")) return "deep";
  if (t.includes("example")) return "examples";
  if (t.includes("mistake") || t.includes("skip")) return "mistakes";
  if (t.includes("action") || t.includes("actionable") || t.includes("next step")) return "action";
  if (t.includes("model") || t.includes("framework") || t.includes("palace") || t.includes("spaced")) return "model";
  if (t.includes("remember") || t.includes("memory")) return "remember";
  if (t.includes("test") || t.includes("quiz") || t.includes("question")) return "test";
  return "default";
}

// ---- component ----
export default function LifeSkillsProfessor() {
  const [sub, setSub] = useState<Sub>("Home");
  const [seedTopic, setSeedTopic] = useState<{ topic: string; category?: string; autosubmit?: boolean } | null>(null);

  function goLearn(topic: string, category?: string, autosubmit = true) {
    setSeedTopic({ topic, category, autosubmit });
    setSub("Learn");
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] tracking-[0.2em] uppercase text-[var(--gold)]">Personal Growth · Business · Mindset</p>
        <h1 className="font-serif text-3xl md:text-4xl text-primary mt-2">Life Skills Professor</h1>
        <p className="text-sm text-muted-foreground mt-2">Learn the skills they never taught you in school — from the world's greatest minds, explained simply.</p>
      </div>

      <div className="border-b border-border">
        <nav className="flex overflow-x-auto gap-1 pb-1 scrollbar-hide -mx-4 px-4">
          {SUBS.map((s) => (
            <button
              key={s}
              onClick={() => setSub(s)}
              className={cn(
                "px-3 py-2 text-sm whitespace-nowrap flex-shrink-0 transition-colors border-b-2 -mb-px",
                sub === s ? "border-[var(--gold)] text-primary font-medium" : "border-transparent text-muted-foreground hover:text-primary",
              )}
            >
              {s}
            </button>
          ))}
        </nav>
      </div>

      <div key={sub} className="animate-in fade-in duration-300">
        {sub === "Home" && <HomeTab onOpen={goLearn} onGoto={setSub} />}
        {sub === "Learn" && <LearnTab seed={seedTopic} onConsumed={() => setSeedTopic(null)} />}
        {sub === "Book Professor" && <BookTab />}
        {sub === "Business Professor" && <BusinessTab />}
        {sub === "Mentor" && <MentorTab />}
        {sub === "Resources" && <ResourcesTab />}
        {sub === "Memory" && <MemoryTab />}
        {sub === "Progress" && <ProgressTab onOpen={goLearn} />}
      </div>
    </div>
  );
}

// ---------- HOME ----------
function HomeTab({ onOpen, onGoto }: { onOpen: (topic: string, cat?: string) => void; onGoto: (s: Sub) => void }) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  useEffect(() => { setHistory(loadLS<HistoryEntry[]>("ascend_lifeskills_history", [])); }, []);
  const wisdom = DAILY_WISDOM[new Date().getDate() % DAILY_WISDOM.length];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-serif text-2xl text-primary mb-4">What do you want to master today?</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {HERO_CARDS.map((c) => (
            <Card key={c.name} interactive onClick={() => onOpen(`Teach me ${c.name} from scratch`, c.category)} className="!p-4">
              <div className="text-2xl mb-2">{c.emoji}</div>
              <div className="font-serif text-lg text-primary">{c.name}</div>
              <div className="text-xs text-muted-foreground mt-1">{c.tagline}</div>
            </Card>
          ))}
        </div>
      </div>

      <Card className="!bg-[var(--forest)] !text-[var(--ivory,#F5F2EB)] border-none">
        <p className="text-[10px] uppercase tracking-widest text-[var(--gold)]">Start Here</p>
        <h3 className="font-serif text-2xl mt-2 text-[#F5F2EB]">The #1 Skill That Multiplies All Others</h3>
        <p className="text-sm mt-2 text-[#F5F2EB]/80">Learning How to Learn — Why most people study wrong and what to do instead.</p>
        <Button
          onClick={() => onOpen("Teach me Learning How to Learn — the complete science of studying effectively", "Learning How to Learn")}
          className="mt-4 bg-[var(--gold)] hover:bg-[var(--gold)]/90 text-[var(--forest)]"
        >
          Start Lesson →
        </Button>
      </Card>

      <div>
        <h3 className="font-serif text-xl text-primary mb-3">Recently explored</h3>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Your learning history will appear here.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {history.slice(0, 5).map((h, i) => (
              <button
                key={i}
                onClick={() => onOpen(h.topic, h.category)}
                className="px-3 py-1.5 rounded-full bg-[var(--linen)] hover:bg-[var(--gold)]/20 text-sm text-primary transition-colors"
              >
                {h.topic.length > 60 ? h.topic.slice(0, 60) + "…" : h.topic}
              </button>
            ))}
          </div>
        )}
      </div>

      <Card className="!bg-[var(--forest)] !text-[#F5F2EB] border-none text-center">
        <p className="text-[10px] uppercase tracking-widest text-[var(--gold)]">Today's Wisdom</p>
        <p className="font-serif italic text-xl md:text-2xl mt-3 text-[#F5F2EB]">"{wisdom.quote}"</p>
        <p className="text-sm mt-3 text-[var(--gold)]">— {wisdom.author}</p>
      </Card>

      <div className="flex flex-wrap gap-2 pt-2">
        <Button variant="outline" size="sm" onClick={() => onGoto("Book Professor")}><BookOpen className="h-3.5 w-3.5 mr-1" /> Book Professor</Button>
        <Button variant="outline" size="sm" onClick={() => onGoto("Mentor")}><Sparkles className="h-3.5 w-3.5 mr-1" /> Talk to Mentor</Button>
        <Button variant="outline" size="sm" onClick={() => onGoto("Resources")}>Browse Resources</Button>
      </div>
    </div>
  );
}

// ---------- RESPONSE RENDERER ----------
function ResponseView({ text, storageKeyForChecks }: { text: string; storageKeyForChecks?: string }) {
  const sections = useMemo(() => parseResponse(text), [text]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [answerText, setAnswerText] = useState("");
  const [feedback, setFeedback] = useState<string>("");
  const [checking, setChecking] = useState(false);
  const askFn = useServerFn(askProfessor);

  useEffect(() => {
    if (storageKeyForChecks) setChecked(loadLS(storageKeyForChecks, {}));
  }, [storageKeyForChecks]);

  function toggleCheck(k: string) {
    const next = { ...checked, [k]: !checked[k] };
    setChecked(next);
    if (storageKeyForChecks) saveLS(storageKeyForChecks, next);
  }

  async function checkAnswer(question: string) {
    if (!answerText.trim()) return;
    setChecking(true); setFeedback("");
    try {
      const res = await askFn({ data: { kind: "answerCheck", prompt: `Question: ${question}\n\nMy answer: ${answerText}` } });
      setFeedback(res.text);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setChecking(false); }
  }

  if (!sections.length) return null;

  return (
    <div className="space-y-4">
      {sections.map((s, i) => {
        const kind = sectionStyle(s.title);
        const body = s.body;
        if (kind === "core") {
          return (
            <div key={i} className="rounded-xl bg-[var(--card)] p-5 ring-1 ring-[var(--gold)]/40">
              <p className="text-[10px] uppercase tracking-widest text-[var(--gold)]">{s.title || "Core Idea"}</p>
              <p className="font-serif text-xl text-[var(--forest)] mt-2 leading-snug">{body}</p>
            </div>
          );
        }
        if (kind === "deep") {
          return (
            <div key={i} className="rounded-xl bg-[var(--card)] p-5 ring-1 ring-border/60 border-l-4 border-l-[var(--gold)]">
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">{s.title}</p>
              <div className="text-[15px] leading-7 text-foreground whitespace-pre-wrap">{body}</div>
            </div>
          );
        }
        if (kind === "examples") {
          const items = body.split(/\n(?=\d+\.|\-|\*)/).map((x) => x.replace(/^(\d+\.|\-|\*)\s*/, "").trim()).filter(Boolean);
          return (
            <div key={i}>
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">{s.title}</p>
              <div className="space-y-2">
                {(items.length ? items : [body]).map((it, j) => (
                  <div key={j} className="rounded-lg bg-[var(--linen)] p-3 text-sm text-foreground whitespace-pre-wrap">{it}</div>
                ))}
              </div>
            </div>
          );
        }
        if (kind === "mistakes") {
          const items = body.split(/\n(?=\d+\.|\-|\*)/).map((x) => x.replace(/^(\d+\.|\-|\*)\s*/, "").trim()).filter(Boolean);
          return (
            <div key={i}>
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">{s.title}</p>
              <ul className="space-y-1.5">
                {(items.length ? items : [body]).map((it, j) => (
                  <li key={j} className="text-sm text-foreground bg-red-50 dark:bg-red-950/20 border-l-2 border-red-400 px-3 py-2 rounded">⚠️ {it}</li>
                ))}
              </ul>
            </div>
          );
        }
        if (kind === "action") {
          const items = body.split(/\n(?=\d+\.|\-|\*)/).map((x) => x.replace(/^(\d+\.|\-|\*)\s*/, "").trim()).filter(Boolean);
          return (
            <div key={i}>
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">{s.title}</p>
              <ul className="space-y-2">
                {(items.length ? items : [body]).map((it, j) => {
                  const k = `${i}-${j}`;
                  return (
                    <li key={j} className="flex items-start gap-2">
                      <button
                        onClick={() => toggleCheck(k)}
                        className={cn(
                          "mt-0.5 h-4 w-4 rounded border-2 border-[var(--gold)] shrink-0 transition-colors",
                          checked[k] && "bg-[var(--gold)]",
                        )}
                        aria-label="Toggle done"
                      />
                      <span className={cn("text-sm", checked[k] && "line-through opacity-60")}>{it}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        }
        if (kind === "model") {
          return (
            <div key={i} className="rounded-xl bg-[var(--forest)] text-[#F5F2EB] p-5">
              <p className="text-[10px] uppercase tracking-widest text-[var(--gold)]">{s.title}</p>
              <div className="text-sm mt-2 whitespace-pre-wrap leading-7">{body}</div>
            </div>
          );
        }
        if (kind === "remember") {
          return (
            <div key={i} className="text-center py-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{s.title}</p>
              <p className="font-serif italic text-xl md:text-2xl text-[var(--gold)] mt-2">{body}</p>
            </div>
          );
        }
        if (kind === "test") {
          return (
            <div key={i} className="rounded-xl bg-[var(--card)] p-5 ring-1 ring-border/60">
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">{s.title}</p>
              <p className="text-[15px] text-foreground whitespace-pre-wrap">{body}</p>
              <div className="mt-3 space-y-2">
                <Textarea rows={2} placeholder="Your answer..." value={answerText} onChange={(e) => setAnswerText(e.target.value)} />
                <Button size="sm" onClick={() => checkAnswer(body)} disabled={checking || !answerText.trim()}>
                  {checking ? "Checking..." : "Check my answer"}
                </Button>
                {feedback && <div className="text-sm bg-[var(--linen)] p-3 rounded whitespace-pre-wrap mt-2">{feedback}</div>}
              </div>
            </div>
          );
        }
        return (
          <div key={i}>
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">{s.title}</p>
            <div className="text-[15px] leading-7 text-foreground whitespace-pre-wrap">{body}</div>
          </div>
        );
      })}
    </div>
  );
}

function LoadingSkeleton({ label }: { label?: string }) {
  return (
    <AIThinking
      messages={label ? [label, ...AI_LOADING_MESSAGES] : ["The Professor is thinking...", ...AI_LOADING_MESSAGES]}
    />
  );
}

// ---------- LEARN ----------
function LearnTab({ seed, onConsumed }: { seed: { topic: string; category?: string; autosubmit?: boolean } | null; onConsumed: () => void }) {
  const [category, setCategory] = useState<string>("");
  const [prompt, setPrompt] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAsk, setLastAsk] = useState<{ topic: string; cat: string } | null>(null);
  const revealRef = useRef<number | null>(null);
  const askFn = useServerFn(askProfessor);

  useEffect(() => () => { if (revealRef.current) window.clearInterval(revealRef.current); }, []);

  function revealProgressively(full: string) {
    if (revealRef.current) window.clearInterval(revealRef.current);
    const words = full.split(" ");
    let i = 0;
    setText("");
    revealRef.current = window.setInterval(() => {
      if (i >= words.length) {
        if (revealRef.current) window.clearInterval(revealRef.current);
        revealRef.current = null;
        return;
      }
      setText((prev) => prev + (i > 0 ? " " : "") + words[i]);
      i++;
    }, 15);
  }

  const submit = async (topicOverride?: string, catOverride?: string) => {
    const topic = (topicOverride ?? prompt).trim();
    if (!topic) return;
    const cat = catOverride ?? category;
    setLoading(true); setText(""); setError(null); setLastAsk({ topic, cat });
    try {
      const full = cat ? `[Category: ${cat}] ${topic}` : topic;
      const res = await askFn({ data: { kind: "learn", prompt: full } });
      revealProgressively(res.text);
      const hist = loadLS<HistoryEntry[]>("ascend_lifeskills_history", []);
      const entry: HistoryEntry = { topic, category: cat || undefined, timestamp: Date.now() };
      saveLS("ascend_lifeskills_history", [entry, ...hist.filter((h) => h.topic !== topic)].slice(0, 50));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      toast.error("AI is unavailable right now. Please try again.");
    }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (!seed) return;
    setPrompt(seed.topic);
    if (seed.category) setCategory(seed.category);
    if (seed.autosubmit) void submit(seed.topic, seed.category);
    onConsumed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  async function saveToNotes() {
    if (!text) return;
    const notes = loadLS<NoteEntry[]>("ascend_lifeskills_notes", []);
    const entry: NoteEntry = { id: crypto.randomUUID(), topic: prompt, summary: text.slice(0, 400), timestamp: Date.now() };
    saveLS("ascend_lifeskills_notes", [entry, ...notes].slice(0, 100));
    toast.success("Saved to notes");
  }

  async function generateFlashcards() {
    if (!prompt.trim()) return;
    try {
      const res = await askFn({ data: { kind: "flashcards", prompt } });
      const cleaned = res.text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleaned) as { q: string; a: string }[];
      const deck = prompt.slice(0, 60);
      const cards: Flashcard[] = parsed.slice(0, 5).map((c) => ({
        id: crypto.randomUUID(), q: c.q, a: c.a, deck, known: false,
      }));
      const existing = loadLS<Flashcard[]>("ascend_lifeskills_flashcards", []);
      saveLS("ascend_lifeskills_flashcards", [...cards, ...existing]);
      toast.success(`Generated ${cards.length} flashcards`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to generate"); }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Category</p>
          <div className="flex gap-1.5 overflow-x-auto pb-2">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(category === c ? "" : c)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors border",
                  category === c
                    ? "bg-[var(--forest)] text-[#F5F2EB] border-[var(--forest)]"
                    : "bg-[var(--card)] text-muted-foreground border-border hover:text-primary",
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <Textarea
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask anything... 'Explain negotiation from scratch', 'What is a mental model?', 'How do I stop procrastinating?', 'Teach me stoicism'"
        />
        <Button onClick={() => submit()} disabled={loading || !prompt.trim()} className="w-full bg-[var(--forest)] hover:bg-[var(--forest)]/90 text-[var(--gold)] font-serif text-base">
          {loading ? "Teaching..." : "Teach Me →"}
        </Button>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {QUICK_PROMPTS.map((q) => (
            <button
              key={q}
              onClick={() => { setPrompt(q); void submit(q); }}
              className="px-3 py-1.5 rounded-full bg-[var(--linen)] hover:bg-[var(--gold)]/20 text-xs whitespace-nowrap text-primary transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      <div>
        {loading && <LoadingSkeleton />}
        {!loading && error && (
          <AIError message={error} onRetry={() => { if (lastAsk) void submit(lastAsk.topic, lastAsk.cat); }} />
        )}
        {!loading && !error && !text && <EmptyState title="Ready when you are." hint="Ask a question — the Professor will teach it with clarity, examples, and action steps." />}
        {!loading && !error && text && (
          <div className="space-y-4">
            <ResponseView text={text} storageKeyForChecks={`ascend_lifeskills_check_${prompt.slice(0, 40)}`} />
            <div className="flex flex-wrap gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={saveToNotes}>Save to Notes</Button>
              <Button variant="outline" size="sm" onClick={generateFlashcards}>Generate Flashcards</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- BOOK PROFESSOR ----------
function BookTab() {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [mode, setMode] = useState("Complete Summary");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<BookEntry[]>([]);
  const askFn = useServerFn(askProfessor);

  useEffect(() => { setHistory(loadLS<BookEntry[]>("ascend_book_history", [])); }, []);

  async function submit(t?: string, a?: string) {
    const tt = (t ?? title).trim();
    const aa = (a ?? author).trim();
    if (!tt) return;
    setLoading(true); setText("");
    try {
      const res = await askFn({ data: { kind: "book", prompt: `Book: "${tt}"${aa ? ` by ${aa}` : ""}. Mode: ${mode}.` } });
      setText(res.text);
      const next: BookEntry = { title: tt, author: aa, timestamp: Date.now() };
      const upd = [next, ...history.filter((h) => h.title !== tt)].slice(0, 30);
      setHistory(upd); saveLS("ascend_book_history", upd);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  }

  function saveNotes() {
    if (!text) return;
    const notes = loadLS<NoteEntry[]>("ascend_lifeskills_notes", []);
    saveLS("ascend_lifeskills_notes", [{ id: crypto.randomUUID(), topic: `📖 ${title}`, summary: text.slice(0, 400), timestamp: Date.now() }, ...notes].slice(0, 100));
    toast.success("Saved to notes");
  }

  return (
    <div className="space-y-6">
      <SectionHeader kicker="The Library" title="Book Professor" subtitle="Extract the complete wisdom from any book — without wasting 6 hours reading." />

      <Card>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground">Book title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Thinking Fast and Slow" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground">Author</label>
            <Input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="e.g. Daniel Kahneman" />
          </div>
        </div>
        <div className="mt-3">
          <label className="text-xs uppercase tracking-widest text-muted-foreground">What do you want?</label>
          <select value={mode} onChange={(e) => setMode(e.target.value)} className="mt-1 w-full h-10 rounded-md border border-border bg-[var(--card)] px-3 text-sm">
            {["Complete Summary", "Key Concepts Only", "Actionable Lessons", "Mental Models", "Test My Understanding"].map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
        <Button onClick={() => submit()} disabled={loading || !title.trim()} className="mt-4 w-full bg-[var(--forest)] text-[var(--gold)] hover:bg-[var(--forest)]/90 font-serif">
          {loading ? "Extracting..." : "Extract Wisdom →"}
        </Button>
      </Card>

      <div>
        <h3 className="font-serif text-lg text-primary mb-3">Start with these</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {CURATED_BOOKS.map((b) => (
            <Card key={b.title} interactive onClick={() => { setTitle(b.title); setAuthor(b.author); void submit(b.title, b.author); }} className="!p-4">
              <div className="text-2xl mb-1">{b.emoji}</div>
              <div className="font-serif text-base text-primary">{b.title}</div>
              <div className="text-xs text-muted-foreground">{b.author}</div>
              <div className="text-xs italic mt-2 text-foreground/70">{b.tag}</div>
            </Card>
          ))}
        </div>
      </div>

      {history.length > 0 && (
        <div>
          <h3 className="font-serif text-lg text-primary mb-2">Previously explored</h3>
          <div className="flex flex-wrap gap-2">
            {history.map((h, i) => (
              <button key={i} onClick={() => { setTitle(h.title); setAuthor(h.author); void submit(h.title, h.author); }} className="px-3 py-1.5 rounded-full bg-[var(--linen)] hover:bg-[var(--gold)]/20 text-xs text-primary">
                {h.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading && <LoadingSkeleton label="The Librarian is distilling..." />}
      {text && !loading && (
        <div className="space-y-4">
          <ResponseView text={text} />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={saveNotes}>Save Notes</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- BUSINESS ----------
function BusinessTab() {
  const [term, setTerm] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const askFn = useServerFn(askProfessor);

  async function submit(t?: string) {
    const q = (t ?? term).trim();
    if (!q) return;
    setLoading(true); setText("");
    try {
      const res = await askFn({ data: { kind: "business", prompt: q } });
      setText(res.text);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  }

  return (
    <div className="space-y-6">
      <SectionHeader kicker="The Boardroom" title="Business Professor" subtitle="Every business concept explained — from EBITDA to Product-Market Fit." />

      <Card>
        <div className="flex gap-2">
          <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Enter any business term, concept, or question" onKeyDown={(e) => { if (e.key === "Enter") void submit(); }} />
          <Button onClick={() => submit()} disabled={loading || !term.trim()} className="bg-[var(--forest)] text-[var(--gold)]">Explain →</Button>
        </div>
      </Card>

      <div>
        <h3 className="font-serif text-lg text-primary mb-3">Common terms</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {BUSINESS_TERMS.map(([t, d]) => (
            <button
              key={t}
              onClick={() => { setTerm(t); void submit(t); }}
              className="text-left rounded-lg bg-[var(--card)] p-3 ring-1 ring-border/60 hover:border-l-4 hover:border-l-[var(--forest)] hover:shadow-[var(--shadow-md)] transition-all"
            >
              <div className="font-semibold text-sm text-primary">{t}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{d}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-serif text-lg text-primary mb-3">Business Concept Map</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {CONCEPT_MAP.map((g) => (
            <Card key={g.group} className="!p-4">
              <p className="text-[10px] uppercase tracking-widest text-[var(--gold)] mb-2">{g.group}</p>
              <div className="flex flex-wrap gap-1.5">
                {g.items.map((it) => (
                  <button key={it} onClick={() => { setTerm(it); void submit(it); }} className="px-2.5 py-1 rounded-full bg-[var(--linen)] hover:bg-[var(--gold)]/20 text-xs text-primary">
                    {it}
                  </button>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>

      {loading && <LoadingSkeleton />}
      {text && !loading && <ResponseView text={text} />}
    </div>
  );
}

// ---------- MENTOR ----------
function MentorTab() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatFn = useServerFn(chatMentor);

  useEffect(() => {
    const stored = loadLS<ChatMsg[]>("ascend_mentor_chat", []);
    if (stored.length === 0) {
      const intro: ChatMsg[] = [{ role: "assistant", content: MENTOR_INTRO }];
      setMessages(intro); saveLS("ascend_mentor_chat", intro);
    } else {
      setMessages(stored);
    }
  }, []);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, loading]);

  async function send(textOverride?: string) {
    const content = (textOverride ?? input).trim();
    if (!content || loading) return;
    const next: ChatMsg[] = [...messages, { role: "user", content }];
    setMessages(next); setInput(""); setLoading(true);
    try {
      const res = await chatFn({ data: { messages: next.slice(-30) } });
      const final: ChatMsg[] = [...next, { role: "assistant", content: res.text }];
      setMessages(final); saveLS("ascend_mentor_chat", final.slice(-100));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
      setMessages(next);
    } finally { setLoading(false); }
  }

  function reset() {
    const intro: ChatMsg[] = [{ role: "assistant", content: MENTOR_INTRO }];
    setMessages(intro); saveLS("ascend_mentor_chat", intro);
  }

  const showStarters = messages.length <= 1;

  return (
    <div className="space-y-4">
      <SectionHeader
        kicker="Advisor"
        title="Personal Mentor"
        subtitle="Your honest advisor — no flattery, only truth and clarity."
        right={<Button variant="ghost" size="sm" onClick={reset}><RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset</Button>}
      />

      <div ref={scrollRef} className="rounded-xl bg-[var(--card)] ring-1 ring-border/60 p-4 h-[500px] overflow-y-auto space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn(
              "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap",
              m.role === "user"
                ? "bg-[var(--gold)] text-[var(--forest)] rounded-br-sm"
                : "bg-[var(--linen)] text-foreground rounded-bl-sm",
            )}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-[var(--linen)] rounded-2xl px-4 py-2.5 text-sm italic text-muted-foreground">Mentor is thinking...</div>
          </div>
        )}
      </div>

      {showStarters && (
        <div className="flex flex-wrap gap-2">
          {MENTOR_STARTERS.map((s) => (
            <button key={s} onClick={() => setInput(s)} className="px-3 py-1.5 rounded-full bg-[var(--linen)] hover:bg-[var(--gold)]/20 text-xs text-primary">{s}</button>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Textarea
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
          placeholder="Share what's on your mind..."
        />
        <Button onClick={() => void send()} disabled={loading || !input.trim()} className="bg-[var(--forest)] text-[var(--gold)]"><Send className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

// ---------- RESOURCES ----------
function ResourcesTab() {
  const [mode, setMode] = useState<"browse" | "ask">("browse");
  const [filter, setFilter] = useState<string>("All");
  const [q, setQ] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const askFn = useServerFn(askProfessor);

  const categories = ["All", ...Array.from(new Set(CURATED_RESOURCES.map((r) => r.category)))];
  const filtered = filter === "All" ? CURATED_RESOURCES : CURATED_RESOURCES.filter((r) => r.category === filter);

  const typeColor: Record<ResourceType, string> = {
    "TED Talk": "bg-red-500/15 text-red-700",
    "YouTube": "bg-red-500/15 text-red-700",
    "Book": "bg-[var(--forest)]/15 text-[var(--forest)]",
    "Course": "bg-[var(--gold)]/20 text-[var(--gold)]",
    "Podcast": "bg-purple-500/15 text-purple-700",
    "Lecture": "bg-blue-500/15 text-blue-700",
  };

  async function ask() {
    if (!q.trim()) return;
    setLoading(true); setText("");
    try {
      const res = await askFn({ data: { kind: "resources", prompt: q } });
      setText(res.text);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  }

  return (
    <div className="space-y-6">
      <SectionHeader kicker="Curated" title="Curated Resources" subtitle="The best videos, talks, books, and courses — curated by your Professor." />

      <div className="inline-flex rounded-full border border-border bg-secondary p-1">
        <button onClick={() => setMode("browse")} className={cn("px-4 py-1.5 text-xs rounded-full font-medium", mode === "browse" ? "bg-[var(--forest)] text-[var(--gold)]" : "text-muted-foreground")}>Browse Curated</button>
        <button onClick={() => setMode("ask")} className={cn("px-4 py-1.5 text-xs rounded-full font-medium", mode === "ask" ? "bg-[var(--forest)] text-[var(--gold)]" : "text-muted-foreground")}>Ask Professor</button>
      </div>

      {mode === "browse" && (
        <>
          <div className="flex gap-1.5 overflow-x-auto pb-2">
            {categories.map((c) => (
              <button key={c} onClick={() => setFilter(c)} className={cn("px-3 py-1.5 rounded-full text-xs whitespace-nowrap border", filter === c ? "bg-[var(--forest)] text-[#F5F2EB] border-[var(--forest)]" : "bg-[var(--card)] text-muted-foreground border-border")}>{c}</button>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtered.map((r, i) => (
              <Card key={i} className="!p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className={cn("text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full", typeColor[r.type])}>{r.type}</span>
                  <span className="text-[10px] text-muted-foreground">{r.duration}</span>
                </div>
                <div className="font-serif text-lg text-primary">{r.title}</div>
                <div className="text-xs text-muted-foreground">{r.creator}</div>
                <p className="text-sm italic mt-2 text-foreground/80"><span className="text-[var(--gold)]">Why:</span> {r.why}</p>
                {r.url && (
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-3 text-sm text-[var(--forest)] hover:text-[var(--gold)]">
                    Open <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </Card>
            ))}
          </div>
        </>
      )}

      {mode === "ask" && (
        <div className="space-y-4">
          <Textarea rows={3} value={q} onChange={(e) => setQ(e.target.value)} placeholder="What do you want to get better at? What format do you prefer? (books, videos, courses, podcasts)" />
          <Button onClick={ask} disabled={loading || !q.trim()} className="bg-[var(--forest)] text-[var(--gold)]">
            {loading ? "Curating..." : "Get Recommendations →"}
          </Button>
          {loading && <LoadingSkeleton />}
          {text && !loading && <ResponseView text={text} />}
        </div>
      )}
    </div>
  );
}

// ---------- MEMORY ----------
function MemoryTab() {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});
  const [topic, setTopic] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const askFn = useServerFn(askProfessor);

  useEffect(() => { setCards(loadLS<Flashcard[]>("ascend_lifeskills_flashcards", [])); }, []);

  function setKnown(id: string, known: boolean) {
    const next = cards.map((c) => c.id === id ? { ...c, known } : c);
    setCards(next); saveLS("ascend_lifeskills_flashcards", next);
  }

  const decks = useMemo(() => {
    const m: Record<string, Flashcard[]> = {};
    for (const c of cards) { (m[c.deck] ??= []).push(c); }
    return m;
  }, [cards]);

  async function generate() {
    if (!topic.trim()) return;
    setLoading(true); setText("");
    try {
      const res = await askFn({ data: { kind: "memory", prompt: topic } });
      setText(res.text);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  }

  return (
    <div className="space-y-8">
      <SectionHeader kicker="Retain" title="Memory System" subtitle="Remember everything you learn — forever." />

      <div>
        <h3 className="font-serif text-lg text-primary mb-3">Saved Flashcards</h3>
        {cards.length === 0 ? (
          <EmptyState title="No flashcards yet." hint="Generate flashcards from any Learn or Book response." />
        ) : (
          <div className="space-y-5">
            {Object.entries(decks).map(([deck, list]) => {
              const known = list.filter((c) => c.known).length;
              return (
                <div key={deck}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-serif text-base text-primary">{deck}</p>
                    <span className="text-xs text-muted-foreground">{known}/{list.length} known</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {list.map((c) => (
                      <div key={c.id} className="[perspective:1000px]">
                        <div
                          onClick={() => setFlipped((f) => ({ ...f, [c.id]: !f[c.id] }))}
                          className={cn(
                            "relative h-40 w-full cursor-pointer [transform-style:preserve-3d] transition-transform duration-500",
                            flipped[c.id] && "[transform:rotateY(180deg)]",
                          )}
                        >
                          <div className="absolute inset-0 [backface-visibility:hidden] rounded-xl bg-[var(--card)] ring-1 ring-border/60 p-4 flex items-center justify-center text-center">
                            <p className="font-serif text-base text-primary">{c.q}</p>
                          </div>
                          <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] rounded-xl bg-[var(--forest)] text-[#F5F2EB] p-4 flex items-center justify-center text-center">
                            <p className="text-sm">{c.a}</p>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-2">
                          <Button size="sm" variant={c.known ? "default" : "outline"} onClick={() => setKnown(c.id, true)} className={cn(c.known && "bg-[var(--forest)] text-[var(--gold)]")}>Know this ✓</Button>
                          <Button size="sm" variant="outline" onClick={() => setKnown(c.id, false)}>Review again</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h3 className="font-serif text-lg text-primary mb-3">Generate Memory Aid</h3>
        <Card>
          <Textarea rows={2} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Concept to memorize — e.g. 'The 6 principles of Influence by Cialdini'" />
          <Button onClick={generate} disabled={loading || !topic.trim()} className="mt-3 bg-[var(--forest)] text-[var(--gold)]">
            {loading ? "Building..." : "Create Memory System →"}
          </Button>
        </Card>
        {loading && <div className="mt-4"><LoadingSkeleton /></div>}
        {text && !loading && (
          <div className="mt-4 space-y-3">
            <ResponseView text={text} />
            <Button variant="outline" size="sm" onClick={() => {
              const notes = loadLS<NoteEntry[]>("ascend_lifeskills_notes", []);
              saveLS("ascend_lifeskills_notes", [{ id: crypto.randomUUID(), topic: `🧠 Memory: ${topic}`, summary: text.slice(0, 400), timestamp: Date.now() }, ...notes].slice(0, 100));
              toast.success("Saved to Memory Bank");
            }}>Save to Memory Bank</Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- PROGRESS ----------
function ProgressTab({ onOpen }: { onOpen: (topic: string, cat?: string) => void }) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [books, setBooks] = useState<BookEntry[]>([]);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [notes, setNotes] = useState<NoteEntry[]>([]);

  useEffect(() => {
    setHistory(loadLS("ascend_lifeskills_history", []));
    setBooks(loadLS("ascend_book_history", []));
    setChat(loadLS("ascend_mentor_chat", []));
    setCards(loadLS("ascend_lifeskills_flashcards", []));
    setNotes(loadLS("ascend_lifeskills_notes", []));
  }, []);

  const mentorSessions = chat.filter((m) => m.role === "user").length;

  const categoryFreq = useMemo(() => {
    const m: Record<string, number> = {};
    for (const h of history) if (h.category) m[h.category] = (m[h.category] ?? 0) + 1;
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [history]);

  const streak = useMemo(() => {
    if (!history.length) return 0;
    const days = new Set(history.map((h) => new Date(h.timestamp).toDateString()));
    let s = 0;
    const d = new Date();
    while (days.has(d.toDateString())) { s++; d.setDate(d.getDate() - 1); }
    return s;
  }, [history]);

  const maxFreq = Math.max(1, ...categoryFreq.map((c) => c[1]));

  return (
    <div className="space-y-6">
      <SectionHeader kicker="Your Growth" title="Progress" subtitle="Consistency compounds. Here's your record." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><p className="text-xs uppercase tracking-wider text-muted-foreground">Topics Mastered</p><p className="font-serif text-3xl text-[var(--gold)] mt-1">{history.length}</p></Card>
        <Card><p className="text-xs uppercase tracking-wider text-muted-foreground">Books Explored</p><p className="font-serif text-3xl text-[var(--forest)] mt-1">{books.length}</p></Card>
        <Card><p className="text-xs uppercase tracking-wider text-muted-foreground">Mentor Sessions</p><p className="font-serif text-3xl text-primary mt-1">{mentorSessions}</p></Card>
        <Card><p className="text-xs uppercase tracking-wider text-muted-foreground">Flashcards</p><p className="font-serif text-3xl text-[var(--gold)] mt-1">{cards.length}</p></Card>
      </div>

      <Card className="!bg-[var(--forest)] text-[#F5F2EB] text-center">
        <p className="text-[10px] uppercase tracking-widest text-[var(--gold)]">Learning Streak</p>
        <p className="font-serif text-3xl mt-2">🔥 {streak} day{streak === 1 ? "" : "s"}</p>
      </Card>

      <div>
        <h3 className="font-serif text-lg text-primary mb-3">Skills explored</h3>
        {categoryFreq.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Start learning to see your skill cloud.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {categoryFreq.map(([cat, n]) => (
              <button key={cat} onClick={() => onOpen(`Continue teaching me ${cat}`, cat)} className="px-3 py-1.5 rounded-full bg-[var(--linen)] hover:bg-[var(--gold)]/20 text-primary transition-colors" style={{ fontSize: `${12 + (n / maxFreq) * 6}px` }}>
                {cat} <span className="text-muted-foreground">({n})</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="font-serif text-lg text-primary mb-3">Recently saved notes</h3>
        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No notes yet.</p>
        ) : (
          <ul className="space-y-2">
            {notes.slice(0, 5).map((n) => (
              <li key={n.id} className="rounded-lg bg-[var(--card)] p-3 ring-1 ring-border/60">
                <div className="font-serif text-sm text-primary">{n.topic}</div>
                <div className="text-xs text-muted-foreground line-clamp-2 mt-1">{n.summary}</div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="font-serif text-lg text-primary mb-3">What to explore next</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {ROADMAP.map((r) => (
            <Card key={r.week} className="!p-4">
              <p className="text-[10px] uppercase tracking-widest text-[var(--gold)]">{r.week}</p>
              <p className="font-serif text-lg text-primary mt-1">{r.title}</p>
              <p className="text-xs text-muted-foreground mt-1">{r.topics.join(" · ")}</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={() => onOpen(r.seed, r.topics[0])}>Start →</Button>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
