import type { SupabaseClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { MAX_TOKENS, MODEL, TEMPERATURE } from "./tutor.server";
import {
  retrieveGroundedContext,
  retrieveStructured,
  retrieveDocumentChunks,
  getStudentProfile,
  getDueRevisions,
  getWeakAreas,
  type ContextItem,
  type QueryCategory,
  type StudentProfile,
  type RevisionItem,
  type WeakArea,
} from "./context-engine.server";
import {
  buildSystemPrompt,
  buildUserPrompt,
  classifyQuestion,
  normalizeKeywords,
  enforceBudget,
  SOURCE_TIER,
  type ContextSource,
} from "./context-engine-core";
import { withAIRetry } from "./retry";

export type AssistantIntent =
  | "WHAT_NOW"
  | "STUDY_TODAY"
  | "BEHIND_ON"
  | "PRIORITIES_WEEK"
  | "NEXT_EXAM"
  | "EXAM_PREPAREDNESS"
  | "WORKED_YESTERDAY"
  | "REVISE_TONIGHT"
  | "TOPIC_RELATED"
  | "PLAN_TOMORROW"
  | "GENERAL_QUESTION"
  | "ACTION_PROPOSAL";

export interface AssistantAction {
  type:
    | "create_task"
    | "create_reminder"
    | "create_event"
    | "create_habit"
    | "create_goal"
    | "create_project"
    | "create_study_plan"
    | "log_revision"
    | "update_topic"
    | "run_automation";
  payload: Record<string, unknown>;
  description: string;
  requiresConfirmation: boolean;
}

export interface AssistantResponse {
  text: string;
  sources: ContextItem[];
  intent: AssistantIntent;
  actions: AssistantAction[];
  grounded: boolean;
  category: QueryCategory;
}

interface IntentClassificationResult {
  intent: AssistantIntent;
  confidence: number;
  entities: Record<string, string>;
}

async function classifyIntent(
  question: string,
  profile: StudentProfile,
  dueRevisions: RevisionItem[],
  weakAreas: WeakArea[],
): Promise<IntentClassificationResult> {
  const q = question.toLowerCase();
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const tomorrow = new Date(now.getTime() + 86400000).toISOString().split("T")[0];

  const intentPatterns: Array<{ intent: AssistantIntent; patterns: string[] }> = [
    {
      intent: "WHAT_NOW",
      patterns: [
        "what should i do",
        "what to do now",
        "what now",
        "right now",
        "current priority",
        "do right now",
      ],
    },
    {
      intent: "STUDY_TODAY",
      patterns: ["what should i study", "study today", "what to study", "study plan today"],
    },
    {
      intent: "BEHIND_ON",
      patterns: ["behind", "overdue", "missed", "falling behind", "catch up", "behind on"],
    },
    {
      intent: "PRIORITIES_WEEK",
      patterns: [
        "priorities this week",
        "week priorities",
        "this week",
        "weekly priorities",
        "what's important this week",
      ],
    },
    {
      intent: "NEXT_EXAM",
      patterns: ["next exam", "when is my exam", "upcoming exam", "exam date", "when is the exam"],
    },
    {
      intent: "EXAM_PREPAREDNESS",
      patterns: [
        "how prepared",
        "prepared for exam",
        "exam readiness",
        "am i ready",
        "preparation level",
      ],
    },
    {
      intent: "WORKED_YESTERDAY",
      patterns: [
        "what did i work",
        "worked yesterday",
        "yesterday work",
        "what did i do yesterday",
        "yesterday activity",
      ],
    },
    {
      intent: "REVISE_TONIGHT",
      patterns: [
        "revise tonight",
        "what to revise",
        "revision tonight",
        "study tonight",
        "review tonight",
      ],
    },
    {
      intent: "TOPIC_RELATED",
      patterns: ["show everything", "related to", "everything about", "all about", "show me"],
    },
    {
      intent: "PLAN_TOMORROW",
      patterns: ["plan tomorrow", "tomorrow plan", "prepare tomorrow", "schedule tomorrow"],
    },
  ];

  let bestIntent: AssistantIntent = "GENERAL_QUESTION";
  let bestScore = 0;

  for (const { intent, patterns } of intentPatterns) {
    let score = 0;
    for (const pattern of patterns) {
      if (q.includes(pattern.toLowerCase())) score += 2;
    }
    if (score > bestScore) {
      bestScore = score;
      bestIntent = intent;
    }
  }

  const entities: Record<string, string> = {};
  if (bestIntent === "TOPIC_RELATED") {
    const match = q.match(
      /(?:related to|about|show (?:everything|all) (?:related to|about)\s+)(.+)/i,
    );
    if (match) entities.topic = match[1].trim();
  }

  return { intent: bestIntent, confidence: bestScore > 0 ? 0.8 : 0.3, entities };
}

async function buildAssistantContext(
  supabase: SupabaseClient,
  userId: string,
  intent: AssistantIntent,
  entities: Record<string, string>,
): Promise<{ items: ContextItem[]; category: QueryCategory }> {
  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];

  let category: QueryCategory = "ACADEMIC";
  const queries: string[] = [];

  switch (intent) {
    case "WHAT_NOW":
    case "STUDY_TODAY":
    case "REVISE_TONIGHT":
      category = "ACADEMIC";
      queries.push("tasks due today", "due revisions", "upcoming exams", "habits not done today");
      break;
    case "BEHIND_ON":
      category = "ACADEMIC";
      queries.push("overdue tasks", "incomplete habits", "exams soon", "goals not done");
      break;
    case "PRIORITIES_WEEK":
      category = "ACADEMIC";
      queries.push("tasks this week", "exams this week", "goals this week", "upcoming events");
      break;
    case "NEXT_EXAM":
    case "EXAM_PREPAREDNESS":
      category = "EXAM_PREPARATION";
      queries.push("exams", "exam preparation", "learn topics");
      break;
    case "WORKED_YESTERDAY":
      category = "GENERAL";
      queries.push("completed tasks yesterday", "recent activity");
      break;
    case "TOPIC_RELATED":
      category = "ACADEMIC";
      if (entities.topic) queries.push(entities.topic);
      break;
    case "PLAN_TOMORROW":
      category = "ACADEMIC";
      queries.push("tasks due tomorrow", "events tomorrow", "habits", "due revisions");
      break;
    default:
      category = classifyQuestion(queries.join(" ") || "general question");
  }

  const allItems: ContextItem[] = [];

  const structured = await retrieveStructured(supabase, userId, {
    category,
    terms: normalizeKeywords(queries.join(" ")),
  });
  allItems.push(...structured);

  const profile = await getStudentProfile(supabase, userId);
  const dueRevisions = await getDueRevisions(supabase, userId);
  const weakAreas = await getWeakAreas(supabase, userId);

  if (dueRevisions.length > 0) {
    for (const r of dueRevisions.slice(0, 10)) {
      allItems.push({
        source: "note",
        title: `Due Revision: ${r.source_title}`,
        page: null,
        heading: r.source_type,
        score: 5 + (r.priority_boost ?? 0),
        text: `Next review: ${r.next_review_date}. Priority boost: ${r.priority_boost ?? 0}`,
        metadata: { source_type: r.source_type, source_id: r.source_id },
      });
    }
  }

  if (weakAreas.length > 0) {
    for (const w of weakAreas.slice(0, 8)) {
      allItems.push({
        source: "note",
        title: `Weak Area: ${w.concept}`,
        page: null,
        heading: w.type,
        score: 4,
        text: `Frequency: ${w.frequency}. Source: ${w.source}`,
        metadata: { type: w.type, frequency: w.frequency },
      });
    }
  }

  if (profile.exams.length > 0) {
    for (const e of profile.exams.slice(0, 5)) {
      allItems.push({
        source: "exam",
        title: `Exam: ${e.name}`,
        page: null,
        heading: e.subject,
        score: 4,
        text: `Date: ${e.exam_date}. Prep status: ${e.prep_status}. Syllabus: ${JSON.stringify(e.syllabus ?? [])}`,
        metadata: { exam_date: e.exam_date, prep_status: e.prep_status },
      });
    }
  }

  if (profile.topics.length > 0) {
    const relevantTopics = entities.topic
      ? profile.topics.filter((t) => t.topic.toLowerCase().includes(entities.topic!.toLowerCase()))
      : profile.topics.filter((t) => t.status === "In Progress" || (t.progress ?? 0) < 100);
    for (const t of relevantTopics.slice(0, 10)) {
      allItems.push({
        source: "learn_topic",
        title: `Topic: ${t.topic}`,
        page: null,
        heading: t.language,
        score: t.status === "In Progress" ? 4 : 3,
        text: `Skill: ${t.skill}. Status: ${t.status}. Progress: ${t.progress ?? 0}%. Mastery: ${t.mastery_level ?? 0}/5. Deadline: ${t.deadline ?? "none"}`,
        metadata: { progress: t.progress, mastery_level: t.mastery_level, status: t.status },
      });
    }
  }

  if (intent === "TOPIC_RELATED" && entities.topic) {
    const docItems = await retrieveDocumentChunks(supabase, userId, entities.topic, {
      category,
      limit: 15,
    });
    allItems.push(...docItems);
  }

  allItems.sort((a, b) => {
    const ta = SOURCE_TIER[a.source as ContextSource] ?? 10;
    const tb = SOURCE_TIER[b.source as ContextSource] ?? 10;
    if (ta !== tb) return ta - tb;
    return b.score - a.score;
  });

  const items = enforceBudget(allItems, 20, 8000);
  return { items, category };
}

