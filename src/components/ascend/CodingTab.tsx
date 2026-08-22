import { useState } from "react";
import { useCodingProblems, type CodingProblem } from "@/lib/ascend-hooks";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionHeader, EmptyState, Card, Pill } from "./ui-bits";
import { toast } from "sonner";

const PLATFORMS = ["LeetCode", "HackerRank", "Codeforces", "Other"];
const DIFFS = ["Easy", "Medium", "Hard"] as const;

function diffClass(d: string | null) {
  if (d === "Easy") return "text-[var(--forest)] bg-[var(--forest)]/10 border-[var(--forest)]/30";
  if (d === "Medium") return "text-[var(--gold)] bg-[var(--gold)]/10 border-[var(--gold)]/30";
  if (d === "Hard")
    return "text-[var(--destructive)] bg-[var(--destructive)]/10 border-[var(--destructive)]/30";
  return "text-muted-foreground bg-secondary border-border";
}

export default function CodingTab() {
  const { list, create, update, remove } = useCodingProblems();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CodingProblem | null>(null);
  const [draft, setDraft] = useState({
    title: "",
    platform: "LeetCode",
    difficulty: "Medium",
    link: "",
    notes: "",
    solved: false,
  });
  const [filter, setFilter] = useState<"All" | "Solved" | "Unsolved">("All");

  const items = (list.data ?? []).filter((p) =>
    filter === "All" ? true : filter === "Solved" ? p.solved : !p.solved,
  );

  function openNew() {
    setEditing(null);
    setDraft({
      title: "",
      platform: "LeetCode",
      difficulty: "Medium",
      link: "",
      notes: "",
      solved: false,
    });
    setOpen(true);
  }
  function openEdit(p: CodingProblem) {
    setEditing(p);
    setDraft({
      title: p.title,
      platform: p.platform ?? "LeetCode",
      difficulty: p.difficulty ?? "Medium",
      link: p.link ?? "",
      notes: p.notes ?? "",
      solved: p.solved,
    });
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
      toast.success("Saved");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        kicker="Coding"
        title="The Practice Ledger"
        subtitle="Every problem leaves a mark. Track it."
        right={
          <Button onClick={openNew} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Add problem
          </Button>
        }
      />

      <div className="flex gap-2 overflow-x-auto pb-1">
        {(["All", "Solved", "Unsolved"] as const).map((f) => (
          <Pill key={f} active={filter === f} onClick={() => setFilter(f)}>
            {f}
          </Pill>
        ))}
      </div>

      {items.length === 0 ? (
        <EmptyState title="No problems logged." hint="Add today's grind." />
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {items.map((p) => (
            <Card key={p.id} className="flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Checkbox
                      checked={p.solved}
                      onCheckedChange={(v) => update.mutate({ id: p.id, solved: !!v })}
                    />
                    <h3
                      className={cn(
                        "font-medium text-primary truncate",
                        p.solved && "line-through text-muted-foreground",
                      )}
                    >
                      {p.title}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {p.platform}
                    </span>
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-semibold border",
                        diffClass(p.difficulty),
                      )}
                    >
                      {p.difficulty}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  {p.link && (
                    <a href={p.link} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </a>
                  )}
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
              {p.notes && <p className="text-xs text-muted-foreground line-clamp-3">{p.notes}</p>}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[var(--card)]">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl text-primary">
              {editing ? "Edit problem" : "New problem"}
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Platform</Label>
                <Select
                  value={draft.platform}
                  onValueChange={(v) => setDraft({ ...draft, platform: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Difficulty</Label>
                <Select
                  value={draft.difficulty}
                  onValueChange={(v) => setDraft({ ...draft, difficulty: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIFFS.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Link</Label>
              <Input
                value={draft.link}
                onChange={(e) => setDraft({ ...draft, link: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                rows={4}
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={draft.solved}
                onCheckedChange={(v) => setDraft({ ...draft, solved: !!v })}
              />{" "}
              Solved
            </label>
          </div>
          <DialogFooter>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
