import { useState } from "react";
import { useNotes, type Note } from "@/lib/ascend-hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { SectionHeader, EmptyState, Card } from "./ui-bits";
import { toast } from "sonner";

export default function NotesTab() {
  const { list, create, update, remove } = useNotes();
  const [editing, setEditing] = useState<Note | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ title: "", content: "", tag: "" });
  const notes = list.data ?? [];

  function openNew() {
    setEditing(null);
    setDraft({ title: "", content: "", tag: "" });
    setOpen(true);
  }
  function openEdit(n: Note) {
    setEditing(n);
    setDraft({ title: n.title, content: n.content ?? "", tag: n.tag ?? "" });
    setOpen(true);
  }

  async function save() {
    if (!draft.title.trim()) {
      toast.error("Title required");
      return;
    }
    try {
      if (editing) await update.mutateAsync({ id: editing.id, ...draft });
      else await create.mutateAsync(draft);
      setOpen(false);
      toast.success(editing ? "Note updated" : "Note added");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        kicker="Notes"
        title="The Commonplace Book"
        subtitle="Distilled thoughts, lecture takeaways, ideas worth keeping."
        right={
          <Button onClick={openNew} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            New note
          </Button>
        }
      />

      {notes.length === 0 ? (
        <EmptyState
          title="No notes yet."
          hint="Capture an insight from today's reading or lecture."
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {notes.map((n) => (
            <Card key={n.id} className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-serif text-lg text-primary leading-tight">{n.title}</h3>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => openEdit(n)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() =>
                      remove.mutate(n.id, {
                        onError: (e: unknown) =>
                          toast.error(e instanceof Error ? e.message : "Failed to delete"),
                      })
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {n.tag && (
                <span className="text-[10px] tracking-[0.15em] uppercase text-[var(--gold)]">
                  {n.tag}
                </span>
              )}
              <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-6">
                {n.content}
              </p>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[var(--card)]">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl text-primary">
              {editing ? "Edit note" : "New note"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Title</Label>
              <Input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </div>
            <div>
              <Label>Tag / Topic</Label>
              <Input
                value={draft.tag}
                onChange={(e) => setDraft({ ...draft, tag: e.target.value })}
                placeholder="e.g. ML, OS, DBMS"
              />
            </div>
            <div>
              <Label>Content</Label>
              <Textarea
                rows={10}
                value={draft.content}
                onChange={(e) => setDraft({ ...draft, content: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={save}>{editing ? "Save" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