function buildAssistantSystemPrompt(
  intent: AssistantIntent,
  profile: StudentProfile,
  dueRevisions: RevisionItem[],
  weakAreas: WeakArea[],
): string {
  const basePrompt = buildSystemPrompt("ACADEMIC");

  const priorityContext = (() => {
    const now = new Date();
    const twoWeeksMs = 14 * 24 * 60 * 60 * 1000;
    const upcomingExams = profile.exams.filter(
      (e) => e.exam_date && new Date(e.exam_date).getTime() - now.getTime() < twoWeeksMs,
    );
    if (upcomingExams.length > 0) {
      return `CURRENT PHASE: EXAM PREPARATION (${upcomingExams.map((e) => e.subject).join(", ")} exam${upcomingExams.length > 1 ? "s" : ""} within 2 weeks)`;
    }
    return "CURRENT PHASE: NORMAL ROADMAP";
  })();

  const intentGuidance: Record<AssistantIntent, string> = {
    WHAT_NOW: `Provide 1-3 immediate, specific, actionable recommendations for RIGHT NOW. Consider: due tasks, due revisions, habits not done, upcoming events in next few hours. Be concise.`,
    STUDY_TODAY: `Create a study plan for TODAY. Include: due revisions (highest priority), weak areas, upcoming exam topics, in-progress learn topics. Output as prioritized list with time estimates.`,
    BEHIND_ON: `Identify what the user is behind on: overdue tasks, missed habits, upcoming exams with low prep, goals past deadline. Be specific with dates and counts.`,
    PRIORITIES_WEEK: `List top 5 priorities for this week (Mon-Sun). Consider: exam dates, task deadlines, goal deadlines, habit streaks at risk. Rank by urgency and impact.`,
    NEXT_EXAM: `Identify the next upcoming exam. Provide: name, subject, date, days until, prep status, syllabus coverage. If multiple, list all within 30 days.`,
    EXAM_PREPAREDNESS: `Assess readiness for upcoming exam(s). Consider: prep_status, syllabus topics, learn_topic progress for that subject, weak areas in that subject, due revisions. Give percentage estimate if possible.`,
    WORKED_YESTERDAY: `Summarize what was completed yesterday: tasks marked done, habits completed, revisions logged, topics progressed. Use timestamps from data.`,
    REVISE_TONIGHT: `Recommend specific revision topics for tonight. Prioritize: due revisions (spaced repetition), weak areas, exam-proximate topics. Give 1-3 items with time estimates.`,
    TOPIC_RELATED: `Show everything related to the topic from user's data: documents, learn topics, exams, notes, tasks, goals. Organize by source type.`,
    PLAN_TOMORROW: `Create a plan for tomorrow: tasks due, events scheduled, habits to do, due revisions, suggested study blocks. Output as timeline.`,
    GENERAL_QUESTION: `Answer the question using grounded evidence from user's data. Cite sources. If no evidence, say so and use general knowledge.`,
    ACTION_PROPOSAL: `Propose specific actions the user can confirm. Each action must have: type, payload, description, requiresConfirmation.`,
  };

  const profileSummary = [
    `LEARNING TOPICS: ${profile.topics.length} total (${profile.topics.filter((t) => t.status === "In Progress").length} in progress, ${profile.topics.filter((t) => (t.mastery_level ?? 0) < 3 && (t.progress ?? 0) > 0).length} weak)`,
    `EXAMS: ${profile.exams.length} upcoming (${profile.exams.filter((e) => e.prep_status !== "Ready").length} not ready)`,
    `GOALS: ${profile.goals.filter((g) => !g.done).length} active`,
    `DUE REVISIONS: ${dueRevisions.length}`,
    `WEAK AREAS: ${weakAreas.length}`,
  ].join("\n");

  return `${basePrompt}

${priorityContext}

STUDENT PROFILE SUMMARY:
${profileSummary}

INTENT: ${intent}
${intentGuidance[intent]}

GROUNDING RULES:
- Use ONLY the provided evidence (USER-PROVIDED EVIDENCE) for factual claims
- Cite sources inline using the exact source label: (Source: Task: Title, due tomorrow)
- If evidence does not contain the answer, say: "This is not covered in your data."
- Never invent deadlines, progress, exam dates, completed tasks, habits, or preferences
- Be specific and actionable

ACTION PROPOSALS:
When proposing actions, output a JSON block at the end of your response with this structure:
\`\`\`json
{
  "actions": [
    {
      "type": "create_task|create_reminder|create_event|create_habit|create_goal|create_project|create_study_plan|log_revision|update_topic|run_automation",
      "payload": { ... },
      "description": "Human-readable description",
      "requiresConfirmation": true
    }
  ]
}
\`\`\`
Only propose actions that are relevant to the intent and grounded in the user's data.
Important changes (creating/deleting data) ALWAYS require confirmation.
`;
}

