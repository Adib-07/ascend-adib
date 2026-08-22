import { useRef, useState } from "react";
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
import {
  DOCUMENT_TYPES,
  useDeleteDocument,
  useDocuments,
  useRetryDocument,
  useUploadDocument,
  type UserDocument,
} from "@/lib/documents";
import { askWithContext } from "@/lib/context-engine.functions";
import { mapAuthError } from "@/lib/auth-errors";

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

  // Upload lifecycle: idle -> uploading -> processing -> done/error
  const [phase, setPhase] = useState<"idle" | "uploading" | "processing" | "done" | "error">(
    "idle",
  );
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [processingDocId, setProcessingDocId] = useState<string | null>(null);
  const cancelledRef = useRef<{ current: boolean }>({ current: false });

  const [pendingDelete, setPendingDelete] = useState<UserDocument | null>(null);

  const docs = useDocuments();
  const upload = useUploadDocument();
  const retry = useRetryDocument();
  const remove = useDeleteDocument();
  const ask = useServerFn(askWithContext);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] ?? null);
  };

  const resetUpload = () => {
    setFile(null);
    setSubject("");
    setDocType("other");
    setPhase("idle");
    setUploadError(null);
    setProcessingDocId(null);
    cancelledRef.current.current = false;
    if (fileRef.current) fileRef.current.value = "";
  };

  const onUpload = async () => {
    if (!file || phase === "uploading" || phase === "processing") return;
    cancelledRef.current.current = false;
    setUploadError(null);
    setPhase("uploading");
    try {
      const res = await upload.mutateAsync({
        file,
        documentType: docType,
        subject,
        cancelled: cancelledRef.current,
      });
      setProcessingDocId(res.docId);
      setPhase("processing");
      try {
        await retry.mutateAsync(res.docId);
        setPhase("done");
      } catch (err) {
        setPhase("error");
        setUploadError(err instanceof Error ? err.message : "Processing failed. Please try again.");
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // User cancelled during upload — nothing was committed.
        resetUpload();
        return;
      }
      setPhase("error");
      setUploadError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      if (phase !== "error") docs.refetch();
    }
  };

  const onCancelUpload = async () => {
    if (phase === "uploading") {
      // The storage transfer can't be interrupted mid-flight; flag it so the
      // mutation rolls back the object once the request resolves.
      cancelledRef.current.current = true;
      return;
    }
    if (phase === "processing" && processingDocId) {
      // Server-side extraction can't be safely interrupted — cancel by deleting
      // the unwanted document (record + storage + chunks), never leaving orphans.
      const id = processingDocId;
      resetUpload();
      try {
        await remove.mutateAsync({ id } as UserDocument);
      } catch {
        /* surface via list refresh */
      }
    }
  };

  const onAsk = async () => {
    if (!question.trim()) return;
    setAskPending(true);
    setAskError(null);
    try {
      const res = await ask({ data: { question } });
      setAnswer(res.text);
      setSources(
        res.sources
          .filter((s) => s.source === "document")
          .map((s) => ({ title: s.title, page: s.page, heading: s.heading })),
      );
    } catch (err) {
      setAskError(mapAuthError(err));
      setAnswer(null);
      setSources([]);
    } finally {
      setAskPending(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await remove.mutateAsync(pendingDelete);
    } catch (err) {
      // Let the UI reflect the failure; do not hide it.
      console.error("Delete failed", err);
    } finally {
      setPendingDelete(null);
    }
  };

  const busy = phase === "uploading" || phase === "processing";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl text-forest">Documents</h2>
        <p className="text-sm text-muted-foreground">
          Upload your syllabus, notes, study material, or client documents. They are private to your
          account and can be used by the AI assistant.
        </p>
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-forest text-lg">Upload a document</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.txt,.md,text/plain,text/markdown,application/pdf"
            className="hidden"
            onChange={onPick}
            disabled={busy}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              className="border-gold text-forest"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
            >
              <Upload className="mr-2 h-4 w-4" /> Choose file
            </Button>
            <span className="text-sm text-muted-foreground">
              {file ? file.name : "PDF, TXT, or Markdown (max 50 MB)"}
            </span>
            {file && !busy && (
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-red-600"
                onClick={() => setFile(null)}
              >
                clear
              </button>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-forest">Document type</Label>
              <Select value={docType} onValueChange={setDocType} disabled={busy}>
                <SelectTrigger className="border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-forest">Subject / context (optional)</Label>
              <Input
                className="border-border"
                placeholder="e.g. Engineering Physics"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={busy}
              />
            </div>
          </div>

          {phase === "uploading" && (
            <p className="text-sm text-forest flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
            </p>
          )}
          {phase === "processing" && (
            <p className="text-sm text-forest flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Processing your document…
            </p>
          )}
          {phase === "error" && uploadError && (
            <p className="text-sm text-red-600 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" /> {uploadError}
            </p>
          )}

          <div className="flex items-center gap-2">
            {!busy && (
              <Button
                className="bg-forest text-ivory hover:bg-forest/90"
                disabled={!file}
                onClick={onUpload}
              >
                <FilePlus2 className="mr-2 h-4 w-4" /> Upload &amp; Process
              </Button>
            )}
            {busy && (
              <Button
                variant="outline"
                className="border-red-300 text-red-700 hover:bg-red-50"
                onClick={onCancelUpload}
              >
                <X className="mr-2 h-4 w-4" /> Cancel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-forest text-lg flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-gold" /> Ask your documents
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            className="border-border"
            placeholder="Ask a question based on your uploaded documents..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <Button
            className="bg-gold text-ivory hover:bg-gold/90"
            disabled={askPending || !question.trim()}
            onClick={onAsk}
          >
            {askPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Ask
          </Button>
          {askError && <p className="text-sm text-red-600">{askError}</p>}
          {answer && (
            <div className="space-y-2">
              <div className="rounded-md border border-border bg-muted/40 p-3 text-sm whitespace-pre-wrap">
                {answer}
              </div>
              {sources.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium text-forest">Sources: </span>
                  {sources
                    .map((s) =>
                      [
                        s.title,
                        s.page ? `page ${s.page}` : null,
                        s.heading ? `“${s.heading}”` : null,
                      ]
                        .filter(Boolean)
                        .join(" · "),
                    )
                    .join("  |  ")}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h3 className="font-serif text-xl text-forest">Your documents</h3>
        {docs.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

        {docs.data?.length === 0 && !docs.isLoading && (
          <div className="rounded-md border border-dashed border-border p-8 text-center">
            <Inbox className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              Upload your syllabus, notes, textbooks, or PDFs to study with Ascend.
            </p>
          </div>
        )}

        {docs.data?.map((doc: UserDocument) => (
          <Card key={doc.id} className="border-border">
            <CardContent className="flex items-center gap-3 p-4">
              <FileText className="h-5 w-5 text-gold shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-medium text-forest">{doc.filename}</span>
                  <StatusBadge status={doc.status} />
                  {doc.document_type && doc.document_type !== "other" && (
                    <Badge variant="secondary" className="bg-muted text-forest">
                      {doc.document_type.replace(/_/g, " ")}
                    </Badge>
                  )}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {doc.subject && <span>Subject: {doc.subject} · </span>}
                  {doc.page_count != null && <span>{doc.page_count} pages · </span>}
                  {new Date(doc.created_at).toLocaleDateString()}
                </p>
                {doc.status === "processing" && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-forest">
                    <Loader2 className="h-3 w-3 animate-spin" /> Processing your document…
                  </p>
                )}
                {doc.status === "failed" && doc.error_message && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
                    <AlertCircle className="h-3 w-3" /> Processing failed. Try again.
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {doc.status === "failed" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Retry"
                    onClick={() => retry.mutate(doc.id)}
                  >
                    <RefreshCw className="h-4 w-4 text-forest" />
                  </Button>
                )}
                {doc.status === "ready" && <CheckCircle2 className="h-4 w-4 text-forest" />}
                {doc.status === "processing" && (
                  <Loader2 className="h-4 w-4 animate-spin text-gold" />
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  title="Delete"
                  onClick={() => setPendingDelete(doc)}
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-serif">Delete this document?</AlertDialogTitle>
            <AlertDialogDescription>
              “{pendingDelete?.filename}” will be permanently removed, including its extracted
              content. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={confirmDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
