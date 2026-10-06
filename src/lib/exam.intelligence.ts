import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ExamPriority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface ExamIntelligence {
  examId: string;
  name: string;
  subject: string | null;
  examDate: string | null;
  daysRemaining: number | null;
  priority: ExamPriority;
  totalTopics: number;
  completedTopics: number;
  incompleteTopics: string[];
  studyWorkloadMinutes: number;
  revisionStatus: "NOT_STARTED" | "IN_PROGRESS" | "READY";
}

function calculatePriority(
  daysRemaining: number | null,
  completedRatio: number,
  weakAreaCount: number,
): ExamPriority {
  if (daysRemaining === null) return "LOW";
  if (daysRemaining <= 2) return "CRITICAL";
  if (daysRemaining <= 7 && completedRatio < 0.5) return "CRITICAL";
  if (daysRemaining <= 7) return "HIGH";
  if (daysRemaining <= 14 && completedRatio < 0.3) return "HIGH";
  if (daysRemaining <= 14) return "MEDIUM";
  if (completedRatio < 0.4 && weakAreaCount > 2) return "HIGH";
  return "LOW";
}

export const getExamIntelligence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ examId: z.string().uuid().optional() }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    let query = supabase.from("exams").select("*").eq("user_id", userId);
    if (data.examId) {
      query = query.eq("id", data.examId);
    }
    const { data: exams, error } = await query;
    if (error) throw error;

    const today = new Date();
    const results = [];

    for (const exam of exams ?? []) {
      // get topics for this exam (via syllabus)
      const syllabus = (exam.syllabus as unknown as Array<{ id: string }>) ?? [];
      const topicIds = syllabus.map((s) => s.id).filter(Boolean);
      let completedTopics = 0;
      let incompleteTopics: string[] = [];
      if (topicIds.length) {
        const { data: topics } = await supabase
          .from("learn_topics")
          .select("id, topic, status, progress")
          .in("id", topicIds)
          .eq("user_id", userId);
        for (const t of topics ?? []) {
          if (t.status === "Done" || (t.progress ?? 0) >= 100) completedTopics++;
          else incompleteTopics.push(t.topic);
        }
      }

      const daysRemaining = exam.exam_date
        ? Math.ceil((new Date(exam.exam_date).getTime() - Date.now()) / 86400000)
        : null;

      // weak areas related to exam subject
      const { data: weakAreas } = await supabase
        .from("learn_topics")
        .select("id")
        .eq("user_id", userId)
        .eq("skill", exam.subject ?? "")
        .lt("progress", 50);
      const weakAreaCount = (weakAreas ?? []).length;

      const completedRatio = syllabus.length ? completedTopics / syllabus.length : 0;
      const priority = calculatePriority(daysRemaining, completedRatio, weakAreaCount);

      let revisionStatus: "NOT_STARTED" | "IN_PROGRESS" | "READY" = "NOT_STARTED";
      if (completedRatio === 1) revisionStatus = "READY";
      else if (completedRatio > 0) revisionStatus = "IN_PROGRESS";

      const studyWorkloadMinutes = Math.ceil((syllabus.length - completedTopics) * 45);

      results.push({
        examId: exam.id,
        name: exam.name,
        subject: exam.subject,
        examDate: exam.exam_date,
        daysRemaining,
        priority,
        totalTopics: syllabus.length,
        completedTopics,
        incompleteTopics,
        studyWorkloadMinutes,
        revisionStatus,
      });
    }

    return data?.examId ? results[0] : results;
  });
