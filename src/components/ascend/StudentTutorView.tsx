import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  GraduationCap,
  BookOpen,
  PencilRuler,
  ClipboardCheck,
  FileQuestion,
  MessagesSquare,
  Loader2,
  Sparkles,
  Trash2,
  Plus,
  Square,
  ExternalLink,
  Database,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { groundedTutor } from "@/lib/student-tutor.functions";
import { mapAuthError } from "@/lib/auth-errors";
import type { ContextItem } from "@/lib/context-engine-core";

type Mode = "TEACH" | "PRACTICE" | "EVALUATE" | "EXAM" | "CHAT";

const SOURCE_LABELS: Record<string, string> = {
  document: "Your document",
  learn_topic: "Your topic",
  curated: "Curated",
  official: "Official docs",
  exam: "Your exam",
  goal: "Your goal",
  client: "Your client",
  project: "Your project",
  dataset: "Dataset",
};

interface Turn {
  role: "user" | "assistant";
  content: string;
  sources?: ContextItem[];
  datasets?: ContextItem[];
  grounded?: boolean;
  syllabusMatch?: boolean | null;
}

const MODES: { id: Mode; label: string; icon: typeof BookOpen }[] = [
  { id: "TEACH", label: "Teach", icon: BookOpen },
  { id: "PRACTICE", label: "Practice", icon: PencilRuler },
  { id: "EXAM", label: "Exam", icon: ClipboardCheck },
  { id: "CHAT", label: "Chat", icon: MessagesSquare },
];

const LEVELS = [
  { id: "simple", label: "Simple intuition" },
  { id: "normal", label: "Normal" },
  { id: "technical", label: "Technical" },
];

const QTYPES = [
  { id: "mcq", label: "MCQ" },
  { id: "short", label: "Short answer" },
  { id: "conceptual", label: "Conceptual" },
  { id: "numerical", label: "Numerical" },
  { id: "coding", label: "Coding" },
];

