import { extractText } from "unpdf";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { MAX_TOKENS, MODEL, TEMPERATURE } from "./tutor.server";

export type DocStatus = "pending" | "processing" | "ready" | "failed";

export const DOCUMENT_TYPES = [
  "syllabus",
  "lecture_notes",
  "study_material",
  "textbook",
  "exam_prep",
  "client_requirements",
  "other",
] as const;

export const ALLOWED_MIME = ["application/pdf", "text/plain", "text/markdown"] as const;

export const MAX_FILE_BYTES = 50 * 1024 * 1024;

export const DOC_SYSTEM = `You are the Ascend Document Assistant. You help the user understand their OWN uploaded documents (syllabus, lecture notes, study material, textbooks, exam prep, client requirements, etc.).

RULES:
- Answer ONLY using the document excerpts provided in the prompt context.
- Always cite the source page when possible, e.g. "According to page 3...".
- If the answer is NOT contained in the provided excerpts, say clearly: "This is not covered in the documents you uploaded." Do NOT invent facts, page numbers, or content.
- Be concise, accurate, and faithful to the source. Do not summarize beyond what the excerpts support.`;

type SupabaseClient = import("@supabase/supabase-js").SupabaseClient;

export function decodeText(buffer: ArrayBuffer): string {
  return new TextDecoder("utf-8").decode(buffer);
}

export async function extractFromBuffer(
  buffer: ArrayBuffer,
  mimeType: string | null,
): Promise<{ pages: { page: number; text: string }[]; pageCount: number | null }> {
  if (mimeType === "application/pdf") {
    const { text } = await extractText(new Uint8Array(buffer), {
      mergePages: false,
    });
    const pageTexts = Array.isArray(text) ? text : [String(text ?? "")];
    const arr = pageTexts.map((t, i) => ({
      page: i + 1,
      text: String(t ?? ""),
    }));
    return { pages: arr, pageCount: arr.length };
  }
  if (mimeType === "text/plain" || mimeType === "text/markdown") {
    return { pages: [{ page: 1, text: decodeText(buffer) }], pageCount: null };
  }
  throw new Error("Unsupported file type for text extraction");
}

const HEADING_RE = /^(chapter|section|unit|module|part|lesson|topic)\b/i;

export function isHeading(paragraph: string): boolean {
  const t = paragraph.trim();
  if (t.length === 0 || t.length > 90) return false;
  if (t.endsWith(".") || t.endsWith("?") || t.endsWith("!")) return false;
  if (/^\d+(\.\d+)*[.)]?\s+\S/.test(t)) return true;
  if (HEADING_RE.test(t)) return true;
  if (t === t.toUpperCase() && t.length > 3) return true;
  return false;
}

export function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n+/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export function chunkPages(
  pages: { page: number; text: string }[],
  documentId: string,
  userId: string,
): {
  document_id: string;
  user_id: string;
  chunk_index: number;
  page_number: number | null;
  heading: string | null;
  content_text: string;
  token_count: number;
}[] {
  const TARGET = 900;
  const MIN = 200;
  const chunks: {
    document_id: string;
    user_id: string;
    chunk_index: number;
    page_number: number | null;
    heading: string | null;
    content_text: string;
    token_count: number;
  }[] = [];
  let index = 0;
  let current = "";
  let currentHeading: string | null = null;
  let currentPage: number | null = null;

  const flush = () => {
    const text = current.trim();
    if (text.length >= MIN || chunks.length === 0) {
      chunks.push({
        document_id: documentId,
        user_id: userId,
        chunk_index: index++,
        page_number: currentPage,
        heading: currentHeading,
        content_text: text,
        token_count: Math.ceil(text.length / 4),
      });
    }
    current = "";
  };

  for (const { page, text } of pages) {
    const paragraphs = splitParagraphs(text);
    for (const para of paragraphs) {
      if (isHeading(para)) currentHeading = para;
      const candidate = current ? current + "\n" + para : para;
      if (candidate.length > TARGET && current.length >= MIN) {
        flush();
        current = para;
        currentPage = page;
      } else {
        current = candidate;
        currentPage = page;
      }
    }
  }
  if (current.trim().length > 0) flush();
  return chunks;
}

