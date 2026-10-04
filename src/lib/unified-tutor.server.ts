import type { SupabaseClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { MAX_TOKENS, MODEL, TEMPERATURE } from "./tutor.server";
import {
  retrieveDocumentChunks,
  retrieveStructured,
  retrieveGroundedContext,
  getStudentProfile,
  getDueRevisions,
  getWeakAreas,
  type ContextItem,
  type QueryCategory,
  type StudentProfile,
  type WeakArea,
  type RevisionItem,
} from "./context-engine.server";
import { buildUnifiedSystemPrompt, buildUnifiedUserPrompt } from "./unified-tutor-prompts";

export interface UnifiedTutorResult {
  text: string;
  sources: ContextItem[];
  datasets: ContextItem[];
  sessionId: string;
  mode: string;
  grounded: boolean;
  syllabusMatch: boolean | null;
  actions?: TutorAction[];
  mission?: DailyMission;
  masteryUpdate?: MasteryUpdate;
}

export interface TutorAction {
  type:
    | "create_dsa_attempt"
    | "create_programming_exercise"
    | "schedule_revision"
    | "log_error"
    | "update_learn_topic"
    | "recommend_resource";
  payload: any;
}

export interface DailyMission {
  date: string;
  availableMinutes: number;
  blocks: MissionBlock[];
}

export interface MissionBlock {
  type: "revision" | "concept" | "coding" | "dsa" | "project" | "review";
  durationMin: number;
  topic: string;
  details: string;
  priority: number;
  resources?: { title: string; url: string; type: string }[];
}

export interface MasteryUpdate {
  entityType: "dsa_attempt" | "programming_exercise" | "learn_topic";
  entityId: string;
  newMasteryLevel: number;
  nextReviewDate: string;
}

export interface UnifiedTutorInput {
  supabase: SupabaseClient;
  userId: string;
  mode:
    | "TEACH"
    | "PRACTICE"
    | "EVALUATE"
    | "EXAM"
    | "CODING"
    | "DEBUG"
    | "PROJECT"
    | "CHAT"
    | "DAILY_PLAN";
  message: string;
  subject?: string;
  language?: "C" | "Python" | "C++" | "HTML" | "CSS";
  level?: "simple" | "normal" | "technical";
  questionType?: "mcq" | "short" | "conceptual" | "numerical" | "coding";
  userAnswer?: string;
  sessionId?: string;
  availableMinutes?: number;
  examDate?: string;
  history?: { role: "user" | "assistant" | "system"; content: string }[];
}

async function getOrCreateSession(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string | undefined,
  mode: string,
  subject?: string,
  language?: string,
  contextSnapshot?: any,
): Promise<string> {
  if (sessionId) {
    const { data: existing } = await supabase
      .from("tutor_sessions")
      .select("id")
      .eq("id", sessionId)
      .eq("user_id", userId)
      .maybeSingle();
    if (existing) return existing.id;
  }

  const { data: session, error } = await supabase
    .from("tutor_sessions")
    .insert({
      user_id: userId,
      mode,
      subject,
      language,
      context_snapshot: contextSnapshot,
    })
    .select("id")
    .single();

  if (error || !session) throw new Error("Failed to create tutor session");
  return session.id;
}

async function saveMessage(
  supabase: SupabaseClient,
  sessionId: string,
  userId: string,
  role: "user" | "assistant" | "system",
  content: string,
  metadata?: {
    sources?: ContextItem[];
    datasets?: ContextItem[];
    grounded?: boolean;
    syllabusMatch?: boolean | null;
    mode?: string;
    metadata?: any;
  },
): Promise<void> {
  const { error } = await supabase.from("tutor_messages").insert({
    session_id: sessionId,
    user_id: userId,
    role,
    content,
    sources: metadata?.sources ?? null,
    datasets: metadata?.datasets ?? null,
    grounded: metadata?.grounded ?? null,
    syllabus_match: metadata?.syllabusMatch ?? null,
    mode: metadata?.mode ?? null,
    metadata: metadata?.metadata ?? null,
  });

  if (error) console.error("Failed to save tutor message:", error);

  await supabase
    .from("tutor_sessions")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", sessionId);
}

async function getConversationHistory(
  supabase: SupabaseClient,
  sessionId: string,
  limit = 20,
): Promise<{ role: "user" | "assistant" | "system"; content: string }[]> {
  const { data } = await supabase
    .from("tutor_messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(limit);

  return (data ?? []).map((m) => ({ role: m.role as any, content: m.content }));
}

function classifyCategory(mode: string, message: string): QueryCategory {
  if (mode === "EXAM") return "EXAM_PREPARATION";
  if (mode === "PRACTICE" || mode === "EVALUATE") return "ACADEMIC";
  if (mode === "CODING" || mode === "DEBUG") return "PROGRAMMING";
  const msg = message.toLowerCase();
  if (msg.includes("exam") || msg.includes("revision") || msg.includes("prepare"))
    return "EXAM_PREPARATION";
  if (
    msg.includes("code") ||
    msg.includes("debug") ||
    msg.includes("program") ||
    msg.includes("function")
  )
    return "PROGRAMMING";
  return "ACADEMIC";
}

export async function unifiedTutorImpl(input: UnifiedTutorInput): Promise<UnifiedTutorResult> {
  const {
    supabase,
    userId,
    mode,
    message,
    subject,
    language,
    level,
    questionType,
    userAnswer,
    sessionId,
    availableMinutes,
    history,
  } = input;

  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("AI service not configured");

  // 1. Get student profile
  const profile = await getStudentProfile(supabase, userId);

  // 2. Get due revisions
  const dueRevisions = await getDueRevisions(supabase, userId);

  // 3. Get weak areas
  const weakAreas = await getWeakAreas(supabase, userId);

  // 4. Enrich profile with computed data
  const enrichedProfile: StudentProfile = {
    ...profile,
    dueRevisions,
    weakAreas,
  };

  // 5. Get or create session
  const contextSnapshot = {
    topicsCount: profile.topics.length,
    examsCount: profile.exams.length,
    weakAreasCount: weakAreas.length,
    dueRevisionsCount: dueRevisions.length,
  };
  const resolvedSessionId = await getOrCreateSession(
    supabase,
    userId,
    sessionId,
    mode,
    subject,
    language,
    contextSnapshot,
  );

  // 6. Get conversation history
  const conversationHistory = sessionId
    ? await getConversationHistory(supabase, resolvedSessionId)
    : [];
  const fullHistory = [...conversationHistory, ...(history ?? [])].slice(-20);

  // 7. Retrieve grounded context
  const category = classifyCategory(mode, message);
  const { items: groundedItems, datasets } = await retrieveGroundedContext(
    supabase,
    userId,
    message,
    {
      subject,
      category,
      includeDatasets: true,
    },
  );

  // 8. Build prompts
  const system = buildUnifiedSystemPrompt(mode, enrichedProfile, {
    level,
    subject,
    language,
    questionType,
  });
  const user = buildUnifiedUserPrompt(message, groundedItems, { userAnswer, history: fullHistory });

  // 9. Save user message
  await saveMessage(supabase, resolvedSessionId, userId, "user", message, { mode });

  // 10. Call AI
  const gateway = createLovableAiGatewayProvider(key);
  const { text } = await generateText({
    model: gateway(MODEL),
    temperature: TEMPERATURE,
    maxOutputTokens: Math.min(4000, MAX_TOKENS + 1000),
    system,
    prompt: user,
  });

  if (!text?.trim()) throw new Error("Empty response from AI");

  // 11. Determine grounding
  const grounded = groundedItems.some(
    (i) =>
      i.source === "document" ||
      i.source === "learn_topic" ||
      i.source === "curated" ||
      i.source === "official",
  );
  const syllabusMatch = profile.topics.some((t) =>
    message.toLowerCase().includes(t.topic.toLowerCase()),
  );

  // 12. Save assistant message
  await saveMessage(supabase, resolvedSessionId, userId, "assistant", text, {
    sources: groundedItems,
    datasets,
    grounded,
    syllabusMatch,
    mode,
  });

  // 13. Handle mode-specific actions
  const actions: TutorAction[] = [];

  if (mode === "DAILY_PLAN") {
    try {
      const mission = JSON.parse(text);
      return {
        text,
        sources: groundedItems,
        datasets,
        sessionId: resolvedSessionId,
        mode,
        grounded,
        syllabusMatch,
        mission,
      };
    } catch {
      // If not valid JSON, return as-is
    }
  }

  return {
    text,
    sources: groundedItems,
    datasets,
    sessionId: resolvedSessionId,
    mode,
    grounded,
    syllabusMatch,
    actions,
  };
}
