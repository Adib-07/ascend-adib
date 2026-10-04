// Ascend Context Engine — pure logic (no DB / no AI imports).
// This module is intentionally dependency-free so it can be unit-tested
// without a database or network access.

export type QueryCategory =
  | "ACADEMIC"
  | "PROGRAMMING"
  | "EXAM_PREPARATION"
  | "SYLLABUS"
  | "DOCUMENT"
  | "ENGLISH"
  | "LIFE_SKILLS"
  | "GENERAL"
  | "WORK"
  | "CLIENT"
  | "FREELANCING";

export type ContextSource =
  | "task"
  | "goal"
  | "project"
  | "habit"
  | "note"
  | "learn_topic"
  | "exam"
  | "client"
  | "dataset"
  | "curated"
  | "official"
  | "document"
  | "event"
  | "reminder";

// Priority tiers for grounded retrieval (1 = highest). Used to order evidence
// when multiple source types are relevant to a query.
export const SOURCE_TIER: Record<ContextSource, number> = {
  task: 1,
  goal: 1,
  learn_topic: 1,
  exam: 2,
  habit: 2,
  note: 2,
  project: 2,
  client: 2,
  event: 2,
  reminder: 2,
  curated: 3,
  official: 4,
  dataset: 5,
  document: 1,
};

