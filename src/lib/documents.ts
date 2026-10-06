import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { processDocument, deleteDocument as deleteDocumentFn } from "./document.functions";
import type { Tables } from "@/integrations/supabase/types";
import { ALLOWED_MIME, DOCUMENT_TYPES, MAX_FILE_BYTES, type DocStatus } from "./document.server";
import { getOwnerUser } from "@/lib/owner-session";

export type UserDocument = Tables<"user_documents">;

export { DOCUMENT_TYPES, ALLOWED_MIME, MAX_FILE_BYTES };

export type UploadPhase = "idle" | "uploading" | "processing" | "done" | "error";

async function uid() {
  const user = await getOwnerUser();
  return user.id;
}

export function useDocuments() {
  return useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_documents")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as UserDocument[];
    },
  });
}

export function useUploadDocument() {
  const qc = useQueryClient();

  // Phase 1 only: validate + upload to Storage + insert the user_documents row
  // (with the explicit id). Processing is run separately via useRetryDocument
  // so the UI can show a distinct "Processing" state and support cancellation.
  const state = useMutation({
    mutationFn: async (input: {
      file: File;
      documentType: string;
      subject?: string;
      cancelled?: { current: boolean };
    }) => {
      const { file, documentType, subject, cancelled } = input;
      const userId = await uid();

      if (!(ALLOWED_MIME as readonly string[]).includes(file.type)) {
        throw new Error("Unsupported file type. Upload a PDF, plain text, or Markdown file.");
      }
      if (file.size > MAX_FILE_BYTES) {
        throw new Error("File too large (max 50 MB).");
      }

      const docId = crypto.randomUUID();
      const safeName = file.name.replace(/[^\w.\- ]/g, "_");
      const storagePath = `${userId}/${docId}/${safeName}`;

      const { error: upErr } = await supabase.storage.from("documents").upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });
      if (upErr) throw new Error(upErr.message);

      // If the user cancelled while the bytes were still in flight, roll back the
      // storage object so we never leave an orphaned upload behind.
      if (cancelled?.current) {
        await supabase.storage
          .from("documents")
          .remove([storagePath])
          .catch(() => {});
        throw new DOMException("Upload cancelled", "AbortError");
      }

      const { error: insErr } = await supabase.from("user_documents").insert({
        id: docId,
        user_id: userId,
        filename: file.name,
        storage_path: storagePath,
        mime_type: file.type,
        size_bytes: file.size,
        document_type: documentType,
        subject: subject ?? null,
        status: "pending",
      });
      if (insErr) {
        await supabase.storage
          .from("documents")
          .remove([storagePath])
          .catch(() => {});
        throw new Error(insErr.message);
      }

      return { docId, storagePath };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents"] }),
    onError: () => qc.invalidateQueries({ queryKey: ["documents"] }),
  });

  return state;
}

export function useRetryDocument() {
  const qc = useQueryClient();
  const process = useServerFn(processDocument);
  return useMutation({
    mutationFn: async (documentId: string) => {
      await process({ data: { documentId } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents"] }),
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  const deleteFn = useServerFn(deleteDocumentFn);
  return useMutation({
    mutationFn: async (doc: UserDocument) => {
      // Server function verifies ownership before removing storage + record.
      await deleteFn({ data: { documentId: doc.id } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents"] }),
    onError: () => qc.invalidateQueries({ queryKey: ["documents"] }),
  });
}

export function isTerminal(status: DocStatus | null) {
  return status === "ready" || status === "failed";
}