function extractActionsFromResponse(text: string): AssistantAction[] {
  const match = text.match(/```json\s*(\{[\s\S]*?\})\s*```/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[1]);
    return (parsed.actions ?? []).map(
      (a: {
        type: string;
        payload?: Record<string, unknown>;
        description?: string;
        requiresConfirmation?: boolean;
      }) => ({
        type: a.type as AssistantAction["type"],
        payload: a.payload ?? {},
        description: a.description ?? "",
        requiresConfirmation: a.requiresConfirmation ?? true,
      }),
    );
  } catch {
    return [];
  }
}

function stripActionBlock(text: string): string {
  return text.replace(/```json\s*\{[\s\S]*?\}\s*```/g, "").trim();
}

export async function personalAssistantImpl({
  supabase,
  userId,
  question,
  subject,
  history = [],
}: {
  supabase: SupabaseClient;
  userId: string;
  question: string;
  subject?: string;
  history?: { role: "user" | "assistant" | "system"; content: string }[];
}): Promise<AssistantResponse> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("AI service not configured");

  const profile = await getStudentProfile(supabase, userId);
  const dueRevisions = await getDueRevisions(supabase, userId);
  const weakAreas = await getWeakAreas(supabase, userId);

  const { intent, entities } = await classifyIntent(question, profile, dueRevisions, weakAreas);

  const { items, category } = await buildAssistantContext(supabase, userId, intent, entities);

  const system = buildAssistantSystemPrompt(intent, profile, dueRevisions, weakAreas);
  const user = buildUserPrompt(question, items);

  const fullPrompt =
    history.length > 0
      ? `${history.map((h) => `${h.role === "user" ? "USER" : "ASSISTANT"}: ${h.content}`).join("\n\n")}\n\n${user}`
      : user;

  const gateway = createLovableAiGatewayProvider(key);
  const text = await withAIRetry(async () => {
    const result = await generateText({
      model: gateway(MODEL),
      temperature: TEMPERATURE,
      maxOutputTokens: Math.min(4000, MAX_TOKENS + 1000),
      system,
      prompt: fullPrompt,
    });
    if (!result.text?.trim()) throw new Error("Empty response from AI");
    return result.text;
  });

  const actions = extractActionsFromResponse(text);
  const cleanText = stripActionBlock(text);
  const grounded = items.some((i) => isGroundedSource(i.source));

  return {
    text: cleanText,
    sources: items,
    intent,
    actions,
    grounded,
    category,
  };
}