export async function retrieveChunks(
  supabase: SupabaseClient,
  userId: string,
  query: string,
  documentIds?: string[],
  limit = 8,
): Promise<{ content_text: string; page_number: number | null; heading: string | null }[]> {
  const terms = query
    .toLowerCase()
    .split(/\W+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3);
  if (terms.length === 0) return [];

  let q = supabase
    .from("document_chunks")
    .select("content_text, page_number, heading")
    .eq("user_id", userId);
  if (documentIds && documentIds.length > 0) {
    q = q.in("document_id", documentIds);
  }
  const orFilter = terms.map((t) => `content_text.ilike.%${t.replace(/%/g, "")}%`).join(",");
  q = q.or(orFilter).limit(limit);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as {
    content_text: string;
    page_number: number | null;
    heading: string | null;
  }[];
}

export async function retrieveChunksHybrid(
  supabase: SupabaseClient,
  userId: string,
  query: string,
  queryEmbedding: number[],
  documentIds?: string[],
  limit = 8,
): Promise<{ content_text: string; page_number: number | null; heading: string | null; score: number }[]> {
  const terms = query
    .toLowerCase()
    .split(/\W+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3);

  // Vector similarity search using pgvector
  let vecQuery = supabase
    .from("document_chunks")
    .select("content_text, page_number, heading, embedding")
    .eq("user_id", userId)
    .order("embedding", { ascending: false }) // pgvector uses <-> for distance, but we can use order by embedding <-> queryEmbedding
    .limit(limit * 2); // fetch more for hybrid merge

  // Use raw SQL for vector similarity with cosine distance
  const embeddingLiteral = `[${queryEmbedding.join(",")}]`;
  const { data: vecData, error: vecError } = await supabase.rpc("match_document_chunks", {
    query_embedding: queryEmbedding,
    match_count: limit * 2,
    filter_user_id: userId,
    filter_document_ids: documentIds ?? null,
  });
  if (vecError) throw vecError;

  // Keyword search
  let kwQuery = supabase
    .from("document_chunks")
    .select("content_text, page_number, heading")
    .eq("user_id", userId);
  if (documentIds && documentIds.length > 0) {
    kwQuery = kwQuery.in("document_id", documentIds);
  }
  const orFilter = query
    .toLowerCase()
    .split(/\W+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3)
    .map((t) => `content_text.ilike.%${t.replace(/%/g, "")}%`)
    .join(",");
  kwQuery = kwQuery.or(orFilter).limit(limit);

  const { data: kwData, error: kwError } = await kwQuery;
  if (kwError) throw kwError;

  // Merge results: prioritize vector results, then keyword
  const vectorResults = (vecData ?? []).map((row: any) => ({
    content_text: row.content_text,
    page_number: row.page_number,
    heading: row.heading,
    score: 1 - row.similarity, // similarity from rpc
    source: "vector" as const,
  }));

  const keywordResults = (kwData ?? []).map((row: any) => ({
    content_text: row.content_text,
    page_number: row.page_number,
    heading: row.heading,
    score: 0.5, // base keyword score
    source: "keyword" as const,
  }));

  // Deduplicate by content_text
  const seen = new Set<string>();
  const merged = [...vectorResults, ...keywordResults]
    .filter(r => {
      if (seen.has(r.content_text)) return false;
      seen.add(r.content_text);
      return true;
    })
    .sort((a, b) => a.score - b.score)
    .slice(0, limit);

  return merged.map(({ score, source, ...rest }) => rest);
}

