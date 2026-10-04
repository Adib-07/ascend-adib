import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const uploadDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      filename: z.string().min(1).max(255),
      mimeType: z.enum(["application/pdf", "text/plain", "text/markdown"]),
      sizeBytes: z.number().int().positive().max(50 * 1024 * 1024),
      documentType: z.enum(["syllabus", "lecture_notes", "study_material", "textbook", "exam_prep", "client_requirements", "other"]).optional(),
      subject: z.string().max(200).optional(),
    })
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { filename, mimeType, sizeBytes, documentType, subject } = data;

    // Create document record
    const documentId = crypto.randomUUID();
    const storagePath = `${userId}/${documentId}/${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

    const { error } = await supabase.from("user_documents").insert({
      id: documentId,
      user_id: userId,
      filename,
      storage_path: storagePath,
      mime_type: mimeType,
      size_bytes: sizeBytes,
      document_type: documentType ?? "other",
      subject: subject ?? null,
      status: "pending",
    });
    if (error) throw new Error(error.message);

    // Return signed upload URL
    const { data: signedUrl, error: signErr } = await supabase.storage
      .from("documents")
      .createSignedUploadUrl(storagePath);
    if (signErr || !signedUrl) throw new Error("Failed to create upload URL");

    return { documentId, uploadUrl: signedUrl.signedUrl };
  });

export const completeUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ documentId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { documentId } = data;

    // Verify document exists and belongs to user
    const { data: doc, error } = await supabase
      .from("user_documents")
      .select("*")
      .eq("id", documentId)
      .eq("user_id", userId)
      .single();
    if (error || !doc) throw new Error("Document not found");

    // Trigger processing (fire-and-forget style)
    const { processDocumentImpl } = await import("./document.server");
    processDocumentImpl({ supabase, userId, documentId }).catch(console.error);

    return { success: true };
  });

export const listDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ status: z.enum(["pending", "processing", "ready", "failed"]).optional() }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    let q = supabase
      .from("user_documents")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (data.status) q = q.eq("status", data.status);
    const { data: docs, error } = await q;
    if (error) throw error;
    return docs ?? [];
  });

export const getDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ documentId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: doc, error } = await supabase
      .from("user_documents")
      .select("*")
      .eq("id", data.documentId)
      .eq("user_id", userId)
      .single();
    if (error || !doc) throw new Error("Document not found");
    return doc;
  });

export const processDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ documentId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { processDocumentImpl } = await import("./document.server");
    return processDocumentImpl({
      supabase: context.supabase,
      userId: context.userId,
      documentId: data.documentId,
    });
  });

export const deleteDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ documentId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { deleteDocumentImpl } = await import("./document.server");
    return deleteDocumentImpl({
      supabase: context.supabase,
      userId: context.userId,
      documentId: data.documentId,
    });
  });

export const askDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      question: z.string().min(1).max(4000),
      documentIds: z.array(z.string().uuid()).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { askDocumentImpl } = await import("./document.server");
    return askDocumentImpl({
      supabase: context.supabase,
      userId: context.userId,
      question: data.question,
      documentIds: data.documentIds,
    });
  });

