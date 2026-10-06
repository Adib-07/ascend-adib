// Ascend Context Engine — server-side retrieval + AI orchestration.
// All database access uses the RLS-enforced client injected by
// requireSupabaseAuth, so retrieval is scoped to the authenticated user.

import type { SupabaseClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { MAX_TOKENS, MODEL, TEMPERATURE } from "./tutor.server";
import {
  buildSystemPrompt,
  buildUserPrompt,
  classifyQuestion,
  enforceBudget,
  isGroundedSource,
  normalizeKeywords,
  rankDocumentChunks,
  SOURCE_TIER,
  type ContextItem,
  type QueryCategory,
} from "./context-engine-core";
import { withAIRetry } from "./retry";

export type { ContextItem, QueryCategory };

// Categories that may surface practical dataset recommendations.
const DATASET_CATEGORIES: QueryCategory[] = ["ACADEMIC", "PROGRAMMING", "GENERAL"];

function buildOrFilter(fields: string[], terms: string[]): string {
  const clean = terms.map((t) => t.replace(/%/g, ""));
  const conds: string[] = [];
  for (const f of fields) {
    for (const t of clean) {
      conds.push(`${f}.ilike.%${t}%`);
    }
  }
  return conds.join(",");
}

interface DatasetRow {
  name: string;
  source: string;
  url: string;
  license: string;
  description: string | null;
  subject_domain: string;
  learning_purpose: string | null;
  provenance: string | null;
  kaggle_slug: string | null;
}

async function retrieveDatasetResources(
  supabase: SupabaseClient,
  terms: string[],
  subject?: string,
): Promise<ContextItem[]> {
  if (terms.length === 0) return [];
  const filter = buildOrFilter(
    ["name", "description", "subject_domain", "learning_purpose"],
    terms,
  );
  const { data, error } = await supabase
    .from("external_datasets")
    .select(
      "name, source, url, license, description, subject_domain, learning_purpose, provenance, kaggle_slug",
    )
    .or(filter)
    .limit(20);
  if (error || !data) return [];

  const rows = data as unknown as DatasetRow[];
  const items: ContextItem[] = [];
  for (const r of rows) {
    const hay =
      `${r.name} ${r.description ?? ""} ${r.subject_domain} ${r.learning_purpose ?? ""}`.toLowerCase();
    let score = 0;
    for (const t of terms) {
      const re = new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
      score += (hay.match(re) || []).length;
    }
    if (subject && r.subject_domain.toLowerCase().includes(subject.toLowerCase())) score += 4;
    if (score === 0) continue;
    items.push({
      source: "dataset",
      title: r.name,
      page: null,
      heading: r.learning_purpose ?? null,
      text: r.description ?? r.name,
      score,
      url: r.url,
      license: r.license,
      provenance: r.provenance ?? r.source,
    });
  }
  return items;
}

export interface AskWithContextResult {
  text: string;
  sources: ContextItem[];
  category: QueryCategory;
}

export interface GroundedContextResult {
  items: ContextItem[]; // user data + structured data, passed to the AI as grounded evidence
  datasets: ContextItem[]; // tier 5, recommendations only (never ingested as answer text)
}

interface DocumentChunkRow {
  content_text: string;
  page_number: number | null;
  heading: string | null;
}

// A user document chunk joined with its parent document metadata. Used to rank
// chunks with the document's filename, type and subject.
interface DocumentJoinRow {
  content_text: string;
  page_number: number | null;
  heading: string | null;
  user_documents?: {
    filename?: string;
    document_type?: string | null;
    subject?: string | null;
  } | null;
}

export async function retrieveDocumentChunks(
  supabase: SupabaseClient,
  userId: string,
  query: string,
  opts: {
    subject?: string;
    category?: QueryCategory;
    documentIds?: string[];
    limit?: number;
  } = {},
): Promise<ContextItem[]> {
  const terms = normalizeKeywords(query);
  if (terms.length === 0) return [];

  let q = supabase
    .from("document_chunks")
    .select("content_text, page_number, heading, user_documents(filename, document_type, subject)")
    .eq("user_id", userId);
  if (opts.documentIds && opts.documentIds.length > 0) {
    q = q.in("document_id", opts.documentIds);
  }
  const orFilter = terms.map((t) => `content_text.ilike.%${t.replace(/%/g, "")}%`).join(",");
  q = q.or(orFilter).limit(opts.limit ?? 80);

  const { data, error } = await q;

  if (error || !data) return [];

  const rows = data as unknown as DocumentJoinRow[];
  const raw = rows.map((r) => {
    const doc = Array.isArray(r.user_documents) ? r.user_documents[0] : r.user_documents;
    return {
      content_text: r.content_text,
      page_number: r.page_number,
      heading: r.heading,
      docTitle: doc?.filename ?? "Untitled document",
      docType: doc?.document_type ?? null,
      docSubject: doc?.subject ?? null,
    };
  });

  return rankDocumentChunks(raw, terms, {
    subject: opts.subject,
    category: opts.category,
    maxItems: 12,
    maxChars: 6000,
  });
}
interface FieldRow {
  [key: string]: unknown;
}

function toMetaValue(v: unknown): string | number | boolean | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
  return String(v);
}

