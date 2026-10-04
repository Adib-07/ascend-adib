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
  Bot,
  Brain,
  Zap,
  Loader2,
  Sparkles,
  Trash2,
  Plus,
  Square,
  ExternalLink,
  Database,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Target,
  BookOpen,
  Calendar,
  ListChecks,
  RefreshCw,
  MessageSquare,
  Send,
  X,
  Check,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { personalAssistant, executeAssistantAction } from "@/lib/personal-assistant.functions";
import { mapAuthError } from "@/lib/auth-errors";
import type { ContextItem } from "@/lib/context-engine-core";
import type { AssistantAction, AssistantIntent } from "@/lib/personal-assistant.server";

interface AssistantResponse {
  text: string;
  sources: ContextItem[];
  intent: AssistantIntent;
  actions: AssistantAction[];
  grounded: boolean;
  category: string;
}

const INTENT_LABELS: Record<
  AssistantIntent,
  { label: string; icon: typeof Bot; description: string }
> = {
  WHAT_NOW: { label: "What Now", icon: Zap, description: "Immediate actionable recommendations" },
  STUDY_TODAY: {
    label: "Study Today",
    icon: BookOpen,
    description: "Today's study plan with priorities",
  },
  BEHIND_ON: {
    label: "Behind On",
    icon: AlertTriangle,
    description: "What you're falling behind on",
  },
  PRIORITIES_WEEK: {
    label: "Week Priorities",
    icon: Target,
    description: "Top priorities for this week",
  },
  NEXT_EXAM: { label: "Next Exam", icon: Calendar, description: "Upcoming exam details" },
  EXAM_PREPAREDNESS: {
    label: "Exam Readiness",
    icon: CheckCircle2,
    description: "How prepared you are for exams",
  },
  WORKED_YESTERDAY: {
    label: "Yesterday's Work",
    icon: RefreshCw,
    description: "Summary of completed work",
  },
  REVISE_TONIGHT: {
    label: "Revise Tonight",
    icon: BookOpen,
    description: "Tonight's revision recommendations",
  },
  TOPIC_RELATED: {
    label: "Topic Search",
    icon: Database,
    description: "Everything related to a topic",
  },
  PLAN_TOMORROW: {
    label: "Plan Tomorrow",
    icon: Calendar,
    description: "Tomorrow's schedule and tasks",
  },
  GENERAL_QUESTION: {
    label: "General Chat",
    icon: MessageSquare,
    description: "Ask anything about your data",
  },
  ACTION_PROPOSAL: {
    label: "Action Plan",
    icon: ListChecks,
    description: "Proposed actions to confirm",
  },
};

const SOURCE_LABELS: Record<string, string> = {
  task: "Your task",
  learn_topic: "Your topic",
  exam: "Your exam",
  goal: "Your goal",
  habit: "Your habit",
  note: "Your note",
  project: "Your project",
  client: "Your client",
  event: "Your event",
  reminder: "Your reminder",
  document: "Your document",
  curated: "Curated",
  official: "Official docs",
  dataset: "Dataset",
};

interface Turn {
  role: "user" | "assistant";
  content: string;
  sources?: ContextItem[];
  intent?: AssistantIntent;
  actions?: AssistantAction[];
  grounded?: boolean;
  category?: string;
}