export interface ContextItem {
  source: ContextSource;
  title: string;
  page: number | null;
  heading: string | null;
  text: string;
  score: number;
  url?: string;
  license?: string;
  provenance?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

// True when the item is grounded in an external reference source (used to decide
// whether the final answer is "grounded" vs "AI-generated").
export function isGroundedSource(source: ContextSource): boolean {
  return (
    source === "curated" ||
    source === "official" ||
    source === "task" ||
    source === "goal" ||
    source === "learn_topic" ||
    source === "exam" ||
    source === "habit" ||
    source === "note" ||
    source === "project" ||
    source === "client"
  );
}

// Terms that carry little retrieval signal.
const STOPWORDS = new Set<string>([
  "the","and","for","are","but","not","you","all","any","can","had","her","was",
  "one","our","out","day","get","has","him","his","how","man","new","now","old",
  "see","two","way","who","boy","did","its","let","put","say","she","too","use",
  "that","this","with","from","they","will","would","there","their","what","when",
  "where","which","while","about","into","over","than","then","them","these",
  "those","your","have","been","were","does","doing","should","could","please",
  "explain","describe","tell","me","my","give","make","help","need","want",
  "question","answer",
]);

export function normalizeKeywords(query: string): string[] {
  const cleaned = query.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
  const terms = cleaned
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
  return Array.from(new Set(terms));
}

const CATEGORY_KEYWORDS: Record<QueryCategory, string[]> = {
  ACADEMIC: [
    "study","subject","topic","learn","course","chapter","lecture","physics",
    "chemistry","math","mathematics","engineering","biology","derivative",
    "integral","theorem","formula","concept","theory",
  ],
  PROGRAMMING: [
    "code","coding","program","python","javascript","function","debug",
    "algorithm","leetcode","bug","syntax","react","typescript","api",
    "database","query","variable","class","object",
  ],
  EXAM_PREPARATION: [
    "exam","revision","revise","prepare","preparation","mock","test",
    "practice paper","previous year","question paper","solve",
  ],
  SYLLABUS: ["syllabus","curriculum","topics covered","course outline","units"],
  DOCUMENT: [
    "document","pdf","notes","uploaded","file","my notes","attachment",
    "handout","slide","slides",
  ],
  ENGLISH: [
    "english","grammar","vocabulary","fluency","pronounce","pronunciation",
    "speak","speaking","interview","communication","email","writing",
  ],
  LIFE_SKILLS: [
    "habit","focus","negotiate","productivity","money","finance",
    "leadership","mindset","discipline","routine","time","consistency",
    "motivation","soft skill",
  ],
  GENERAL: [],
  WORK: [
    "client","project","invoice","proposal","freelance","freelancing",
    "upwork","fiverr","contract","scope","deliverable","meeting",
    "stakeholder","deadline",
  ],
  CLIENT: [
    "client","prospect","lead","outreach","onboarding","retainer",
    "account","relationship",
  ],
  FREELANCING: [
    "freelance","freelancing","upwork","fiverr","gig","bid",
    "proposal","contract","rate","negotiate",
  ],
};

export function classifyQuestion(query: string): QueryCategory {
  const q = query.toLowerCase();
  let best: QueryCategory = "GENERAL";
  let bestScore = 0;
  for (const category of Object.keys(CATEGORY_KEYWORDS) as QueryCategory[]) {
    let score = 0;
    for (const kw of CATEGORY_KEYWORDS[category]) {
      if (q.includes(kw)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = category;
    }
  }
  return best;
}

// Maps a query category to the document types that are most relevant for it.
// Used to bias chunk ranking so that, e.g., a SYLLABUS query prefers syllabus
// pages over unrelated client documents.
const CATEGORY_DOC_TYPES: Partial<Record<QueryCategory, string[]>> = {
  ACADEMIC: ["syllabus", "lecture_notes", "study_material", "textbook", "exam_prep"],
  EXAM_PREPARATION: ["syllabus", "lecture_notes", "study_material", "exam_prep"],
  SYLLABUS: ["syllabus"],
  PROGRAMMING: ["study_material", "textbook", "lecture_notes"],
  ENGLISH: ["study_material", "lecture_notes"],
  LIFE_SKILLS: ["study_material", "other"],
  WORK: ["client_requirements", "other"],
  CLIENT: ["client_requirements", "other"],
  FREELANCING: ["client_requirements", "other"],
  DOCUMENT: [],
};

export interface RawDocChunk {
  content_text: string;
  page_number: number | null;
  heading: string | null;
  docTitle: string;
  docType: string | null;
  docSubject: string | null;
}

function escapeRegex(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function rankDocumentChunks(
  chunks: RawDocChunk[],
  terms: string[],
  opts: {
    subject?: string;
    category?: QueryCategory;
    maxItems?: number;
    maxChars?: number;
  } = {},
): ContextItem[] {
  const maxItems = opts.maxItems ?? 12;
  const maxChars = opts.maxChars ?? 6000;
  const wantedTypes = opts.category ? CATEGORY_DOC_TYPES[opts.category] : null;

  const scored = chunks.map((c) => {
    const hay = c.content_text.toLowerCase();
    let termScore = 0;
    for (const term of terms) {
      const re = new RegExp(escapeRegex(term), "g");
      const hits = (hay.match(re) || []).length;
      termScore += Math.min(hits, 5);
    }

    let score = termScore;
    if (termScore > 0) {
      if (opts.subject && c.docSubject && c.docSubject.toLowerCase() === opts.subject.toLowerCase()) {
        score += 6;
      }
      if (wantedTypes && c.docType && wantedTypes.includes(c.docType)) {
        score += 3;
      }
      if (c.heading) score += 1;
    }

    return {
      source: "document" as const,
      title: c.docTitle,
      page: c.page_number,
      heading: c.heading,
      text: c.content_text.slice(0, 1500),
      score,
    } satisfies ContextItem;
  });

  const filtered = opts.category === "DOCUMENT" ? scored : scored.filter((i) => i.score > 0);
  filtered.sort((a, b) => b.score - a.score);
  return enforceBudget(filtered, maxItems, maxChars);
}

export function enforceBudget(
  items: ContextItem[],
  maxItems: number,
  maxChars: number,
): ContextItem[] {
  const out: ContextItem[] = [];
  let used = 0;
  for (const it of items) {
    if (out.length >= maxItems) break;
    if (used + it.text.length > maxChars && out.length > 0) break;
    out.push(it);
    used += it.text.length;
  }
  return out;
}

export function buildSystemPrompt(category?: QueryCategory): string {
  return `You are the Ascend Personalized Assistant for a B.Tech CSE student who is also building a freelancing career.

PRINCIPLES:
- You have access to the user's OWN data and stored application data (evidence).
- Clearly separate USER-PROVIDED EVIDENCE from your general knowledge.
- When you use evidence, cite it inline using the exact source label provided, e.g. "(Source: Task: Finish DB assignment, due tomorrow)" or "(Source: Engineering Physics Notes, page 3)".
- If the provided evidence does NOT contain the answer, say explicitly: "This is not covered in your data."
- Never invent facts, dates, page numbers, or citations.
- Never claim that external/general information came from the user's data.
- Be concise, accurate, and faithful to the evidence.
${category ? `- Focus area for this query: ${category}.` : ""}
- If no evidence is supplied, answer using general knowledge but clearly state the answer is NOT based on the user's own materials.`;
}

export function buildUserPrompt(query: string, items: ContextItem[]): string {
  if (items.length === 0) {
    return `The user has no relevant data for this question. Answer using your general knowledge, but clearly state that the answer is NOT based on the user's own materials.

QUESTION: ${query}`;
  }
  const blocks = items
    .map((it) => {
      const loc = [
        it.title,
        it.page ? `page ${it.page}` : null,
        it.heading ? `section: ${it.heading}` : null,
      ]
        .filter(Boolean)
        .join(" | ");
      return `[${it.source.toUpperCase()}: ${loc}]\n${it.text}`;
    })
    .join("\n\n");
  return `USER-PROVIDED EVIDENCE:\n${blocks}\n\nQUESTION: ${query}\n\nAnswer using ONLY the evidence above where relevant. Cite sources inline with the exact source labels. If the evidence does not contain the answer, say so explicitly.`;
}
