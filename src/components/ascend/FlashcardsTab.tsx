import { useState, useEffect } from "react";
import { useDecks, useCards, useDeckMutations } from "@/lib/ascend-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, ChevronLeft, ChevronRight, CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function FlashcardsTab() {
  const decksQ = useDecks();
  const { createDeck, removeDeck } = useDeckMutations();
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deckName, setDeckName] = useState("");
  const [deckSubject, setDeckSubject] = useState("");

  useEffect(() => {
    if (!selected && decksQ.data && decksQ.data.length > 0) setSelected(decksQ.data[0].id);
  }, [decksQ.data, selected]);

  return (
    <div className="grid gap-6 md:grid-cols-[280px_1fr]">
      <aside className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-lg text-primary">Decks</h3>
          <Dialog open={creating} onOpenChange={setCreating}>
            <DialogTrigger asChild><Button size="sm" variant="ghost"><Plus className="h-4 w-4" /></Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle className="font-serif">New deck</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Name</Label><Input value={deckName} onChange={(e) => setDeckName(e.target.value)} className="mt-1" autoFocus /></div>
                <div><Label>Subject</Label><Input value={deckSubject} onChange={(e) => setDeckSubject(e.target.value)} className="mt-1" placeholder="e.g. ML, DBMS" /></div>
              </div>
              <DialogFooter>
                <Button onClick={async () => {
                  if (!deckName.trim()) return;
                  await createDeck.mutateAsync({ name: deckName, subject: deckSubject || "General" });
                  setDeckName(""); setDeckSubject(""); setCreating(false); toast.success("Deck created");
                }}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        {(decksQ.data ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">No decks yet. Create your first one.</p>
        )}
        <div className="space-y-1">
          {(decksQ.data ?? []).map((d) => (
            <button
              key={d.id}
              onClick={() => setSelected(d.id)}
              className={cn(
                "w-full text-left px-3 py-2 rounded-md border transition-colors group",
                selected === d.id ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/40"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{d.name}</p>
                  <p className={cn("text-xs truncate", selected === d.id ? "opacity-80" : "text-muted-foreground")}>{d.subject}</p>
                </div>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); if (confirm("Delete this deck?")) removeDeck.mutate(d.id); }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="h-4 w-4" />
                </span>
              </div>
            </button>
          ))}
        </div>
      </aside>

      <div>{selected ? <DeckView deckId={selected} /> : <p className="text-sm text-muted-foreground">Select or create a deck to begin.</p>}</div>
    </div>
  );
}

function DeckView({ deckId }: { deckId: string }) {
  const cardsQ = useCards(deckId);
  const { addCard, updateCard, removeCard } = useDeckMutations();
  const cards = cardsQ.data ?? [];
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [adding, setAdding] = useState(false);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");

  useEffect(() => { setIdx(0); setFlipped(false); }, [deckId]);
  useEffect(() => { if (idx >= cards.length && cards.length > 0) setIdx(0); }, [cards.length, idx]);

  const current = cards[idx];
  const knownCount = cards.filter((c) => c.known).length;

  function next() { setFlipped(false); setIdx((i) => (i + 1) % Math.max(cards.length, 1)); }
  function prev() { setFlipped(false); setIdx((i) => (i - 1 + cards.length) % Math.max(cards.length, 1)); }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{cards.length} cards · {knownCount} known</p>
        <Dialog open={adding} onOpenChange={setAdding}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Add card</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-serif">New card</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Front</Label><Textarea value={front} onChange={(e) => setFront(e.target.value)} className="mt-1" autoFocus /></div>
              <div><Label>Back</Label><Textarea value={back} onChange={(e) => setBack(e.target.value)} className="mt-1" /></div>
            </div>
            <DialogFooter>
              <Button onClick={async () => {
                if (!front.trim() || !back.trim()) return;
                await addCard.mutateAsync({ deck_id: deckId, front, back });
                setFront(""); setBack(""); setAdding(false); toast.success("Card added");
              }}>Add</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {cards.length === 0 ? (
        <div className="card-elegant p-10 text-center">
          <p className="font-serif text-lg text-primary">A blank deck.</p>
          <p className="text-sm text-muted-foreground mt-1">Add your first card.</p>
        </div>
      ) : (
        <>
          <div className="flip-card w-full">
            <button
              onClick={() => setFlipped((f) => !f)}
              className="relative w-full aspect-[16/9] md:aspect-[16/8] block"
              aria-label="Flip card"
            >
              <div className={cn("flip-inner relative w-full h-full", flipped && "[transform:rotateY(180deg)]")}>
                <div className="flip-face absolute inset-0 card-elegant p-8 md:p-12 flex flex-col items-center justify-center text-center">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--gold)]">Question</p>
                  <p className="font-serif text-xl md:text-2xl text-primary mt-4">{current.front}</p>
                  <p className="text-xs text-muted-foreground mt-6">Tap to reveal</p>
                </div>
                <div className="flip-face flip-back absolute inset-0 card-elegant p-8 md:p-12 flex flex-col items-center justify-center text-center bg-[var(--linen)]">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--gold)]">Answer</p>
                  <p className="font-serif text-xl md:text-2xl text-primary mt-4">{current.back}</p>
                </div>
              </div>
            </button>
          </div>

          <div className="flex items-center justify-between gap-3">
            <Button variant="outline" size="sm" onClick={prev}><ChevronLeft className="h-4 w-4 mr-1" />Prev</Button>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={current.known ? "default" : "outline"}
                onClick={() => updateCard.mutate({ id: current.id, known: !current.known })}
              >
                {current.known ? <CheckCircle2 className="h-4 w-4 mr-1" /> : <Circle className="h-4 w-4 mr-1" />}
                {current.known ? "Known" : "Mark known"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => removeCard.mutate(current.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
            <Button variant="outline" size="sm" onClick={next}>Next<ChevronRight className="h-4 w-4 ml-1" /></Button>
          </div>

          <p className="text-center text-xs text-muted-foreground">Card {idx + 1} of {cards.length}</p>
        </>
      )}
    </div>
  );
}