function subjectMatch(
  optsSubject: string | undefined,
  ...values: (string | null | undefined)[]
): boolean {
  if (!optsSubject) return true;
  const s = optsSubject.toLowerCase();
  return values.some((v) => !!v && String(v).toLowerCase().includes(s));
}

export async function retrieveStructured(
  supabase: SupabaseClient,
  userId: string,
  opts: { category?: QueryCategory; subject?: string; terms: string[] },
): Promise<ContextItem[]> {
  const items: ContextItem[] = [];
  const academic = ["ACADEMIC", "EXAM_PREPARATION", "SYLLABUS", "DOCUMENT", "GENERAL"].includes(
    opts.category ?? "",
  );
  const work = ["WORK", "CLIENT", "FREELANCING"].includes(opts.category ?? "");

  const today = new Date().toISOString().split("T")[0];

  // Tasks (always relevant for personal context)
  const { data: tasks } = await supabase
    .from("tasks")
    .select("title, priority, due_date, type, done, mit_slot")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  for (const t of (tasks as FieldRow[] | null) ?? []) {
    if (!subjectMatch(opts.subject, t.title as string, t.type as string)) continue;
    items.push({
      source: "task",
      title: `Task: ${t.title ?? "Untitled"}`,
      page: null,
      heading: null,
      score: t.done ? 1 : 5, // prioritize incomplete tasks
      text: `Priority: ${t.priority ?? "Medium"}. Due: ${t.due_date ?? "none"}. Type: ${t.type ?? "Study"}. Done: ${t.done ? "yes" : "no"}.`,
      metadata: { due_date: toMetaValue(t.due_date), done: toMetaValue(t.done) },
    });
  }

  // Habits
  const { data: habits } = await supabase
    .from("habits")
    .select("name, category, streak, last_done, metric_type, target, frequency")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(15);
  for (const h of (habits as FieldRow[] | null) ?? []) {
    if (!subjectMatch(opts.subject, h.name as string, h.category as string)) continue;
    items.push({
      source: "habit",
      title: `Habit: ${h.name ?? "Untitled"}`,
      page: null,
      heading: null,
      score: 3,
      text: `Category: ${h.category ?? "General"}. Streak: ${h.streak ?? 0}. Target: ${h.target ?? 1} ${h.unit ?? ""}. Frequency: ${h.frequency ?? "daily"}. Last done: ${h.last_done ?? "never"}.`,
      metadata: { streak: toMetaValue(h.streak), last_done: toMetaValue(h.last_done) },
    });
  }

  if (academic) {
    // Learn topics
    const { data: topics } = await supabase
      .from("learn_topics")
      .select("topic, skill, status, progress, difficulty, deadline")
      .eq("user_id", userId)
      .limit(15);
    for (const t of (topics as FieldRow[] | null) ?? []) {
      if (!subjectMatch(opts.subject, t.topic as string, t.skill as string)) continue;
      items.push({
        source: "learn_topic",
        title: `Learn Topic: ${t.topic ?? "Untitled"}`,
        page: null,
        heading: null,
        score: 3,
        text: `Skill: ${t.skill ?? "n/a"}. Status: ${t.status ?? "Not Started"}. Progress: ${t.progress ?? 0}%. Difficulty: ${t.difficulty ?? "Medium"}. Deadline: ${t.deadline ?? "n/a"}.`,
        metadata: { progress: toMetaValue(t.progress), status: toMetaValue(t.status) },
      });
    }

    // Exams
    const { data: exams } = await supabase
      .from("exams")
      .select("name, subject, exam_date, prep_status, syllabus")
      .eq("user_id", userId)
      .limit(8);
    for (const e of (exams as FieldRow[] | null) ?? []) {
      if (!subjectMatch(opts.subject, e.name as string, e.subject as string)) continue;
      const syll = typeof e.syllabus === "string" ? e.syllabus : JSON.stringify(e.syllabus ?? []);
      items.push({
        source: "exam",
        title: `Exam: ${e.name ?? "Untitled"}`,
        page: null,
        heading: null,
        score: 3,
        text: `Subject: ${e.subject ?? "n/a"}. Date: ${e.exam_date ?? "n/a"}. Prep status: ${e.prep_status ?? "Not Started"}. Syllabus: ${syll}`,
        metadata: { exam_date: toMetaValue(e.exam_date), prep_status: toMetaValue(e.prep_status) },
      });
    }

    // Goals
    const { data: goals } = await supabase
      .from("goals")
      .select("scope, text, deadline, done")
      .eq("user_id", userId)
      .limit(8);
    for (const g of (goals as FieldRow[] | null) ?? []) {
      if (!subjectMatch(opts.subject, g.text as string, g.scope as string)) continue;
      items.push({
        source: "goal",
        title: `Goal: ${g.scope ?? "goal"}`,
        page: null,
        heading: null,
        score: g.done ? 1 : 4,
        text: `${g.text ?? ""} (deadline: ${g.deadline ?? "n/a"}, done: ${g.done ? "yes" : "no"})`,
        metadata: { deadline: toMetaValue(g.deadline), done: toMetaValue(g.done) },
      });
    }

    // Notes
    const { data: notes } = await supabase
      .from("notes")
      .select("title, content, tag")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);
    for (const n of (notes as FieldRow[] | null) ?? []) {
      if (!subjectMatch(opts.subject, n.title as string, n.tag as string)) continue;
      items.push({
        source: "note",
        title: `Note: ${n.title ?? "Untitled"}`,
        page: null,
        heading: null,
        score: 2,
        text: `${n.content ?? ""}`,
        metadata: { tag: toMetaValue(n.tag) },
      });
    }

    // Daily intentions
    const { data: intention } = await supabase
      .from("daily_intentions")
      .select("intention")
      .eq("user_id", userId)
      .eq("day", today)
      .maybeSingle();
    if (intention?.intention) {
      items.push({
        source: "note",
        title: "Today's Intention",
        page: null,
        heading: null,
        score: 5,
        text: intention.intention,
        metadata: { day: toMetaValue(today) },
      });
    }
  }

  // Events (today and upcoming)
  const { data: events } = await supabase
    .from("events")
    .select("title, description, start_at, end_at, all_day, location, task_id")
    .eq("user_id", userId)
    .gte("start_at", today)
    .lt("start_at", new Date(new Date(today).getTime() + 86400000).toISOString())
    .order("start_at", { ascending: true })
    .limit(10);
  for (const e of (events as FieldRow[] | null) ?? []) {
    if (!subjectMatch(opts.subject, e.title as string, e.description as string)) continue;
    items.push({
      source: "event",
      title: `Event: ${e.title ?? "Untitled"}`,
      page: null,
      heading: e.location ? `at ${e.location}` : null,
      score: 4,
      text: `${e.all_day ? "All day" : `at ${new Date(e.start_at as string).toLocaleTimeString()}`} - ${e.description ?? ""}`,
      metadata: {
        start_at: toMetaValue(e.start_at),
        end_at: toMetaValue(e.end_at),
        all_day: toMetaValue(e.all_day),
      },
    });
  }

  // Upcoming events (next 7 days)
  const { data: upcomingEvents } = await supabase
    .from("events")
    .select("title, description, start_at, end_at, all_day, location")
    .eq("user_id", userId)
    .gte("start_at", new Date(new Date(today).getTime() + 86400000).toISOString())
    .lt("start_at", new Date(new Date(today).getTime() + 7 * 86400000).toISOString())
    .order("start_at", { ascending: true })
    .limit(10);
  for (const e of (upcomingEvents as FieldRow[] | null) ?? []) {
    if (!subjectMatch(opts.subject, e.title as string, e.description as string)) continue;
    items.push({
      source: "event",
      title: `Upcoming: ${e.title ?? "Untitled"}`,
      page: null,
      heading: e.location ? `at ${e.location}` : null,
      score: 3,
      text: `${new Date(e.start_at as string).toLocaleDateString()} at ${new Date(e.start_at as string).toLocaleTimeString()} - ${e.description ?? ""}`,
      metadata: { start_at: toMetaValue(e.start_at), end_at: toMetaValue(e.end_at) },
    });
  }

  // Reminders (pending, today and upcoming)
  const { data: reminders } = await supabase
    .from("reminders")
    .select("title, message, trigger_at, related_type, related_id")
    .eq("user_id", userId)
    .eq("status", "pending")
    .gte("trigger_at", today)
    .lt("trigger_at", new Date(new Date(today).getTime() + 7 * 86400000).toISOString())
    .order("trigger_at", { ascending: true })
    .limit(10);
  for (const r of (reminders as FieldRow[] | null) ?? []) {
    if (!subjectMatch(opts.subject, r.title as string, r.message as string)) continue;
    items.push({
      source: "reminder",
      title: `Reminder: ${r.title ?? "Untitled"}`,
      page: null,
      heading: r.related_type ? `${r.related_type}:${r.related_id}` : null,
      score: 4,
      text: `${r.message ?? ""} (at ${new Date(r.trigger_at as string).toLocaleTimeString()})`,
      metadata: {
        trigger_at: toMetaValue(r.trigger_at),
        related_type: toMetaValue(r.related_type),
        related_id: toMetaValue(r.related_id),
      },
    });
  }

  if (work) {
    // Clients
    const { data: clients } = await supabase
      .from("clients")
      .select("name, status, platform, niche, revenue")
      .eq("user_id", userId)
      .limit(8);
    for (const c of (clients as FieldRow[] | null) ?? []) {
      if (!subjectMatch(opts.subject, c.name as string, c.niche as string)) continue;
      items.push({
        source: "client",
        title: `Client: ${c.name ?? "Untitled"}`,
        page: null,
        heading: null,
        score: 3,
        text: `Status: ${c.status ?? "Lead"}. Platform: ${c.platform ?? "Direct"}. Niche: ${c.niche ?? "n/a"}. Revenue: ${c.revenue ?? 0}.`,
        metadata: { revenue: toMetaValue(c.revenue) },
      });
    }

    // Work projects
    const { data: projects } = await supabase
      .from("work_projects")
      .select("name, status, progress, deadline")
      .eq("user_id", userId)
      .limit(8);
    for (const p of (projects as FieldRow[] | null) ?? []) {
      if (!subjectMatch(opts.subject, p.name as string)) continue;
      items.push({
        source: "project",
        title: `Project: ${p.name ?? "Untitled"}`,
        page: null,
        heading: null,
        score: 3,
        text: `Status: ${p.status ?? "Planning"}. Progress: ${p.progress ?? 0}%. Deadline: ${p.deadline ?? "n/a"}.`,
        metadata: { progress: toMetaValue(p.progress), deadline: toMetaValue(p.deadline) },
      });
    }
  }

  // Apply subject filter and scoring
  return items.filter((i) => i.score > 0);
}

