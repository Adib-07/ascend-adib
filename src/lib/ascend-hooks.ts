import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Tables } from "@/integrations/supabase/types";

export type Note = Tables<"notes">;
export type CodingProblem = Tables<"coding_problems">;
export type QuizItem = Tables<"quiz_items">;
export type Exam = Tables<"exams">;
export type AcademicProject = Tables<"academic_projects">;
export type Habit = Tables<"habits">;
export type HabitLog = Tables<"habit_logs">;
export type Goal = Tables<"goals">;
export type Client = Tables<"clients">;
export type WorkProject = Tables<"work_projects">;
export type FinanceEntry = Tables<"finance_entries">;
export type Service = Tables<"services">;
export type Outreach = Tables<"outreach"> & {
  approved?: boolean | null;
  ai_drafted?: boolean | null;
};

async function uid() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not signed in");
  return data.user.id;
}

function makeCrud<T extends { id: string }>(table: string, key: string) {
  return function useResource() {
    const qc = useQueryClient();
    const list = useQuery({
      queryKey: [key],
      queryFn: async () => {
        const { data, error } = await supabase
          .from(table as never)
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        return (data ?? []) as T[];
      },
    });
    const invalidate = () => qc.invalidateQueries({ queryKey: [key] });
    const create = useMutation({
      mutationFn: async (input: Partial<T>) => {
        const user_id = await uid();
        const { error } = await supabase
          .from(table as never)
          .insert({ ...(input as object), user_id } as never);
        if (error) throw error;
      },
      onSuccess: invalidate,
    });
    const update = useMutation({
      mutationFn: async ({ id, ...patch }: Partial<T> & { id: string }) => {
        const { error } = await supabase
          .from(table as never)
          .update(patch as never)
          .eq("id", id);
        if (error) throw error;
      },
      onSuccess: invalidate,
    });
    const remove = useMutation({
      mutationFn: async (id: string) => {
        const { error } = await supabase
          .from(table as never)
          .delete()
          .eq("id", id);
        if (error) throw error;
      },
      onSuccess: invalidate,
    });
    return { list, create, update, remove };
  };
}

export const useNotes = makeCrud<Note>("notes", "notes");
export const useCodingProblems = makeCrud<CodingProblem>("coding_problems", "coding_problems");
export const useQuizItems = makeCrud<QuizItem>("quiz_items", "quiz_items");
export const useExams = makeCrud<Exam>("exams", "exams");
export const useAcademicProjects = makeCrud<AcademicProject>(
  "academic_projects",
  "academic_projects",
);
export const useGoals = makeCrud<Goal>("goals", "goals");
export const useClients = makeCrud<Client>("clients", "clients");
export const useWorkProjects = makeCrud<WorkProject>("work_projects", "work_projects");
export const useFinanceEntries = makeCrud<FinanceEntry>("finance_entries", "finance_entries");
export const useServices = makeCrud<Service>("services", "services");
export const useOutreach = makeCrud<Outreach>("outreach", "outreach");

/* HABITS — with weekly log helpers */
export function useHabits() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["habits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("habits")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Habit[];
    },
  });
  const inv = () => qc.invalidateQueries({ queryKey: ["habits"] });
  const create = useMutation({
    mutationFn: async (input: Partial<Habit>) => {
      const user_id = await uid();
      const { error } = await supabase
        .from("habits")
        .insert({ user_id, name: input.name!, category: input.category ?? "General" });
      if (error) throw error;
    },
    onSuccess: inv,
  });
  const update = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Habit> & { id: string }) => {
      const { error } = await supabase.from("habits").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: inv,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("habits").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      inv();
      qc.invalidateQueries({ queryKey: ["habit_logs"] });
    },
  });
  return { list, create, update, remove };
}

export function useHabitLogs(weekStart: string, weekEnd: string) {
  return useQuery({
    queryKey: ["habit_logs", weekStart, weekEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("habit_logs")
        .select("*")
        .gte("day", weekStart)
        .lte("day", weekEnd);
      if (error) throw error;
      return (data ?? []) as HabitLog[];
    },
  });
}

export function useToggleHabitLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      habit_id,
      day,
      done,
    }: {
      habit_id: string;
      day: string;
      done: boolean;
    }) => {
      const user_id = await uid();
      // upsert by (user_id, habit_id, day)
      const { data: existing } = await supabase
        .from("habit_logs")
        .select("id")
        .eq("habit_id", habit_id)
        .eq("day", day)
        .maybeSingle();
      if (existing) {
        const { error } = await supabase.from("habit_logs").update({ done }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("habit_logs")
          .insert({ user_id, habit_id, day, done });
        if (error) throw error;
      }

      if (done) {
        const { data: logs } = await supabase
          .from("habit_logs")
          .select("day, done")
          .eq("habit_id", habit_id)
          .eq("done", true)
          .order("day", { ascending: false })
          .limit(365);

        let streak = 0;
        const checkDate = new Date();
        for (const log of logs ?? []) {
          const logDay = new Date(log.day + "T00:00:00").toDateString();
          if (logDay === checkDate.toDateString()) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
          } else break;
        }
        await supabase.from("habits").update({ streak, last_done: day }).eq("id", habit_id);
      } else {
        const { data: habit } = await supabase
          .from("habits")
          .select("streak")
          .eq("id", habit_id)
          .maybeSingle();
        if (habit) {
          await supabase
            .from("habits")
            .update({ streak: Math.max(0, (habit.streak ?? 1) - 1), last_done: null })
            .eq("id", habit_id);
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["habit_logs"] });
      qc.invalidateQueries({ queryKey: ["habits"] });
    },
  });
}
