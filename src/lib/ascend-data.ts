import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Tables } from "@/integrations/supabase/types";

export type Task = Tables<"tasks">;
export type Intention = Tables<"daily_intentions">;
export type LearnTopic = Tables<"learn_topics">;
export type Deck = Tables<"flashcard_decks">;
export type Card = Tables<"flashcards">;

export function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

async function uid() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not signed in");
  return data.user.id;
}

/* TASKS */
export function useTasks() {
  return useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Task[];
    },
  });
}
export function useTaskMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["tasks"] });

  // Optimistically update the cached task list so toggling/creating/deleting a
  // task feels instant; the background refetch reconciles with the server.
  const optimisticSet = (updater: (old: Task[]) => Task[]) => {
    qc.setQueryData<Task[]>(["tasks"], (old) => updater(old ?? []));
  };

  const create = useMutation({
    mutationFn: async (input: Partial<Task>) => {
      const user_id = await uid();
      const { error } = await supabase.from("tasks").insert({
        user_id,
        title: input.title!,
        priority: input.priority ?? "Medium",
        type: input.type ?? "Study",
        due_date: input.due_date ?? null,
        due_time: input.due_time ?? null,
        reminder_time: input.reminder_time ?? null,
        mit_slot: input.mit_slot ?? null,
      });
      if (error) throw error;
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ["tasks"] });
      const prev = qc.getQueryData<Task[]>(["tasks"]);
      const temp: Task = {
        id: `temp-${Date.now()}`,
        user_id: "",
        title: input.title!,
        priority: input.priority ?? "Medium",
        type: input.type ?? "Study",
        due_date: input.due_date ?? null,
        due_time: input.due_time ?? null,
        reminder_time: input.reminder_time ?? null,
        mit_slot: input.mit_slot ?? null,
        done: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      optimisticSet((old) => [temp, ...old]);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["tasks"], ctx.prev);
    },
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Task> & { id: string }) => {
      const { error } = await supabase.from("tasks").update(patch).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, ...patch }) => {
      await qc.cancelQueries({ queryKey: ["tasks"] });
      const prev = qc.getQueryData<Task[]>(["tasks"]);
      optimisticSet((old) => old.map((t) => (t.id === id ? { ...t, ...patch } : t)));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["tasks"], ctx.prev);
    },
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: ["tasks"] });
      const prev = qc.getQueryData<Task[]>(["tasks"]);
      optimisticSet((old) => old.filter((t) => t.id !== id));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["tasks"], ctx.prev);
    },
    onSuccess: invalidate,
  });
  return { create, update, remove };
}

/* INTENTION */
export function useIntention(day: string) {
  return useQuery({
    queryKey: ["intention", day],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_intentions")
        .select("*")
        .eq("day", day)
        .maybeSingle();
      if (error) throw error;
      return data as Intention | null;
    },
  });
}
export function useSaveIntention() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ day, intention }: { day: string; intention: string }) => {
      const user_id = await uid();
      const { error } = await supabase
        .from("daily_intentions")
        .upsert({ user_id, day, intention }, { onConflict: "user_id,day" });
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["intention", v.day] }),
  });
}

/* LEARN */
export function useLearnTopics() {
  return useQuery({
    queryKey: ["learn_topics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("learn_topics")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as LearnTopic[];
    },
  });
}
export function useLearnMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["learn_topics"] });
  const create = useMutation({
    mutationFn: async (input: Partial<LearnTopic>) => {
      const user_id = await uid();
      const { error } = await supabase.from("learn_topics").insert({
        user_id,
        topic: input.topic!,
        skill: input.skill ?? "Python",
        status: input.status ?? "Not Started",
        progress: input.progress ?? 0,
        difficulty: input.difficulty ?? "Medium",
        source: input.source ?? null,
        deadline: input.deadline ?? null,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<LearnTopic> & { id: string }) => {
      const { error } = await supabase.from("learn_topics").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("learn_topics").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
  return { create, update, remove };
}

/* DECKS + CARDS */
export function useDecks() {
  return useQuery({
    queryKey: ["decks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("flashcard_decks")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Deck[];
    },
  });
}
export function useCards(deckId: string | null) {
  return useQuery({
    queryKey: ["cards", deckId],
    queryFn: async () => {
      if (!deckId) return [];
      const { data, error } = await supabase
        .from("flashcards")
        .select("*")
        .eq("deck_id", deckId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Card[];
    },
    enabled: !!deckId,
  });
}
export function useDeckMutations() {
  const qc = useQueryClient();
  const createDeck = useMutation({
    mutationFn: async (input: { name: string; subject?: string }) => {
      const user_id = await uid();
      const { data, error } = await supabase
        .from("flashcard_decks")
        .insert({ user_id, name: input.name, subject: input.subject ?? "General" })
        .select()
        .single();
      if (error) throw error;
      return data as Deck;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["decks"] }),
  });
  const removeDeck = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("flashcard_decks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["decks"] }),
  });
  const addCard = useMutation({
    mutationFn: async (input: { deck_id: string; front: string; back: string }) => {
      const user_id = await uid();
      const { error } = await supabase.from("flashcards").insert({ ...input, user_id });
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["cards", v.deck_id] }),
  });
  const updateCard = useMutation({
    mutationFn: async ({ id, deck_id: _d, ...patch }: Partial<Card> & { id: string }) => {
      const { error } = await supabase.from("flashcards").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cards"] }),
  });
  const removeCard = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("flashcards").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cards"] }),
  });
  return { createDeck, removeDeck, addCard, updateCard, removeCard };
}