export async function processDocumentImpl({
  supabase,
  userId,
  documentId,
}: {
  supabase: SupabaseClient;
  userId: string;
  documentId: string;
}): Promise<{ status: DocStatus; pageCount: number | null }> {
  const { data: doc, error: docErr } = await supabase
    .from("user_documents")
    .select("*")
    .eq("id", documentId)
    .eq("user_id", userId)
    .single();
  if (docErr || !doc) throw new Error("Document not found or access denied");

  const setStatus = async (status: DocStatus, extra: Record<string, unknown> = {}) => {
    await supabase
      .from("user_documents")
      .update({ status, updated_at: new Date().toISOString(), ...extra })
      .eq("id", documentId)
      .eq("user_id", userId);
  };

  try {
    await setStatus("processing");

    const { data: file, error: dlErr } = await supabase.storage
      .from("documents")
      .download(doc.storage_path);
    if (dlErr || !file) throw new Error(dlErr?.message ?? "Failed to download file");

    const buffer = await file.arrayBuffer();
    const { pages, pageCount } = await extractFromBuffer(buffer, doc.mime_type);

    const chunks = chunkPages(pages, documentId, userId);

    // Idempotent: clear previous chunks before re-inserting
    await supabase
      .from("document_chunks")
      .delete()
      .eq("document_id", documentId)
      .eq("user_id", userId);

    if (chunks.length > 0) {
      const { error: insErr } = await supabase.from("document_chunks").insert(chunks);
      if (insErr) throw new Error(insErr.message);
    }

    await setStatus("ready", { page_count: pageCount, error_message: null });
    return { status: "ready", pageCount };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Processing failed";
    await setStatus("failed", { error_message: message });
    return { status: "failed", pageCount: null };
  }
}

export async function deleteDocumentImpl({
  supabase,
  userId,
  documentId,
}: {
  supabase: SupabaseClient;
  userId: string;
  documentId: string;
}): Promise<{ deleted: boolean }> {
  // Ownership is enforced twice: by the RLS client (context.supabase) AND by an
  // explicit user_id check here, so a user can never delete another user's doc.
  const { data: doc, error: docErr } = await supabase
    .from("user_documents")
    .select("id, storage_path, user_id")
    .eq("id", documentId)
    .eq("user_id", userId)
    .single();

  if (docErr || !doc) {
    // Already gone, or not owned by this user — treat as success, no-op.
    return { deleted: false };
  }

  if (doc.storage_path) {
    const { error: stErr } = await supabase.storage.from("documents").remove([doc.storage_path]);
    if (stErr) throw new Error(stErr.message);
  }

  // Cascades to document_chunks via the FK on delete cascade.
  const { error: delErr } = await supabase.from("user_documents").delete().eq("id", documentId);
  if (delErr) throw new Error(delErr.message);

  return { deleted: true };
}

export async function askDocumentImpl({
  supabase,
  userId,
  question,
  documentIds,
}: {
  supabase: SupabaseClient;
  userId: string;
  question: string;
  documentIds?: string[];
}): Promise<{ text: string }> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("AI service not configured");

  const chunks = await retrieveChunks(supabase, userId, question, documentIds, 8);
  const context =
    chunks.length > 0
      ? chunks
          .map(
            (c) =>
              `[[page ${c.page_number ?? "?"}]]${c.heading ? ` (${c.heading})` : ""}\n${c.content_text}`,
          )
          .join("\n\n")
      : "";

  const prompt = context
    ? `DOCUMENT EXCERPTS:\n${context}\n\nQUESTION: ${question}`
    : `The user has not uploaded any documents that match this question, or no documents are available.\n\nQUESTION: ${question}`;

  const gateway = createLovableAiGatewayProvider(key);
  const { text } = await generateText({
    model: gateway(MODEL),
    temperature: TEMPERATURE,
    maxOutputTokens: Math.min(4000, MAX_TOKENS + 1000),
    system: DOC_SYSTEM,
    prompt,
  });
  if (!text?.trim()) throw new Error("Empty response from AI");
  return { text };
}
