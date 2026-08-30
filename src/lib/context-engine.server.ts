// Ascend Context Engine — server-side retrieval + AI orchestration.
// All database access uses the RLS-enforced client injected by
// requireSupabaseAuth, so retrieval is scoped to the authenticated user.
// No static datasets, no embeddings, no pgvector.

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

export type { ContextItem, QueryCategory };

// Sources whose educational resources are considered "official documentation"
// (vendor-authored reference material) rather than curated third-party OER.
const OFFICIAL_SOURCES = new Set([
  "Python Software Foundation",
  "Mozilla",
  "NumPy",
  "Pandas",
  "scikit-learn",
  "PyTorch",
  "TensorFlow",
  "Google",
]);

// Categories that may pull from curated / official reference material.
const REFERENCE_CATEGORIES: QueryCategory[] = [
  "ACADEMIC",
  "PROGRAMMING",
  "EXAM_PREPARATION",
  "SYLLABUS",
  "DOCUMENT",
  "GENERAL",
];

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

interface ResourceRow {
  title: string;
  source: string;
  url: string;
  license: string;
  description: string | null;
  subject_domain: string;
  learning_purpose: string | null;
  provenance: string | null;
}

function scoreResource(row: ResourceRow, terms: string[]): number {
  const hay =
    `${row.title} ${row.description ?? ""} ${row.subject_domain} ${row.learning_purpose ?? ""}`.toLowerCase();
  let score = 0;
  for (const t of terms) {
    const re = new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
    score += (hay.match(re) || []).length;
  }
  return score;
}

async function retrieveEducationalResources(
  supabase: SupabaseClient,
  terms: string[],
  subject?: string,
): Promise<ContextItem[]> {
  if (terms.length === 0) return [];
  const filter = buildOrFilter(
    ["title", "description", "subject_domain", "learning_purpose"],
    terms,
  );
  const { data, error } = await supabase
    .from("educational_resources")
    .select(
      "title, source, url, license, description, subject_domain, learning_purpose, provenance",
    )
    .or(filter)
    .limit(40);
  if (error || !data) return [];

  const rows = data as unknown as ResourceRow[];
  const items: ContextItem[] = [];
  for (const r of rows) {
    let score = scoreResource(r, terms);
    if (score === 0) continue;
    if (subject && r.subject_domain.toLowerCase().includes(subject.toLowerCase())) score += 4;
    const isOfficial = OFFICIAL_SOURCES.has(r.source);
    items.push({
      source: isOfficial ? "official" : "curated",
      title: r.title,
      page: null,
      heading: r.learning_purpose ?? null,
      text: r.description ?? r.title,
      score: isOfficial ? score + 2 : score,
      url: r.url,
      license: r.license,
      provenance: r.provenance ?? r.source,
    });
  }
  return items;
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
  opts: { subject?: string; category?: QueryCategory } = {},
): Promise<ContextItem[]> {
  const terms = normalizeKeywords(query);
  if (terms.length === 0) return [];

  const orFilter = terms.map((t) => `content_text.ilike.%${t.replace(/%/g, "")}%`).join(",");

  const { data, error } = await supabase
    .from("document_chunks")
    .select("content_text, page_number, heading, user_documents(filename, document_type, subject)")
    .eq("user_id", userId)
    .or(orFilter)
    .limit(80);

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

  const subjectMatch = (...values: (string | null | undefined)[]): boolean => {
    if (!opts.subject) return true;
    const s = opts.subject.toLowerCase();
    return values.some((v) => !!v && String(v).toLowerCase().includes(s));
  };

  if (academic) {
    const { data: topics } = await supabase
      .from("learn_topics")
      .select("topic, skill, status, progress, difficulty, deadline")
      .eq("user_id", userId)
      .limit(12);
    for (const t of (topics as FieldRow[] | null) ?? []) {
      if (!subjectMatch(t.topic as string, t.skill as string)) continue;
      items.push({
        source: "learn_topic",
        title: (t.topic as string) ?? "Topic",
        page: null,
        heading: null,
        score: 3,
        text: `Skill: ${t.skill ?? "n/a"}. Status: ${t.status ?? "n/a"}. Progress: ${t.progress ?? 0}%. Difficulty: ${t.difficulty ?? "n/a"}. Deadline: ${t.deadline ?? "n/a"}.`,
      });
    }

    const { data: exams } = await supabase
      .from("exams")
      .select("name, subject, exam_date, prep_status, syllabus")
      .eq("user_id", userId)
      .limit(6);
    for (const e of (exams as FieldRow[] | null) ?? []) {
      const syll = typeof e.syllabus === "string" ? e.syllabus : JSON.stringify(e.syllabus ?? []);
      items.push({
        source: "exam",
        title: `Exam: ${e.name ?? "Untitled"}`,
        page: null,
        heading: null,
        score: 3,
        text: `Subject: ${e.subject ?? "n/a"}. Date: ${e.exam_date ?? "n/a"}. Prep status: ${e.prep_status ?? "n/a"}. Syllabus: ${syll}`,
      });
    }

    const { data: goals } = await supabase
      .from("goals")
      .select("scope, text, deadline, done")
      .eq("user_id", userId)
      .limit(6);
    for (const g of (goals as FieldRow[] | null) ?? []) {
      items.push({
        source: "goal",
        title: `${g.scope ?? "goal"} goal`,
        page: null,
        heading: null,
        score: 2,
        text: `${g.text ?? ""} (deadline: ${g.deadline ?? "n/a"}, done: ${g.done ?? false})`,
      });
    }
  }

  if (work) {
    const { data: clients } = await supabase
      .from("clients")
      .select("name, status, platform, niche, revenue")
      .eq("user_id", userId)
      .limit(6);
    for (const c of (clients as FieldRow[] | null) ?? []) {
      items.push({
        source: "client",
        title: `Client: ${c.name ?? "Untitled"}`,
        page: null,
        heading: null,
        score: 3,
        text: `Status: ${c.status ?? "n/a"}. Platform: ${c.platform ?? "n/a"}. Niche: ${c.niche ?? "n/a"}. Revenue: ${c.revenue ?? 0}.`,
      });
    }

    const { data: projects } = await supabase
      .from("work_projects")
      .select("name, status, progress, deadline")
      .eq("user_id", userId)
      .limit(6);
    for (const p of (projects as FieldRow[] | null) ?? []) {
      items.push({
        source: "project",
        title: `Project: ${p.name ?? "Untitled"}`,
        page: null,
        heading: null,
        score: 3,
        text: `Status: ${p.status ?? "n/a"}. Progress: ${p.progress ?? 0}%. Deadline: ${p.deadline ?? "n/a"}.`,
      });
    }
  }

  return items;
}

