// Ascend Student AI Tutor — server-side orchestration.
// Reuses the Stage 5E context engine (retrieveDocumentChunks + retrieveStructured,
// both RLS-scoped to the authenticated user) and the existing Lovable AI Gateway.
// No static datasets, no embeddings, no duplicated retrieval logic.

import type { SupabaseClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { MAX_TOKENS, MODEL, TEMPERATURE } from "./tutor.server";
import {
  classifyQuestion,
  isGroundedSource,
  normalizeKeywords,
  type ContextItem,
  type QueryCategory,
} from "./context-engine-core";
import {
  retrieveDocumentChunks,
  retrieveGroundedContext,
  retrieveStructured,
} from "./context-engine.server";
import {
  buildGroundedSystem,
  buildGroundedUser,
  buildTutorSystem,
  buildTutorUser,
  type QuestionType,
  type TutorLevel,
  type TutorMode,
} from "./student-tutor-core";

export interface StudentTutorResult {
  text: string;
  sources: ContextItem[];
  mode: TutorMode;
  category: QueryCategory;
}

export interface GroundedTutorResult {
  text: string;
  sources: ContextItem[];
  datasets: ContextItem[];
  mode: TutorMode;
  category: QueryCategory;
  grounded: boolean;
  syllabusMatch: boolean | null;
}

// Retrieval + prompt assembly only (no AI call). Kept separate so it can be
// unit-tested with a mock Supabase client (proves RLS scoping + prompt building).
export async function prepareTutorContext({
  supabase,
  userId,
  mode,
  message,
  subject,
  level,
  questionType,
  userAnswer,
  history,
}: {
  supabase: SupabaseClient;
  userId: string;
  mode: TutorMode;
  message: string;
  subject?: string;
  level?: TutorLevel;
  questionType?: QuestionType;
  userAnswer?: string;
  history?: { role: "user" | "assistant" | "system"; content: string }[];
}): Promise<{
  system: string;
  user: string;
  sources: ContextItem[];
  category: QueryCategory;
  mode: TutorMode;
}> {
  const category: QueryCategory =
    mode === "EXAM"
      ? "EXAM_PREPARATION"
      : mode === "PRACTICE" || mode === "EVALUATE"
        ? "ACADEMIC"
        : classifyQuestion(message);

  const docItems = await retrieveDocumentChunks(supabase, userId, message, {
    subject,
    category,
  });
  const structured = await retrieveStructured(supabase, userId, {
    category,
    subject,
    terms: normalizeKeywords(message),
  });

  const sources = [...docItems, ...structured].sort((a, b) => b.score - a.score);
  const system = buildTutorSystem(mode, { level, subject, questionType });
  const user = buildTutorUser({ message, items: sources, userAnswer, history });

  return { system, user, sources, category, mode };
}

export async function studentTutorImpl({
  supabase,
  userId,
  mode,
  message,
  subject,
  level,
  questionType,
  userAnswer,
  history,
}: {
  supabase: SupabaseClient;
  userId: string;
  mode: TutorMode;
  message: string;
  subject?: string;
  level?: TutorLevel;
  questionType?: QuestionType;
  userAnswer?: string;
  history?: { role: "user" | "assistant" | "system"; content: string }[];
}): Promise<StudentTutorResult> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("AI service not configured");

  const { system, user, sources, category } = await prepareTutorContext({
    supabase,
    userId,
    mode,
    message,
    subject,
    level,
    questionType,
    userAnswer,
    history,
  });

  const gateway = createLovableAiGatewayProvider(key);
  const { text } = await generateText({
    model: gateway(MODEL),
    temperature: TEMPERATURE,
    maxOutputTokens: Math.min(4000, MAX_TOKENS + 1000),
    system,
    prompt: user,
  });

  if (!text?.trim()) throw new Error("Empty response from AI");

  return { text, sources, mode, category };
}

// Returns true if the query overlaps with the user's learn_topics; null when the
// user has no topics (so the UI does not show a misleading "outside syllabus").
async function computeSyllabusMatch(
  supabase: SupabaseClient,
  userId: string,
  query: string,
): Promise<boolean | null> {
  const { data, error } = await supabase
    .from("learn_topics")
    .select("topic, skill")
    .eq("user_id", userId)
    .limit(50);
  if (error || !data || data.length === 0) return null;

  const terms = normalizeKeywords(query);
  if (terms.length === 0) return true;

  const hay = (data as { topic: string; skill: string | null }[])
    .map((t) => `${t.topic} ${t.skill ?? ""}`.toLowerCase())
    .join(" ");
  const matched = terms.some((t) => hay.includes(t));
  return matched;
}

export async function groundedTutorImpl({
  supabase,
  userId,
  mode,
  message,
  subject,
  level,
  questionType,
  userAnswer,
  history,
}: {
  supabase: SupabaseClient;
  userId: string;
  mode: TutorMode;
  message: string;
  subject?: string;
  level?: TutorLevel;
  questionType?: QuestionType;
  userAnswer?: string;
  history?: { role: "user" | "assistant" | "system"; content: string }[];
}): Promise<GroundedTutorResult> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("AI service not configured");

  const category: QueryCategory =
    mode === "EXAM"
      ? "EXAM_PREPARATION"
      : mode === "PRACTICE" || mode === "EVALUATE"
        ? "ACADEMIC"
        : classifyQuestion(message);

  const { items, datasets } = await retrieveGroundedContext(supabase, userId, message, {
    subject,
    category,
    includeDatasets: true,
  });

  const grounded = items.some((i) => isGroundedSource(i.source));
  const syllabusMatch = await computeSyllabusMatch(supabase, userId, message);

  const system = buildGroundedSystem(mode, { level, subject, questionType });
  const user = buildGroundedUser({ message, items, userAnswer, history });

  const gateway = createLovableAiGatewayProvider(key);
  const { text } = await generateText({
    model: gateway(MODEL),
    temperature: TEMPERATURE,
    maxOutputTokens: Math.min(4000, MAX_TOKENS + 1000),
    system,
    prompt: user,
  });

  if (!text?.trim()) throw new Error("Empty response from AI");

  return { text, sources: items, datasets, mode, category, grounded, syllabusMatch };
}
