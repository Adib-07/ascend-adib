import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface WeakArea {
  topicId: string;
  topic: string;
  subject: string | null;
  progress: number;
  signals: string[];
  severity: "LOW" | "MEDIUM" | "HIGH";
  lastStudied: string | null;
  suggestedAction: string;
}

function assessWeakArea(topic: any): WeakArea | null {
  const signals: string[] = [];
  let severityScore = 0;

  if (topic.progress < 30) {
    signals.push(`Low completion (${topic.progress}%)`);
    severityScore += 3;
  } else if (topic.progress < 50) {
    signals.push(`Below half completion (${topic.progress}%)`);
    severityScore += 2;
  }

  if (topic.last_practiced) {
    const daysSince = Math.floor(
      (Date.now() - new Date(topic.last_practiced).getTime()) / 86400000,
    );
    if (daysSince > 14) {
      signals.push(`Not studied for ${daysSince} days`);
      severityScore += 2;
    }
  } else {
    signals.push("Never studied");
    severityScore += 2;
  }

  if (topic.progress < 20) severityScore += 1;

  if (severityScore === 0) return null;

  let severity: "LOW" | "MEDIUM" | "HIGH" = "LOW";
  if (severityScore >= 6) severity = "HIGH";
  else if (severityScore >= 3) severity = "MEDIUM";

  let suggestedAction = "Review fundamentals and schedule practice";
  if (severity === "HIGH") suggestedAction = "Urgent: intensive review + practice problems";
  else if (severity === "MEDIUM") suggestedAction = "Schedule focused review session";

  return {
    topicId: topic.id,
    topic: topic.topic,
    subject: topic.skill,
    progress: topic.progress,
    signals,
    severity,
    lastStudied: topic.last_practiced ?? null,
    suggestedAction,
  };
}

export const getWeakAreas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: topics } = await supabase
      .from("learn_topics")
      .select("*")
      .eq("user_id", userId)
      .lt("progress", 70); // only consider topics not mastered

    if (!topics?.length) return [];

    const weakAreas = topics
      .map((t) => assessWeakArea(t))
      .filter((w): w is NonNullable<typeof w> => w !== null)
      .sort((a, b) => {
        const sevOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
        return sevOrder[b.severity] - sevOrder[a.severity];
      });

    return weakAreas;
  });
