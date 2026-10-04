import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Tables } from "@/integrations/supabase/types";

export type Task = Tables<"tasks">;
export type Habit = Tables<"habits">;
export type HabitLog = Tables<"habit_logs">;
export type Goal = Tables<"goals">;
export type Note = Tables<"notes">;
export type AcademicProject = Tables<"academic_projects">;
export type WorkProject = Tables<"work_projects">;
export type Intention = Tables<"daily_intentions">;
export type Exam = Tables<"exams">;

export interface TodayData {
  tasks: Task[];
  overdueTasks: Task[];
  dueTodayTasks: Task[];
  habits: Habit[];
  habitLogs: HabitLog[];
  goals: Goal[];
  upcomingDeadlines: { type: string; name: string; date: string; id: string }[];
  activeProjects: (AcademicProject | WorkProject)[];
  recentNotes: Note[];
  intention: Intention | null;
  streakInfo: { currentStreak: number; longestStreak: number; totalCompletions: number };
  exams: Exam[];
}

export function todayISO(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export function weekBounds(): { start: string; end: string } {
  const now = new Date();
  const dow = (now.getDay() + 6) % 7;
  const mon = new Date(now);
  mon.setDate(now.getDate() - dow);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(mon), end: fmt(sun) };
}

async function getUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not signed in");
  return data.user.id;
}

async function fetchTodayData(): Promise<TodayData> {
  const userId = await getUserId();
  const today = todayISO();
  const { start: weekStart, end: weekEnd } = weekBounds();

  const [
    tasksRes,
    habitsRes,
    habitLogsRes,
    goalsRes,
    notesRes,
    academicProjectsRes,
    workProjectsRes,
    intentionRes,
    examsRes,
  ] = await Promise.all([
    supabase.from("tasks").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("habits").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("habit_logs").select("*").eq("user_id", userId).gte("day", weekStart).lte("day", weekEnd),
    supabase.from("goals").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("notes").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(10),
    supabase.from("academic_projects").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("work_projects").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("daily_intentions").select("*").eq("user_id", userId).eq("day", today).maybeSingle(),
    supabase.from("exams").select("*").eq("user_id", userId).order("exam_date", { ascending: true }),
  ]);

  const tasks = (tasksRes.data ?? []) as Task[];
  const habits = (habitsRes.data ?? []) as Habit[];
  const habitLogs = (habitLogsRes.data ?? []) as HabitLog[];
  const goals = (goalsRes.data ?? []) as Goal[];
  const recentNotes = (notesRes.data ?? []) as Note[];
  const academicProjects = (academicProjectsRes.data ?? []) as AcademicProject[];
  const workProjects = (workProjectsRes.data ?? []) as WorkProject[];
  const intention = intentionRes.data as Intention | null;
  const exams = (examsRes.data ?? []) as Exam[];

  const overdueTasks = tasks.filter(t => !t.done && t.due_date && new Date(t.due_date) < new Date(today));
  const dueTodayTasks = tasks.filter(t => !t.done && t.due_date === today);

  const activeProjects = [
    ...academicProjects.filter(p => p.status !== "Done" && p.status !== "Completed"),
    ...workProjects.filter(p => p.status !== "Done" && p.status !== "Completed"),
  ];

  const upcomingDeadlines = [
    ...tasks.filter(t => t.due_date && new Date(t.due_date) >= new Date(today)).map(t => ({
      type: "task",
      name: t.title,
      date: t.due_date!,
      id: t.id,
    })),
    ...goals.filter(g => g.deadline && new Date(g.deadline) >= new Date(today)).map(g => ({
      type: "goal",
      name: g.text,
      date: g.deadline!,
      id: g.id,
    })),
    ...academicProjects.filter(p => p.deadline && new Date(p.deadline) >= new Date(today)).map(p => ({
      type: "academic_project",
      name: p.name,
      date: p.deadline!,
      id: p.id,
    })),
    ...workProjects.filter(p => p.deadline && new Date(p.deadline) >= new Date(today)).map(p => ({
      type: "work_project",
      name: p.name,
      date: p.deadline!,
      id: p.id,
    })),
    ...exams.filter(e => e.exam_date && new Date(e.exam_date) >= new Date(today)).map(e => ({
      type: "exam",
      name: e.name,
      date: e.exam_date!,
      id: e.id,
    })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(0, 10);

  const totalCompletions = habitLogs.filter(l => l.done).length;
  const currentStreak = habits.reduce((max, h) => Math.max(max, h.streak ?? 0), 0);
  const longestStreak = habits.reduce((max, h) => Math.max(max, h.streak ?? 0), 0);

  return {
    tasks,
    overdueTasks,
    dueTodayTasks,
    habits,
    habitLogs,
    goals,
    upcomingDeadlines,
    activeProjects,
    recentNotes,
    intention,
    streakInfo: { currentStreak, longestStreak, totalCompletions },
    exams,
  };
}

export function useToday() {
  return useQuery({
    queryKey: ["today"],
    queryFn: fetchTodayData,
    staleTime: 30_000,
  });
}

export function useTodayMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["today"] });

  return {
    invalidate,
  };
}