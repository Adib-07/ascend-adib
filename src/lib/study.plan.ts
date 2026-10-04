import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface StudyBlock {
  day: string; // ISO date
  blocks: Array<{
    subject: string;
    topic: string;
    durationMinutes: number;
    type: "STUDY" | "REVISION" | "PRACTICE";
  }>;
}

export interface StudyPlan {
  generatedAt: string;
  horizonDays: number;
  blocks: StudyBlock[];
  totalMinutes: number;
}

function getAvailableMinutes(
  availability: Record<string, number> | null,
  dayOfWeek: number,
): number {
  const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const key = days[dayOfWeek];
  return availability?.[key] ?? 60; // default 60 min
}

export const generateStudyPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      horizonDays: z.number().int().min(1).max(30).default(14),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const horizonDays = data.horizonDays;

    // fetch student profile for availability
    const { data: profile } = await supabase
      .from("student_profile")
      .select("study_availability, preferred_session_length")
      .eq("user_id", userId)
      .maybeSingle();

    const availability = profile?.study_availability ?? {};
    const sessionLength = profile?.preferred_session_length ?? 45;

    // fetch upcoming exams with intelligence
    const { data: exams } = await supabase
      .from("exams")
      .select("*")
      .eq("user_id", userId)
      .gte("exam_date", new Date().toISOString().split("T")[0])
      .order("exam_date", { ascending: true });

    // get weak topics from learn_topics progress < 50
    const { data: weakTopics } = await supabase
      .from("learn_topics")
      .select("id, topic, skill, progress")
      .eq("user_id", userId)
      .lt("progress", 50)
      .order("progress", { ascending: true })
      .limit(10);

    // get upcoming exams with syllabus
    const examsWithTopics = [];
    for (const exam of (
      await supabase
        .from("exams")
        .select("*")
        .eq("user_id", userId)
        .gte("exam_date", new Date().toISOString().split("T")[0])
        .order("exam_date")
    ).data ?? []) {
      const syllabus = (exam.syllabus as any[]) ?? [];
      const topicIds = syllabus.map((s: any) => s.id).filter(Boolean);
      const { data: topics } = await supabase
        .from("learn_topics")
        .select("id, topic, skill, progress, status")
        .in("id", topicIds)
        .eq("user_id", userId);
      examsWithTopics.push({ exam, topics: topics ?? [] });
    }

    // Build daily schedule for horizonDays
    const blocks: any[] = [];
    const today = new Date();
    for (let d = 0; d < horizonDays; d++) {
      const date = new Date();
      date.setDate(today.getDate() + d);
      const dateStr = date.toISOString().split("T")[0];
      const dayOfWeek = date.getDay();

      const available = getAvailableMinutes(null, date.getDay()); // TODO: use profile availability
      if (available <= 0) continue;

      let remaining = available;
      const dayBlocks = [];

      // prioritize weak areas first
      for (const weak of (await getWeakTopics(userId, supabase)).slice(0, 2)) {
        if (remaining <= 0) break;
        const dur = Math.min(weak.durationMinutes ?? 30, remaining);
        dayBlocks.push({
          subject: weak.subject,
          topic: weak.topic,
          durationMinutes: dur,
          type: "STUDY",
        });
        remaining -= dur;
      }

      // upcoming exam topics
      for (const ew of examsWithTopics) {
        for (const t of ew.topics.filter((tp: any) => tp.progress < 100 && tp.status !== "Done")) {
          if (remaining <= 0) break;
          const dur = Math.min(45, remaining);
          dayBlocks.push({
            subject: ew.exam.subject,
            topic: t.topic,
            durationMinutes: dur,
            type: "REVISION",
          });
          remaining -= dur;
        }
      }

      // fill remaining with practice
      while (remaining >= 15) {
        dayBlocks.push({
          subject: "Practice",
          topic: "Mixed practice",
          durationMinutes: Math.min(30, remaining),
          type: "PRACTICE",
        });
        remaining -= 30;
      }

      if (dayBlocks.length) {
        blocks.push({ day: dateStr, blocks: dayBlocks });
      }
    }

    const totalMinutes = blocks.flatMap((b) => b.blocks).reduce((s, b) => s + b.durationMinutes, 0);

    return {
      generatedAt: new Date().toISOString(),
      horizonDays,
      blocks,
      totalMinutes,
    };
  });

// helper to fetch weak topics
async function getWeakTopics(userId: string, supabase: any) {
  const { data } = await supabase
    .from("learn_topics")
    .select("id, topic, skill, progress")
    .eq("user_id", userId)
    .lt("progress", 50)
    .order("progress", { ascending: true })
    .limit(5);
  return (data ?? []).map((t: any) => ({
    topicId: t.id,
    topic: t.topic,
    subject: t.skill,
    durationMinutes: 30,
  }));
}