// Tier-prioritized retrieval for grounded context.
export async function retrieveGroundedContext(
  supabase: SupabaseClient,
  userId: string,
  query: string,
  opts: { subject?: string; category?: QueryCategory; includeDatasets?: boolean } = {},
): Promise<GroundedContextResult> {
  const category = opts.category ?? classifyQuestion(query);
  const terms = normalizeKeywords(query);

  const docItems = await retrieveDocumentChunks(supabase, userId, query, {
    subject: opts.subject,
    category,
  });
  const structured = await retrieveStructured(supabase, userId, {
    category,
    subject: opts.subject,
    terms,
  });

  const useDatasets = opts.includeDatasets ?? DATASET_CATEGORIES.includes(category);
  const datasetItems = useDatasets
    ? await retrieveDatasetResources(supabase, terms, opts.subject)
    : [];

  // Grounded evidence for the AI: user docs + structured
  const grounded = [...docItems, ...structured];
  grounded.sort((a, b) => {
    const ta = SOURCE_TIER[a.source];
    const tb = SOURCE_TIER[b.source];
    if (ta !== tb) return ta - tb;
    return b.score - a.score;
  });
  const items = enforceBudget(grounded, 16, 7000);

  // Datasets: keep only the strongest few for the recommendation block.
  datasetItems.sort((a, b) => b.score - a.score);
  const datasets = datasetItems.slice(0, 4);

  return { items, datasets };
}

