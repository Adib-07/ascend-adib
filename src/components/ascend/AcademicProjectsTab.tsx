import { useState } from "react";
import { useAcademicProjects, type AcademicProject } from "@/lib/ascend-hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const STATUSES = ["Idea", "In Progress", "Done", "Paused"];

export default function AcademicProjectsTab() {
  const { list, create, update, remove } = useAcademicProjects();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AcademicProject | null>(null);
  const [draft, setDraft] = useState({
    name: "",
    status: "Idea",
    deadline: "",
    tech_stack: "",
    notes: "",
  });
  const items = list.data ?? [];

  function openNew() {
    setEditing(null);
    setDraft({ name: "", status: "Idea", deadline: "", tech_stack: "", notes: "" });
    setOpen(true);
  }
  function openEdit(p: AcademicProject) {
    setEditing(p);
    setDraft({
      name: p.name,
      status: p.status ?? "Idea",
      deadline: p.deadline ?? "",
      tech_stack: p.tech_stack ?? "",
      notes: p.notes ?? "",
    });
    setOpen(true);
  }

  async function save() {
    if (!draft.name.trim()) {
      toast.error("Name required");
      return;
    }
    const payload = { ...draft, deadline: draft.deadline || null };
    try {
      if (editing) await update.mutateAsync({ id: editing.id, ...payload });
      else await create.mutateAsync(payload);
      setOpen(false);
      toast.success("Saved");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        kicker="Projects"
        title="The Workshop"
        subtitle="Built things, not just learned things."
        right={
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4 mr-1" />
            New project
          </Button>
        }
      />

      {items.length === 0 ? (
        <EmptyState title="No projects yet." hint="Ship something this semester." />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((p) => (
            <Card key={p.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-serif text-lg text-primary">{p.name}</h3>
                  <p className="text-[11px] tracking-[0.15em] uppercase text-[var(--gold)] mt-1">
                    {p.status}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => openEdit(p)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() =>
                      remove.mutate(p.id, {
                        onError: (e: unknown) =>
                          toast.error(e instanceof Error ? e.message : "Failed to delete"),
                      })
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {p.deadline && (
                <p className="text-xs text-muted-foreground mt-2">
                  Due {new Date(p.deadline).toLocaleDateString()}
                </p>
              )}
              {p.tech_stack && (
                <div className="flex gap-1 flex-wrap mt-3">
                  {p.tech_stack
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean)
                    .map((t) => (
                      <span
                        key={t}
                        className="px-2 py-0.5 rounded-full text-[10px] border border-border bg-secondary text-muted-foreground"
                      >
                        {t}
                      </span>
                    ))}
                </div>
              )}
              {p.notes && (
                <p className="text-xs text-muted-foreground mt-3 line-clamp-3">{p.notes}</p>
              )}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[var(--card)]">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl text-primary">
              {editing ? "Edit project" : "New project"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Status</Label>
                <Select
                  value={draft.status}
                  onValueChange={(v) => setDraft({ ...draft, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Deadline</Label>
                <Input
                  type="date"
                  value={draft.deadline}
                  onChange={(e) => setDraft({ ...draft, deadline: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Tech stack (comma separated)</Label>
              <Input
                value={draft.tech_stack}
                onChange={(e) => setDraft({ ...draft, tech_stack: e.target.value })}
                placeholder="React, Python, PostgreSQL"
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                rows={3}
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
