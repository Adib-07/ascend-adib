import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