export async function askWithContextImpl({
  supabase,
  userId,
  question,
  subject,
  category: providedCategory,
}: {
  supabase: SupabaseClient;
  userId: string;
  question: string;
  subject?: string;
  category?: QueryCategory;
  mode?: "student" | "work";
}): Promise<AskWithContextResult> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("AI service not configured");

  const category = providedCategory ?? classifyQuestion(question);
  const terms = normalizeKeywords(question);

  const docItems = await retrieveDocumentChunks(supabase, userId, question, {
    subject,
    category,
  });
  const structured = await retrieveStructured(supabase, userId, {
    category,
    subject,
    terms,
  });

  const items = [...docItems, ...structured].sort((a, b) => b.score - a.score);

  const system = buildSystemPrompt(category);
  const user = buildUserPrompt(question, items);

  const gateway = createLovableAiGatewayProvider(key);
  const { text } = await withAIRetry<{ text: string }>(async () => {
    const result = await generateText({
      model: gateway(MODEL),
      temperature: TEMPERATURE,
      maxOutputTokens: Math.min(4000, MAX_TOKENS + 1000),
      system,
      prompt: user,
    });
    if (!result.text?.trim()) throw new Error("Empty response from AI");
    return { text: result.text };
  });

  return { text, sources: items, category };
}

