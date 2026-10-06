import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Note = Tables<"notes">;
export type CodingProblem = Tables<"coding_problems">;
export type QuizItem = Tables<"quiz_items">;
export type Exam = Tables<"exams">;
export type AcademicProject = Tables<"academic_projects">;
export type Habit = Tables<"habits"> & {
  metric_type?: "boolean" | "count" | "duration" | "numeric";
  target?: number;
  frequency?: "daily" | "weekly" | "custom";
  schedule_days?: string;
  unit?: string;
  total_completions?: number;
  longest_streak?: number;
};
export type HabitLog = Tables<"habit_logs"> & {
  value?: number;
  duration_seconds?: number;
  notes?: string;
};
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

/* HABITS — with metric type support (boolean, count, duration, numeric) */
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
      // Supabase types don't include extended habit columns (metric_type, target, frequency, etc.)
      // These columns exist in the database but types are outdated; cast is safe at runtime.
      const { error } = await supabase.from("habits").insert({
        user_id,
        name: input.name!,
        category: input.category ?? "General",
        metric_type: input.metric_type ?? "boolean",
        target: input.target ?? 1,
        frequency: input.frequency ?? "daily",
        schedule_days: input.schedule_days ?? null,
        unit: input.unit ?? null,
      } as any);
      if (error) throw error;
    },
    onSuccess: inv,
  });
  const update = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Habit> & { id: string }) => {
      // Supabase types don't include extended habit columns; cast is safe at runtime.
      const { error } = await supabase
        .from("habits")
        .update(patch as any)
        .eq("id", id);
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

export function useLogHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      habit_id,
      day,
      value,
      duration_seconds,
      notes,
    }: {
      habit_id: string;
      day: string;
      value?: number;
      duration_seconds?: number;
      notes?: string;
    }) => {
      const user_id = await uid();
      const { data: habit } = await supabase
        .from("habits")
        .select("*")
        .eq("id", habit_id)
        .maybeSingle();
      if (!habit) throw new Error("Habit not found");

      const extendedHabit = habit as Habit;
      const metricType = extendedHabit.metric_type ?? "boolean";
      const target = extendedHabit.target ?? 1;
      const logValue = value ?? (metricType === "boolean" ? 1 : target);
      const logDuration = duration_seconds ?? null;
      const logNotes = notes ?? null;
      const done = metricType === "boolean" ? true : logValue >= target;

      // upsert by (user_id, habit_id, day)
      const { data: existing } = await supabase
        .from("habit_logs")
        .select("id")
        .eq("habit_id", habit_id)
        .eq("day", day)
        .maybeSingle();

      if (existing) {
        // Supabase types don't include habit_logs extended columns (value, duration_seconds, notes)
        const { error } = await supabase
          .from("habit_logs")
          .update({ done, value: logValue, duration_seconds: logDuration, notes: logNotes } as any)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("habit_logs").insert({
          user_id,
          habit_id,
          day,
          done,
          value: logValue,
          duration_seconds: logDuration,
          notes: logNotes,
        } as any);
        if (error) throw error;
      }

      // Recalculate streak and totals
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

      const totalCompletions = logs?.length ?? 0;
      const longestStreak = Math.max(extendedHabit.longest_streak ?? 0, streak);

      // Supabase types don't include extended habit columns; cast is safe at runtime.
      await supabase
        .from("habits")
        .update({
          streak,
          last_done: done ? day : null,
          total_completions: totalCompletions,
          longest_streak: longestStreak,
        } as any)
        .eq("id", habit_id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["habit_logs"] });
      qc.invalidateQueries({ queryKey: ["habits"] });
      qc.invalidateQueries({ queryKey: ["today"] });
    },
  });
}

export function useDeleteHabitLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ habit_id, day }: { habit_id: string; day: string }) => {
      const { error } = await supabase
        .from("habit_logs")
        .delete()
        .eq("habit_id", habit_id)
        .eq("day", day);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["habit_logs"] });
      qc.invalidateQueries({ queryKey: ["habits"] });
      qc.invalidateQueries({ queryKey: ["today"] });
    },
  });
}

/** @deprecated Use useLogHabit instead */
export const useToggleHabitLog = useLogHabit;

/* PROJECTS — unified academic + work projects */
export type Project = (Tables<"academic_projects"> | Tables<"work_projects">) & {
  project_type?: "academic" | "work";
};

export function useProjects() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const [academic, work] = await Promise.all([
        supabase.from("academic_projects").select("*").order("created_at", { ascending: false }),
        supabase.from("work_projects").select("*").order("created_at", { ascending: false }),
      ]);
      const academicData = (academic.data ?? []).map((p) => ({
        ...p,
        project_type: "academic" as const,
      }));
      const workData = (work.data ?? []).map((p) => ({ ...p, project_type: "work" as const }));
      return [...academicData, ...workData].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    },
  });
  const inv = () => qc.invalidateQueries({ queryKey: ["projects"] });
  const create = useMutation({
    mutationFn: async (input: {
      name: string;
      project_type: "academic" | "work";
      status?: string;
      deadline?: string;
      tech_stack?: string;
      notes?: string;
      client_id?: string;
      type?: string;
      progress?: number;
      revenue?: number;
    }) => {
      const user_id = await uid();
      const table = input.project_type === "academic" ? "academic_projects" : "work_projects";
      if (input.project_type === "academic") {
        const academicFields = {
          user_id,
          name: input.name,
          status: input.status,
          deadline: input.deadline,
          tech_stack: input.tech_stack,
          notes: input.notes,
        };
        const { error } = await supabase.from("academic_projects").insert(academicFields);
        if (error) throw error;
      } else {
        const workFields = {
          user_id,
          name: input.name,
          type: input.type,
          status: input.status,
          client_id: input.client_id,
          deadline: input.deadline,
          revenue: input.revenue,
          progress: input.progress,
        };
        const { error } = await supabase.from("work_projects").insert(workFields);
        if (error) throw error;
      }
    },
    onSuccess: inv,
  });
  const update = useMutation({
    mutationFn: async ({
      id,
      project_type,
      ...patch
    }: Partial<Project> & { id: string; project_type: "academic" | "work" }) => {
      const table = project_type === "academic" ? "academic_projects" : "work_projects";
      const { error } = await supabase.from(table).update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: inv,
  });
  const remove = useMutation({
    mutationFn: async ({ id, project_type }: { id: string; project_type: "academic" | "work" }) => {
      const table = project_type === "academic" ? "academic_projects" : "work_projects";
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: inv,
  });
  return { list, create, update, remove };
}
