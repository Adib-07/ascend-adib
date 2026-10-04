import type { Tables } from "@/integrations/supabase/types";

export interface AppNotification {
  id: string;
  type: "task-due" | "overdue" | "habit" | "exam" | "streak" | "info";
  title: string;
  subtitle: string;
  time: Date;
  read: boolean;
  urgent?: boolean;
}

export function requestNotificationPermission() {
  if (typeof window === "undefined") return;
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
}

export function sendBrowserNotification(title: string, body: string) {
  if (typeof window === "undefined") return;
  if ("Notification" in window && Notification.permission === "granted") {
    try {
      new Notification(title, { body, icon: "/favicon.ico" });
    } catch {
      /* noop */
    }
  }
}

export function scheduleNotification(title: string, body: string, atDate: Date) {
  const delay = atDate.getTime() - Date.now();
  if (delay > 0 && delay < 24 * 60 * 60 * 1000) {
    window.setTimeout(() => sendBrowserNotification(title, body), delay);
  }
}

type TaskLike = Pick<Tables<"tasks">, "id" | "title" | "done" | "due_date">;
type ExamLike = Pick<Tables<"exams">, "id" | "name" | "subject" | "exam_date">;

export function buildDailyNotifications(tasks: TaskLike[], exams: ExamLike[]): AppNotification[] {
  const now = new Date();
  const today = now.toDateString();
  const out: AppNotification[] = [];

  for (const t of tasks) {
    if (t.done || !t.due_date) continue;
    const due = new Date(t.due_date);
    if (isNaN(due.getTime())) continue;
    if (due < now && due.toDateString() !== today) {
      out.push({
        id: `overdue-${t.id}`,
        type: "overdue",
        urgent: true,
        title: `Overdue: ${t.title}`,
        subtitle: `Was due ${due.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`,
        time: due,
        read: false,
      });
    } else if (due.toDateString() === today) {
      out.push({
        id: `due-${t.id}`,
        type: "task-due",
        title: `Due today: ${t.title}`,
        subtitle: "Complete before end of day",
        time: due,
        read: false,
      });
    }
  }

  for (const e of exams) {
    if (!e.exam_date) continue;
    const when = new Date(e.exam_date);
    if (isNaN(when.getTime())) continue;
    const daysAway = Math.ceil((when.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysAway >= 0 && daysAway <= 7) {
      out.push({
        id: `exam-${e.id}`,
        type: "exam",
        urgent: daysAway <= 2,
        title: `${e.name} in ${daysAway} day${daysAway !== 1 ? "s" : ""}`,
        subtitle: e.subject || "Exam coming up",
        time: when,
        read: false,
      });
    }
  }

  return out.sort((a, b) => (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0));
}