// ============================================================================
// NEW: Student Profile & Revision Retrieval (for Unified Tutor)
// ============================================================================

export interface StudentProfile {
  topics: any[];
  exams: any[];
  goals: any[];
  recentErrors: any[];
  dsaProgress: any[];
  dueRevisions?: RevisionItem[];
  weakAreas?: WeakArea[];
}

export interface RevisionItem {
  id: string;
  source_type: string;
  source_id: string;
  source_title: string;
  next_review_date: string;
  priority_boost: number;
}

export interface WeakArea {
  type: string;
  concept: string;
  frequency: number;
  source: string;
}

export async function getStudentProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<StudentProfile> {
  const [topics, exams, goals, recentErrors, dsaProgress] = await Promise.all([
    supabase
      .from("learn_topics")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(50),
    supabase
      .from("exams")
      .select("*")
      .eq("user_id", userId)
      .order("exam_date", { ascending: true })
      .limit(10),
    supabase.from("goals").select("*").eq("user_id", userId).eq("done", false).limit(10),
    supabase
      .from("error_log")
      .select("*")
      .eq("user_id", userId)
      .order("frequency", { ascending: false })
      .limit(20),
    supabase
      .from("dsa_attempts")
      .select("*")
      .eq("user_id", userId)
      .order("attempted_at", { ascending: false })
      .limit(50),
  ]);

  return {
    topics: topics.data ?? [],
    exams: exams.data ?? [],
    goals: goals.data ?? [],
    recentErrors: recentErrors.data ?? [],
    dsaProgress: dsaProgress.data ?? [],
  };
}

