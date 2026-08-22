import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useGoals, type Goal } from "@/lib/ascend-hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Pencil } from "lucide-react";
import { SectionHeader, EmptyState, Card } from "./ui-bits";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

/* North star stored as a goal with scope='north_star' */
function useNorthStar() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["goals", "north_star"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goals")
        .select("*")
        .eq("scope", "north_star")
        .maybeSingle();
      if (error) throw error;
      return data as Goal | null;
    },
  });
  const save = useMutation({
    mutationFn: async (text: string) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("No user");
      if (q.data) {
        const { error } = await supabase.from("goals").update({ text }).eq("id", q.data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("goals")
          .upsert(
            { user_id: u.user.id, scope: "north_star", text, done: false },
            { onConflict: "user_id,scope" },
          );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["goals", "north_star"] });
      qc.invalidateQueries({ queryKey: ["goals"] });
    },
  });
  return { q, save };
}

export default function GoalsView() {
  const { list, create, update, remove } = useGoals();
  const ns = useNorthStar();
  const [nsDraft, setNsDraft] = useState<string | null>(null);
  useEffect(() => {
    if (ns.q.data) setNsDraft(null);
  }, [ns.q.data]);

  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<"90d" | "1y">("90d");
  const [editing, setEditing] = useState<Goal | null>(null);
  const [draft, setDraft] = useState({ text: "", deadline: "" });

  const all = list.data ?? [];
  const ninety = all.filter((g) => g.scope === "90d");
  const year = all.filter((g) => g.scope === "1y");

  function openNew(s: "90d" | "1y") {
    setScope(s);
    setEditing(null);
    setDraft({ text: "", deadline: "" });
    setOpen(true);
  }
  function openEdit(g: Goal) {
    setScope(g.scope as "90d" | "1y");
    setEditing(g);
    setDraft({ text: g.text, deadline: g.deadline ?? "" });
    setOpen(true);
  }
  async function save() {
    if (!draft.text.trim()) {
      toast.error("Text required");
      return;
    }
    const payload = { text: draft.text, deadline: draft.deadline || null, scope };
    try {
      if (editing) await update.mutateAsync({ id: editing.id, ...payload });
      else await create.mutateAsync(payload);
      setOpen(false);
      toast.success("Saved");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  const pct = (arr: Goal[]) =>
    arr.length ? Math.round((arr.filter((g) => g.done).length / arr.length) * 100) : 0;
  const nsText = nsDraft ?? ns.q.data?.text ?? "";

  function Section({
    title,
    kicker,
    items,
    scopeKey,
  }: {
    title: string;
    kicker: string;
    items: Goal[];
    scopeKey: "90d" | "1y";
  }) {
    return (
      <Card>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[11px] tracking-[0.2em] uppercase text-[var(--gold)]">{kicker}</p>
            <h3 className="font-serif text-xl text-primary mt-1">{title}</h3>
          </div>
          <Button size="sm" variant="outline" onClick={() => openNew(scopeKey)}>
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
        <div className="mb-3">
          <Progress value={pct(items)} />
          <p className="text-xs text-muted-foreground mt-1">
            {items.filter((g) => g.done).length}/{items.length} · {pct(items)}%
          </p>
        </div>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No goals yet.</p>
        ) : (
          <div className="space-y-2">
            {items.map((g) => (
              <div key={g.id} className="flex items-start gap-2 group">
                <Checkbox
                  checked={g.done}
                  onCheckedChange={(v) => update.mutate({ id: g.id, done: !!v })}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm ${g.done ? "line-through text-muted-foreground" : "text-foreground"}`}
                  >
                    {g.text}
                  </p>
                  {g.deadline && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      by {new Date(g.deadline).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1 opacity-0 group-hover:opacity-100">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => openEdit(g)}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() =>
                      remove.mutate(g.id, {
                        onError: (e: unknown) =>
                          toast.error(e instanceof Error ? e.message : "Failed to delete"),
                      })
                    }
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        kicker="Goals"
        title="The Compass"
        subtitle="North star, then the next ninety days."
      />

      <Card className="bg-gradient-to-br from-[var(--forest)] to-[var(--forest)]/90 text-[var(--ivory)] border-[var(--forest)]">
        <p className="text-[11px] tracking-[0.25em] uppercase text-[var(--gold)] mb-2">
          North Star
        </p>
        <Textarea
          value={nsText}
          onChange={(e) => setNsDraft(e.target.value)}
          onBlur={() => {
            if (nsDraft !== null && nsDraft !== (ns.q.data?.text ?? "")) ns.save.mutate(nsDraft);
          }}
          placeholder="In one sentence: who are you becoming?"
          rows={2}
          className="bg-transparent border-0 px-0 focus-visible:ring-0 font-serif text-2xl md:text-3xl text-[var(--ivory)] placeholder:text-[var(--ivory)]/40 resize-none"
        />
      </Card>

      {all.length === 0 && !ns.q.data ? null : null}

      <div className="grid lg:grid-cols-2 gap-4">
        <Section title="Next 90 Days" kicker="Horizon" items={ninety} scopeKey="90d" />
        <Section title="This Year" kicker="Annual" items={year} scopeKey="1y" />
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[var(--card)]">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl text-primary">
              {editing ? "Edit" : "New"} goal · {scope === "90d" ? "90 days" : "1 year"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Goal</Label>
              <Textarea
                rows={3}
                value={draft.text}
                onChange={(e) => setDraft({ ...draft, text: e.target.value })}
              />
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
          <DialogFooter>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