function Sources({ items }: { items: ContextItem[] }) {
  const grounded = items.filter((i) => i.source !== "dataset");
  if (grounded.length === 0) return null;
  return (
    <div className="mt-2 space-y-1.5">
      <span className="text-xs font-medium text-forest">Sources</span>
      <ul className="space-y-1">
        {grounded.map((s, idx) => (
          <li key={idx} className="text-xs text-muted-foreground">
            <span className="mr-1.5 inline-block rounded bg-forest/10 px-1.5 py-0.5 text-[10px] font-medium uppercase text-forest">
              {SOURCE_LABELS[s.source] ?? s.source}
            </span>
            <span className="font-medium text-forest/90">{s.title}</span>
            {s.page ? ` · page ${s.page}` : ""}
            {s.heading ? ` · “${s.heading}”` : ""}
            {s.url && (
              <>
                {" · "}
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-0.5 text-gold hover:underline"
                >
                  link <ExternalLink className="h-3 w-3" />
                </a>
              </>
            )}
            {s.license ? ` · ${s.license}` : ""}
            {s.provenance ? ` · ${s.provenance}` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}

function DatasetRecs({ items }: { items: ContextItem[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mt-2 space-y-2">
      <span className="flex items-center gap-1 text-xs font-medium text-forest">
        <Database className="h-3 w-3 text-gold" /> Practice with this dataset
      </span>
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((d, idx) => (
          <a
            key={idx}
            href={d.url}
            target="_blank"
            rel="noreferrer"
            className="block rounded-md border border-border bg-muted/40 p-2.5 text-xs hover:border-gold/50"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-forest">{d.title}</span>
              <ExternalLink className="h-3 w-3 shrink-0 text-gold" />
            </div>
            {d.text && <p className="mt-1 text-muted-foreground">{d.text}</p>}
            <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-muted-foreground">
              {d.license && <span className="rounded bg-forest/10 px-1 py-0.5">{d.license}</span>}
              {d.source && (
                <span className="rounded bg-forest/10 px-1 py-0.5">{d.provenance ?? d.source}</span>
              )}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

export default function StudentTutorView() {
  const [mode, setMode] = useState<Mode>("TEACH");
  const [level, setLevel] = useState<string>("normal");
  const [subject, setSubject] = useState("");
  const [questionType, setQuestionType] = useState<string>("conceptual");
  const [input, setInput] = useState("");
  const [answer, setAnswer] = useState("");
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<Turn[]>([]);
  const [pending, setPending] = useState(false);
  const abortedRef = useRef(false);

  const tutor = useServerFn(groundedTutor);

  const buildHistory = () =>
    transcript.slice(-20).map((t) => ({ role: t.role, content: t.content })) as {
      role: "user" | "assistant" | "system";
      content: string;
    }[];

  const pushTurn = (turn: Turn) => setTranscript((prev) => [...prev, turn]);

  const clearChat = () => {
    abortedRef.current = true;
    setPending(false);
    setTranscript([]);
    setPendingQuestion(null);
  };

  const newConversation = () => {
    abortedRef.current = true;
    setPending(false);
    setTranscript([]);
    setPendingQuestion(null);
    setSubject("");
    setMode("TEACH");
  };

  const stopGeneration = () => {
    abortedRef.current = true;
    setPending(false);
  };

  const onSend = async () => {
    if (!input.trim() || pending) return;
    const userMsg = input.trim();
    setPending(true);
    pushTurn({ role: "user", content: userMsg });
    setInput("");
    try {
      const res = await tutor({
        data: {
          mode,
          message: userMsg,
          subject: subject || undefined,
          level: mode === "TEACH" ? (level as never) : undefined,
          questionType: mode === "PRACTICE" ? (questionType as never) : undefined,
          history: buildHistory(),
        },
      });
      if (abortedRef.current) {
        abortedRef.current = false;
        return;
      }
      pushTurn({
        role: "assistant",
        content: res.text,
        sources: res.sources,
        datasets: res.datasets,
        grounded: res.grounded,
        syllabusMatch: res.syllabusMatch,
      });
      if (mode === "PRACTICE") setPendingQuestion(res.text);
    } catch (err) {
      if (abortedRef.current) {
        abortedRef.current = false;
        return;
      }
      pushTurn({
        role: "assistant",
        content: `⚠️ ${mapAuthError(err)}`,
      });
    } finally {
      if (!abortedRef.current) setPending(false);
    }
  };

  const onEvaluate = async () => {
    if (!pendingQuestion || !answer.trim() || pending) return;
    const q = pendingQuestion;
    const a = answer.trim();
    setPending(true);
    pushTurn({ role: "user", content: `Answer: ${a}` });
    setAnswer("");
    try {
      const res = await tutor({
        data: {
          mode: "EVALUATE",
          message: q,
          subject: subject || undefined,
          userAnswer: a,
          history: buildHistory(),
        },
      });
      if (abortedRef.current) {
        abortedRef.current = false;
        return;
      }
      pushTurn({
        role: "assistant",
        content: res.text,
        sources: res.sources,
        datasets: res.datasets,
        grounded: res.grounded,
        syllabusMatch: res.syllabusMatch,
      });
    } catch (err) {
      if (abortedRef.current) {
        abortedRef.current = false;
        return;
      }
      pushTurn({
        role: "assistant",
        content: `⚠️ ${mapAuthError(err)}`,
      });
    } finally {
      if (!abortedRef.current) setPending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl text-forest">AI Tutor</h2>
          <p className="text-sm text-muted-foreground">
            Your grounded study tutor. It answers from your uploaded syllabus, notes, and academic
            data first, then curated educational resources and official docs — clearly labeled when
            an answer is AI-generated rather than grounded.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pending && (
            <Button
              variant="outline"
              className="border-red-300 text-red-700 hover:bg-red-50"
              onClick={stopGeneration}
            >
              <Square className="mr-2 h-3 w-3" /> Stop
            </Button>
          )}
          <Button variant="outline" className="border-gold text-forest" onClick={clearChat}>
            <Trash2 className="mr-2 h-3 w-3" /> Clear chat
          </Button>
          <Button variant="outline" className="border-gold text-forest" onClick={newConversation}>
            <Plus className="mr-2 h-3 w-3" /> New conversation
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {MODES.map((m) => {
          const Icon = m.icon;
          const active = mode === m.id;
          return (
            <Button
              key={m.id}
              variant={active ? "default" : "outline"}
              className={
                active ? "bg-forest text-ivory hover:bg-forest/90" : "border-gold text-forest"
              }
              onClick={() => {
                setMode(m.id);
                if (m.id !== "PRACTICE") setPendingQuestion(null);
              }}
            >
              <Icon className="mr-2 h-4 w-4" /> {m.label}
            </Button>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label className="text-forest">Subject (optional)</Label>
          <Input
            className="border-border"
            placeholder="e.g. Engineering Physics"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>
        {mode === "TEACH" && (
          <div className="space-y-1.5">
            <Label className="text-forest">Level</Label>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger className="border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEVELS.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {mode === "PRACTICE" && (
          <div className="space-y-1.5">
            <Label className="text-forest">Question type</Label>
            <Select value={questionType} onValueChange={setQuestionType}>
              <SelectTrigger className="border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QTYPES.map((q) => (
                  <SelectItem key={q.id} value={q.id}>
                    {q.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-forest text-lg flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-gold" />
            {mode === "TEACH" && "Teach me a concept"}
            {mode === "PRACTICE" && "Give me one practice question"}
            {mode === "EXAM" && "Prepare me for an exam"}
            {mode === "CHAT" && "Ask your tutor"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            className="border-border"
            placeholder={
              mode === "EXAM"
                ? "Which subject or topic should I help you prepare for?"
                : mode === "PRACTICE"
                  ? "Topic for a practice question (e.g. DBMS Transactions)"
                  : "What would you like to learn or ask?"
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <Button
            className="bg-forest text-ivory hover:bg-forest/90"
            disabled={pending || !input.trim()}
            onClick={onSend}
          >
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "PRACTICE" ? "Generate question" : "Send"}
          </Button>

          {mode === "PRACTICE" && pendingQuestion && (
            <div className="space-y-3 rounded-md border border-border bg-muted/40 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Your answer</p>
              <Textarea
                className="border-border bg-background"
                placeholder="Type your answer, then evaluate."
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
              />
              <Button
                className="bg-gold text-ivory hover:bg-gold/90"
                disabled={pending || !answer.trim()}
                onClick={onEvaluate}
              >
                {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <GraduationCap className="mr-2 h-4 w-4" /> Evaluate answer
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {transcript.length === 0 && !pending && (
        <Card className="border-dashed border-border">
          <CardContent className="p-6 text-center space-y-3">
            <MessagesSquare className="mx-auto h-8 w-8 text-gold" />
            <p className="text-sm text-muted-foreground">
              Ask anything — concepts, practice questions, or about your uploaded documents. Your
              tutor keeps the conversation in context.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {[
                "Explain DBMS transactions",
                "Give me a DSA practice question",
                "Quiz me for exams",
              ].map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:text-forest hover:border-gold/50 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {pending && transcript.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Professor is thinking…
        </div>
      )}

      {transcript.length > 0 && (
        <div className="space-y-3">
          {transcript.map((t, i) => (
            <Card
              key={i}
              className={t.role === "user" ? "border-gold/40 bg-gold/5" : "border-border"}
            >
              <CardContent className="p-4 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="bg-muted text-forest">
                    {t.role === "user" ? "You" : "Tutor"}
                  </Badge>
                  {t.role === "assistant" &&
                    (mode === "PRACTICE" && i === transcript.length - 1 && pendingQuestion ? (
                      <Badge variant="outline" className="text-gold border-gold/40">
                        <FileQuestion className="mr-1 h-3 w-3" /> Question
                      </Badge>
                    ) : null)}
                  {t.role === "assistant" && t.grounded === true && (
                    <Badge
                      variant="outline"
                      className="text-green-700 border-green-300 bg-green-50"
                    >
                      <CheckCircle2 className="mr-1 h-3 w-3" /> Grounded answer
                    </Badge>
                  )}
                  {t.role === "assistant" && t.grounded === false && (
                    <Badge
                      variant="outline"
                      className="text-amber-700 border-amber-300 bg-amber-50"
                    >
                      <AlertTriangle className="mr-1 h-3 w-3" /> AI-generated — no grounded source
                    </Badge>
                  )}
                  {t.role === "assistant" && t.syllabusMatch === false && (
                    <Badge variant="outline" className="text-red-700 border-red-300 bg-red-50">
                      Outside your current syllabus
                    </Badge>
                  )}
                </div>
                <div className="text-sm whitespace-pre-wrap">{t.content}</div>
                {t.sources && <Sources items={t.sources} />}
                {t.datasets && <DatasetRecs items={t.datasets} />}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