export async function getDueRevisions(
  supabase: SupabaseClient,
  userId: string,
): Promise<RevisionItem[]> {
  const today = new Date().toISOString().split("T")[0];
  const { data, error } = await supabase
    .from("revision_schedule")
    .select("*")
    .eq("user_id", userId)
    .lte("next_review_date", today)
    .order("priority_boost", { ascending: false })
    .order("next_review_date", { ascending: true })
    .limit(20);

  if (error || !data) return [];
  return data as unknown as RevisionItem[];
}

export async function getWeakAreas(supabase: SupabaseClient, userId: string): Promise<WeakArea[]> {
  const weakAreas: WeakArea[] = [];

  // From error_log (frequency > 1)
  const { data: errors } = await supabase
    .from("error_log")
    .select("error_type, concept, frequency, context")
    .eq("user_id", userId)
    .gt("frequency", 1)
    .order("frequency", { ascending: false })
    .limit(10);

  for (const e of errors ?? []) {
    weakAreas.push({
      type: e.error_type,
      concept: e.concept,
      frequency: e.frequency,
      source: `error_log (${e.context ?? "unknown"})`,
    });
  }

  // From learn_topics (mastery < 3)
  const { data: weakTopics } = await supabase
    .from("learn_topics")
    .select("topic, language, mastery_level")
    .eq("user_id", userId)
    .lt("mastery_level", 3)
    .gt("progress", 0)
    .order("mastery_level", { ascending: true })
    .limit(10);

  for (const t of weakTopics ?? []) {
    weakAreas.push({
      type: "concept",
      concept: t.topic,
      frequency: 5 - (t.mastery_level ?? 0),
      source: `learn_topic (${t.language ?? "N/A"}, mastery ${t.mastery_level ?? 0}/5)`,
    });
  }

  // From dsa_attempts (mastery < 3)
  const { data: weakDsa } = await supabase
    .from("dsa_attempts")
    .select("pattern, mastery_level")
    .eq("user_id", userId)
    .lt("mastery_level", 3)
    .gt("mastery_level", 0)
    .order("mastery_level", { ascending: true })
    .limit(10);

  for (const d of weakDsa ?? []) {
    if (d.pattern) {
      weakAreas.push({
        type: "pattern",
        concept: d.pattern,
        frequency: 5 - (d.mastery_level ?? 0),
        source: `dsa_attempt (mastery ${d.mastery_level ?? 0}/5)`,
      });
    }
  }

  // Deduplicate by concept, keep highest frequency
  const deduped = new Map<string, WeakArea>();
  for (const w of weakAreas) {
    const existing = deduped.get(w.concept);
    if (!existing || w.frequency > existing.frequency) {
      deduped.set(w.concept, w);
    }
  }

  return Array.from(deduped.values())
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 15);
}