function Sources({ items }: { items: ContextItem[] }) {
  const grounded = items.filter((i) => i.source !== "dataset");
  if (grounded.length === 0) return null;
  return (
    <details className="mt-2 group">
      <summary className="flex items-center gap-1.5 text-xs font-medium text-forest cursor-pointer">
        <Database className="h-3 w-3 text-gold" />
        Sources ({grounded.length})
        <ChevronDown className="h-3 w-3 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <ul className="mt-2 space-y-1 ml-5 border-l border-border/40 pl-3">
        {grounded.map((s, idx) => (
          <li key={idx} className="text-xs text-muted-foreground">
            <span className="mr-1.5 inline-block rounded bg-forest/10 px-1.5 py-0.5 text-[10px] font-medium uppercase text-forest">
              {SOURCE_LABELS[s.source] ?? s.source}
            </span>
            <span className="font-medium text-forest/90">{s.title}</span>
            {s.page ? ` · page ${s.page}` : ""}
            {s.heading ? ` · "{s.heading}"` : ""}
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
    </details>
  );
}

function ActionCard({
  action,
  onConfirm,
  onReject,
  pending,
}: {
  action: AssistantAction;
  onConfirm: () => void;
  onReject: () => void;
  pending: boolean;
}) {
  return (
    <Card className="border-gold/40 bg-gold/5">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <p className="text-sm font-medium text-forest">{action.description}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Type: <code className="bg-muted px-1 rounded">{action.type}</code>
            </p>
          </div>
          <Badge variant="outline" className="text-gold border-gold/40 shrink-0">
            <Zap className="mr-1 h-3 w-3" /> Action Proposed
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            className="bg-forest text-ivory hover:bg-forest/90 text-sm"
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <Check className="mr-1 h-3 w-3" />
            )}{" "}
            Confirm
          </Button>
          <Button
            variant="outline"
            className="border-destructive text-destructive hover:bg-destructive/10 text-sm"
            disabled={pending}
            onClick={onReject}
          >
            <X className="mr-1 h-3 w-3" /> Dismiss
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PersonalAssistantView() {
  const [input, setInput] = useState("");
  const [transcript, setTranscript] = useState<Turn[]>([]);
  const [pending, setPending] = useState(false);
  const [pendingActionConfirmations, setPendingActionConfirmations] = useState<
    Array<{ id: number; action: AssistantAction; turnIndex: number }>
  >([]);
  const abortedRef = useRef(false);

  const assistant = useServerFn(personalAssistant);
  const executeAction = useServerFn(executeAssistantAction);

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
    setPendingActionConfirmations([]);
  };

  const newConversation = () => {
    abortedRef.current = true;
    setPending(false);
    setTranscript([]);
    setPendingActionConfirmations([]);
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
      const res = (await assistant({
        data: {
          question: userMsg,
          category: "ACADEMIC",
          mode: "student",
        },
      })) as AssistantResponse;
      if (abortedRef.current) {
        abortedRef.current = false;
        return;
      }
      const newTurn: Turn = {
        role: "assistant",
        content: res.text,
        sources: res.sources,
        intent: res.intent,
        actions: res.actions,
        grounded: res.grounded,
        category: res.category,
      };
      pushTurn(newTurn);
      if (res.actions && res.actions.length > 0) {
        const turnIndex = transcript.length;
        res.actions.forEach((action: AssistantAction, i: number) => {
          setPendingActionConfirmations((prev) => [
            ...prev,
            { id: turnIndex * 100 + i, action, turnIndex },
          ]);
        });
      }
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

  const handleActionConfirm = async (
    confirmation: { id: number; action: AssistantAction; turnIndex: number },
    confirm: boolean,
  ) => {
    setPendingActionConfirmations((prev) => prev.filter((c) => c.id !== confirmation.id));
    if (!confirm) return;
    interface ExecuteActionResult {
      success: boolean;
      message: string;
      data?: Record<string, unknown>;
    }

    try {
      const res = (await executeAction({
        data: { action: confirmation.action, confirm: true },
      })) as ExecuteActionResult;
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    } catch (err) {
      toast.error(mapAuthError(err));
    }
  };

  const suggestedQuestions = [
    "What should I do right now?",
    "What should I study today?",
    "What am I behind on?",
    "What are my priorities this week?",
    "When is my next exam?",
    "How prepared am I for my exams?",
    "What did I work on yesterday?",
    "What should I revise tonight?",
    "Show everything related to PN junction",
    "Help me plan tomorrow",
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl text-forest flex items-center gap-2">
            <Bot className="h-5 w-5 text-gold" />
            Personal AI Assistant
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Your unified assistant that understands all your Ascend data — tasks, events, habits,
            goals, projects, notes, documents, exams, topics, and revisions. Ask anything or get
            proactive guidance.
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

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-forest text-lg flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-gold" />
            Ask your assistant
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            className="border-border"
            placeholder="What should I do right now? · What should I study today? · What am I behind on? · When is my next exam? · Help me plan tomorrow..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={3}
          />
          <Button
            className="bg-forest text-ivory hover:bg-forest/90 w-full sm:w-auto"
            disabled={pending || !input.trim()}
            onClick={onSend}
          >
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Send className="mr-2 h-4 w-4" /> Send
          </Button>

          {transcript.length === 0 && !pending && (
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Suggested questions
              </p>
              <div className="flex flex-wrap gap-2">
                {suggestedQuestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => setInput(s)}
                    className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-forest hover:border-gold/50 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {pendingActionConfirmations.length > 0 && (
        <Card className="border-gold/40 bg-gold/5">
          <CardHeader>
            <CardTitle className="text-forest text-lg flex items-center gap-2">
              <Zap className="h-4 w-4 text-gold" /> Pending Confirmations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingActionConfirmations.map((c) => (
              <ActionCard
                key={c.id}
                action={c.action}
                onConfirm={() => handleActionConfirm(c, true)}
                onReject={() => handleActionConfirm(c, false)}
                pending={pending}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {pending && transcript.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Assistant is thinking…
        </div>
      )}

      {transcript.length > 0 && (
        <div className="space-y-3">
          {transcript.map((t, i) => (
            <Card
              key={i}
              className={t.role === "user" ? "border-gold/40 bg-gold/5" : "border-border"}
            >
              <CardContent className="p-4 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="bg-muted text-forest">
                    {t.role === "user" ? "You" : "Assistant"}
                  </Badge>
                  {t.intent &&
                    INTENT_LABELS[t.intent] &&
                    (() => {
                      const Icon = INTENT_LABELS[t.intent].icon;
                      return (
                        <Badge variant="outline" className="text-forest border-forest/40">
                          <Icon className="mr-1 h-3 w-3" />
                          {INTENT_LABELS[t.intent].label}
                        </Badge>
                      );
                    })()}
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
                  {t.category && (
                    <Badge variant="secondary" className="bg-muted text-[10px] uppercase">
                      {t.category}
                    </Badge>
                  )}
                </div>
                <div className="text-sm whitespace-pre-wrap">{t.content}</div>
                {t.sources && <Sources items={t.sources} />}
                {t.actions && t.actions.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-border/40">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                      Proposed Actions
                    </p>
                    <div className="space-y-1">
                      {t.actions.map((action, ai) => (
                        <div
                          key={ai}
                          className="text-xs text-muted-foreground bg-muted/40 rounded p-2"
                        >
                          <code>{action.type}</code>: {action.description}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

import { toast } from "sonner";
