import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Upload,
  FileText,
  Trash2,
  RefreshCw,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  X,
  FilePlus2,
  Inbox,
} from "lucide-react";
import { toast } from "sonner";
import { mapAuthError } from "@/lib/auth-errors";

import { uploadDocument as uploadDocumentFn } from "@/lib/document.functions";
import { completeUpload as completeUploadFn } from "@/lib/document.functions";
import { listDocuments as listDocumentsFn } from "@/lib/document.functions";
import { deleteDocument as deleteDocumentFn } from "@/lib/document.functions";
import { askDocument as askDocumentFn } from "@/lib/document.functions";

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  processing: "bg-[#EAE4D8] text-forest",
  ready: "bg-forest/10 text-forest",
  failed: "bg-red-50 text-red-700",
};

function StatusBadge({ status }: { status: string | null }) {
  const s = status ?? "pending";
  return (
    <Badge className={STATUS_STYLE[s] ?? STATUS_STYLE.pending} variant="outline">
      {s}
    </Badge>
  );
}

export default function DocumentsView() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<string>("other");
  const [subject, setSubject] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [sources, setSources] = useState<
    { title: string; page: number | null; heading: string | null }[]
  >([]);
  const [askError, setAskError] = useState<string | null>(null);
  const [askPending, setAskPending] = useState(false);

  const [phase, setPhase] = useState<"idle" | "uploading" | "processing" | "done" | "error">(
    "idle",
  );
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<string | null>(null);

  const uploadDocument = useServerFn(uploadDocumentFn);
  const completeUpload = useServerFn(completeUploadFn);
  const listDocuments = useServerFn(listDocumentsFn);
  const deleteDocument = useServerFn(deleteDocumentFn);
  const askDocument = useServerFn(askDocumentFn);

  const qc = useQueryClient();

  const docsQuery = useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      return listDocuments({ data: {} });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async ({
      file,
      docType,
      subject,
    }: {
      file: File;
      docType: string;
      subject: string;
    }) => {
      const allowedMimeTypes = ["application/pdf", "text/plain", "text/markdown"] as const;
      const allowedDocTypes = [
        "syllabus",
        "lecture_notes",
        "study_material",
        "textbook",
        "exam_prep",
        "client_requirements",
        "other",
      ] as const;
      const fileType = file.type as (typeof allowedMimeTypes)[number];
      const mimeType = allowedMimeTypes.includes(fileType) ? fileType : "application/pdf";
      const docTypeValue = docType as (typeof allowedDocTypes)[number];
      const documentType = allowedDocTypes.includes(docTypeValue) ? docTypeValue : "other";
      const res = await uploadDocument({
        data: {
          filename: file.name,
          mimeType,
          sizeBytes: file.size,
          documentType,
          subject: subject || undefined,
        },
      });
      const { documentId, uploadUrl } = res;
      const res2 = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!res2.ok) throw new Error("Upload failed");
      await completeUpload({ data: { documentId } });
      return documentId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (documentId: string) => {
      await deleteDocument({ data: { documentId } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents"] });
      toast.success("Document deleted");
    },
    onError: (err: any) => {
      toast.error(mapAuthError(err));
    },
  });

  const askMutation = useMutation({
    mutationFn: async (question: string) => {
      const res = await askDocument({ data: { question, documentIds: undefined } });
      return res.text;
    },
    onSuccess: (text) => {
      setAnswer(text);
    },
    onError: (err: any) => {
      setAskError(mapAuthError(err));
    },
    onSettled: () => {
      setAskPending(false);
    },
  });

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!["application/pdf", "text/plain", "text/markdown"].includes(f.type)) {
      toast.error("Only PDF, TXT, and Markdown files are supported");
      return;
    }
    if (f.size > 50 * 1024 * 1024) {
      toast.error("File size must be under 50MB");
      return;
    }
    setFile(f);
    setUploadError(null);
    setPhase("idle");
  }

  async function startUpload() {
    if (!file) return;
    setPhase("uploading");
    setUploadError(null);
    try {
      await uploadMutation.mutateAsync({ file, docType, subject });
      setPhase("processing");
      toast.success("Upload complete, processing...");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err: any) {
      setPhase("error");
      setUploadError(err.message);
      toast.error(mapAuthError(err));
    }
  }

  async function handleAsk() {
    if (!question.trim()) return;
    setAskPending(true);
    setAskError(null);
    setAnswer(null);
    setSources([]);
    await askMutation.mutateAsync(question);
  }

  const docs = docsQuery.data ?? [];
  const isLoading = docsQuery.isLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl text-primary">Documents</h2>
          <p className="text-sm text-muted-foreground">Upload and query your personal documents</p>
        </div>
        <Button
          onClick={() => {
            fileRef.current?.click();
          }}
          disabled={phase === "uploading"}
        >
          <FilePlus2 className="h-4 w-4 mr-2" />
          Add Document
        </Button>
      </div>

      <input
        type="file"
        ref={fileRef}
        onChange={handleFileSelect}
        className="hidden"
        accept=".pdf,.txt,.md"
      />

      {file && phase === "idle" && (
        <Card className="bg-muted/50 border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Inbox className="h-10 w-10 text-muted-foreground" />
                <div>
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB · {file.type}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setFile(null);
                    fileRef.current!.value = "";
                  }}
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
                <Button
                  onClick={startUpload}
                  disabled={
                    phase ===
                    ("uploading" as "idle" | "uploading" | "processing" | "done" | "error")
                  }
                >
                  <Upload className="h-4 w-4 mr-1" />
                  Upload
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {phase === "uploading" && (
        <Card className="bg-muted/50 border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p>Uploading...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {phase === "processing" && (
        <Card className="bg-muted/50 border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p>Processing document (extracting text, chunking)...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {phase === "error" && (
        <AlertDialog open={true} onOpenChange={() => setPhase("idle")}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Upload Failed</AlertDialogTitle>
              <AlertDialogDescription>{uploadError}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => setPhase("idle")}>OK</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-serif text-xl">Your Documents</CardTitle>
          <Badge variant="outline" className="text-xs">
            {docs.length} documents
          </Badge>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : docs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Inbox className="h-12 w-12 text-muted-foreground/50" />
              <p className="font-medium text-muted-foreground">No documents yet</p>
              <p className="text-sm text-muted-foreground">
                Upload a PDF, TXT, or Markdown file to get started
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {docs.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-3 border border-border/50 rounded-lg hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{doc.filename}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-2">
                        <StatusBadge status={doc.status} />
                        {doc.page_count && <span>· {doc.page_count} pages</span>}
                        {doc.document_type && <span>· {doc.document_type}</span>}
                        <span>· {(doc.size_bytes ?? 0 / 1024).toFixed(1)} KB</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => setDeleteDialogOpen(doc.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-xl flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Ask Your Documents
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="question">Question</Label>
            <Textarea
              id="question"
              placeholder="What does my DBMS notes say about normalization?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={3}
              className="mt-2"
            />
          </div>
          <Button onClick={handleAsk} disabled={askPending || !question.trim()}>
            {askPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Ask
          </Button>
          {askError && <p className="text-sm text-red-600">{askError}</p>}
          {answer && (
            <div className="space-y-2 border-t pt-4">
              <p className="font-medium">Answer</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{answer}</p>
              {sources.length > 0 && (
                <details className="text-xs text-muted-foreground">
                  <summary>Sources</summary>
                  <ul className="mt-1 space-y-1">
                    {sources.map((s, i) => (
                      <li key={i}>
                        {s.title} {s.page ? `— page ${s.page}` : ""}{" "}
                        {s.heading ? ` ({s.heading})` : ""}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteDialogOpen} onOpenChange={() => setDeleteDialogOpen(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the document and its chunks.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteDialogOpen) deleteMutation.mutate(deleteDialogOpen);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