function isGroundedSource(source: string): boolean {
  return [
    "task",
    "goal",
    "learn_topic",
    "exam",
    "habit",
    "note",
    "project",
    "client",
    "event",
    "reminder",
    "document",
    "curated",
    "official",
  ].includes(source);
}

export interface ExecuteActionResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

export async function executeActionImpl({
  supabase,
  userId,
  action,
  confirm,
}: {
  supabase: SupabaseClient;
  userId: string;
  action: AssistantAction;
  confirm: boolean;
}): Promise<ExecuteActionResult> {
  if (action.requiresConfirmation && !confirm) {
    return { success: false, message: "Action requires confirmation" };
  }

  const today = new Date().toISOString().split("T")[0];

  try {
    switch (action.type) {
      case "create_task": {
        const payload = action.payload as {
          title: string;
          priority?: "High" | "Medium" | "Low";
          due_date?: string;
          type?: "Study" | "Work" | "Personal";
          mit_slot?: boolean;
        };
        const { data, error } = await supabase
          .from("tasks")
          .insert({
            user_id: userId,
            title: payload.title,
            priority: payload.priority ?? "Medium",
            due_date: payload.due_date ?? today,
            type: payload.type ?? "Study",
            mit_slot: payload.mit_slot ?? false,
            done: false,
          })
          .select()
          .single();
        if (error) throw error;
        return { success: true, message: `Created task: ${payload.title}`, data: { id: data.id } };
      }

      case "create_reminder": {
        const payload = action.payload as {
          title: string;
          message?: string;
          trigger_at: string;
          related_type?: string;
          related_id?: string;
        };
        const { data, error } = await supabase
          .from("reminders")
          .insert({
            user_id: userId,
            title: payload.title,
            message: payload.message ?? "",
            trigger_at: payload.trigger_at,
            related_type: payload.related_type,
            related_id: payload.related_id,
            status: "pending",
          })
          .select()
          .single();
        if (error) throw error;
        return {
          success: true,
          message: `Created reminder: ${payload.title}`,
          data: { id: data.id },
        };
      }

      case "create_event": {
        const payload = action.payload as {
          title: string;
          description?: string;
          start_at: string;
          end_at: string;
          all_day?: boolean;
          location?: string;
        };
        const { data, error } = await supabase
          .from("events")
          .insert({
            user_id: userId,
            title: payload.title,
            description: payload.description ?? "",
            start_at: payload.start_at,
            end_at: payload.end_at,
            all_day: payload.all_day ?? false,
            location: payload.location,
          })
          .select()
          .single();
        if (error) throw error;
        return { success: true, message: `Created event: ${payload.title}`, data: { id: data.id } };
      }

      case "create_habit": {
        const payload = action.payload as {
          name: string;
          category?: string;
          frequency?: "daily" | "weekly" | "custom";
          target?: number;
          metric_type?: "boolean" | "count" | "duration" | "numeric";
          unit?: string;
        };
        const { data, error } = await supabase
          .from("habits")
          .insert({
            user_id: userId,
            name: payload.name,
            category: payload.category ?? "General",
            frequency: payload.frequency ?? "daily",
            target: payload.target ?? 1,
            metric_type: payload.metric_type ?? "boolean",
            unit: payload.unit ?? "",
            streak: 0,
            last_done: null,
          })
          .select()
          .single();
        if (error) throw error;
        return { success: true, message: `Created habit: ${payload.name}`, data: { id: data.id } };
      }

      case "create_goal": {
        const payload = action.payload as {
          scope: string;
          text: string;
          deadline?: string;
        };
        const { data, error } = await supabase
          .from("goals")
          .insert({
            user_id: userId,
            scope: payload.scope,
            text: payload.text,
            deadline: payload.deadline,
            done: false,
          })
          .select()
          .single();
        if (error) throw error;
        return { success: true, message: `Created goal: ${payload.text}`, data: { id: data.id } };
      }

      case "create_project": {
        const payload = action.payload as {
          name: string;
          status?: string;
          progress?: number;
          deadline?: string;
        };
        const { data, error } = await supabase
          .from("work_projects")
          .insert({
            user_id: userId,
            name: payload.name,
            status: payload.status ?? "Planning",
            progress: payload.progress ?? 0,
            deadline: payload.deadline,
          })
          .select()
          .single();
        if (error) throw error;
        return {
          success: true,
          message: `Created project: ${payload.name}`,
          data: { id: data.id },
        };
      }

      case "log_revision": {
        const payload = action.payload as {
          source_type: string;
          source_id: string;
          source_title: string;
          next_review_date: string;
          priority_boost?: number;
        };
        const { data, error } = await supabase
          .from("revision_schedule")
          .upsert({
            user_id: userId,
            source_type: payload.source_type,
            source_id: payload.source_id,
            source_title: payload.source_title,
            next_review_date: payload.next_review_date,
            priority_boost: payload.priority_boost ?? 0,
          })
          .select()
          .single();
        if (error) throw error;
        return {
          success: true,
          message: `Logged revision for: ${payload.source_title}`,
          data: { id: data.id },
        };
      }

      case "update_topic": {
        const payload = action.payload as {
          topic_id: string;
          progress?: number;
          status?: string;
          mastery_level?: number;
        };
        const { data, error } = await supabase
          .from("learn_topics")
          .update({
            progress: payload.progress,
            status: payload.status,
            mastery_level: payload.mastery_level,
            updated_at: new Date().toISOString(),
          })
          .eq("id", payload.topic_id)
          .eq("user_id", userId)
          .select()
          .single();
        if (error) throw error;
        return { success: true, message: `Updated topic progress`, data: { id: data.id } };
      }

      case "run_automation": {
        const payload = action.payload as {
          automation_id: string;
        };
        const { data, error } = await supabase
          .from("automations")
          .select("*")
          .eq("id", payload.automation_id)
          .eq("user_id", userId)
          .maybeSingle();
        if (error || !data) throw error ?? new Error("Automation not found");
        return {
          success: true,
          message: `Automation ${data.name} queued for execution`,
          data: { automation_id: data.id },
        };
      }

      case "create_study_plan": {
        return {
          success: true,
          message: "Study plan generated (view in response above)",
          data: {},
        };
      }

      default:
        return { success: false, message: `Unknown action type: ${action.type}` };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, message: `Failed to execute action: ${message}` };
  }
}