export interface GroundedContextResult {
  items: ContextItem[]; // tiers 1-4, passed to the AI as grounded evidence
  datasets: ContextItem[]; // tier 5, recommendations only (never ingested as answer text)
}

// Tier-prioritized retrieval for the grounded tutor. Reuses the existing
// user-scoped retrievers and adds curated/official reference material plus
// (relevant) dataset recommendations. Dataset items are returned separately so
// they are shown as practice suggestions, never as answer-source text.
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

  const useReference = REFERENCE_CATEGORIES.includes(category);
  const referenceItems = useReference
    ? await retrieveEducationalResources(supabase, terms, opts.subject)
    : [];

  const useDatasets = opts.includeDatasets ?? DATASET_CATEGORIES.includes(category);
  const datasetItems = useDatasets
    ? await retrieveDatasetResources(supabase, terms, opts.subject)
    : [];

  // Grounded evidence for the AI: user docs + structured + curated/official.
  const grounded = [...docItems, ...structured, ...referenceItems];
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
  const { text } = await generateText({
    model: gateway(MODEL),
    temperature: TEMPERATURE,
    maxOutputTokens: Math.min(4000, MAX_TOKENS + 1000),
    system,
    prompt: user,
  });

  if (!text?.trim()) throw new Error("Empty response from AI");

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
  userId: string
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
    supabase
      .from("goals")
      .select("*")
      .eq("user_id", userId)
      .eq("done", false)
      .limit(10),
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
    topics: (topics.data ?? []) as any[],
    exams: (exams.data ?? []) as any[],
    goals: (goals.data ?? []) as any[],
    recentErrors: (recentErrors.data ?? []) as any[],
    dsaProgress: (dsaProgress.data ?? []) as any[],
  };
}

export async function getDueRevisions(
  supabase: SupabaseClient,
  userId: string
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

export async function getWeakAreas(
  supabase: SupabaseClient,
  userId: string
): Promise<WeakArea[]> {
  const weakAreas: WeakArea[] = [];

  // From error_log (frequency > 1)
  const { data: errors } = await supabase
    .from("error_log")
    .select("error_type, concept, frequency, context")
    .eq("user_id", userId)
    .gt("frequency", 1)
    .order("frequency", { ascending: false })
    .limit(10);

  for (const e of (errors ?? []) as any[]) {
    weakAreas.push({
      type: e.error_type,
      concept: e.concept,
      frequency: e.frequency,
      source: `error_log (${e.context ?? 'unknown'})`,
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

  for (const t of (weakTopics ?? []) as any[]) {
    weakAreas.push({
      type: "concept",
      concept: t.topic,
      frequency: 5 - (t.mastery_level ?? 0),
      source: `learn_topic (${t.language ?? 'N/A'}, mastery ${t.mastery_level ?? 0}/5)`,
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

  for (const d of (weakDsa ?? []) as any[]) {
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
