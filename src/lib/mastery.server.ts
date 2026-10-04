import type { SupabaseClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { MAX_TOKENS, MODEL, TEMPERATURE } from "./tutor.server";

export const MASTERY_SCALE = `0 = Not attempted, 1 = Needs major help, 2 = Developing, 3 = Understands, 4 = Strong, 5 = Exam ready.`;

export interface MasteryAssessment {
  level: number; // 0-5
  feedback: string; // Explanation
  correction: string; // What was wrong
  idealAnswer: string; // Model answer
  nextStep: string; // What to do next
}

export interface SM2Result {
  nextReviewDate: string; // YYYY-MM-DD
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
}

export function calculateSM2(
  currentInterval: number,
  currentEaseFactor: number,
  currentRepetitions: number,
  grade: number, // 0-5 (0 = complete blackout, 5 = perfect)
): SM2Result {
  let interval = currentInterval;
  let easeFactor = currentEaseFactor;
  let repetitions = currentRepetitions;

  if (grade >= 3) {
    if (repetitions === 0) interval = 1;
    else if (repetitions === 1) interval = 6;
    else interval = Math.round(interval * easeFactor);
    repetitions += 1;
  } else {
    repetitions = 0;
    interval = 1;
  }

  easeFactor = Math.max(1.3, easeFactor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)));

  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + interval);

  return {
    nextReviewDate: nextReview.toISOString().split("T")[0],
    intervalDays: interval,
    easeFactor: Math.round(easeFactor * 100) / 100,
    repetitions,
  };
}

export async function assessMasteryWithAI(
  supabase: SupabaseClient,
  userId: string,
  question: string,
  userAnswer: string,
  contextItems: any[],
  mode: "EVALUATE" | "PRACTICE",
): Promise<MasteryAssessment> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("AI service not configured");

  const evidence =
    contextItems.length > 0
      ? contextItems
          .map((it) => {
            const loc = [
              it.title,
              it.page ? `page ${it.page}` : null,
              it.heading ? `section: ${it.heading}` : null,
            ]
              .filter(Boolean)
              .join(" | ");
            const link = it.url ? `\nURL: ${it.url}` : "";
            return `[${it.source.toUpperCase()}: ${loc}]${link}\n${it.text}`;
          })
          .join("\n\n")
      : "NO GROUNDED EVIDENCE available.";

  const system = `You are Professor Ascend evaluating a student's answer.
  
MASTERY SCALE: ${MASTERY_SCALE}

Evaluate the student's answer and respond with EXACTLY these sections:
## Result
(State mastery level 0-5 using the scale above)
## Explanation
(Why this level? What was correct? What was missing?)
## Correction
(If there were errors, provide the correct understanding)
## Ideal Answer
(What a mastery-level 5 answer would look like)
## Next Step
(Specific actionable next step for the student)

Be encouraging but honest. Use evidence to ground corrections.`;

  const user = `QUESTION: ${question}

STUDENT ANSWER: ${userAnswer}

GROUND EVIDENCE:
${evidence}

Evaluate using the structure above.`;

  const gateway = createLovableAiGatewayProvider(key);
  const { text } = await generateText({
    model: gateway(MODEL),
    temperature: 0.3,
    maxOutputTokens: Math.min(2000, MAX_TOKENS),
    system,
    prompt: user,
  });

  if (!text?.trim()) throw new Error("Empty response from AI");

  return parseMasteryResponse(text);
}

function parseMasteryResponse(text: string): MasteryAssessment {
  const sections = {
    result: extractSection(text, "Result"),
    explanation: extractSection(text, "Explanation"),
    correction: extractSection(text, "Correction"),
    idealAnswer: extractSection(text, "Ideal Answer"),
    nextStep: extractSection(text, "Next Step"),
  };

  const levelMatch = sections.result.match(/(\d)/);
  const level = levelMatch ? Math.max(0, Math.min(5, parseInt(levelMatch[1]))) : 2;

  return {
    level,
    feedback: sections.explanation || "Assessment completed.",
    correction: sections.correction || "No major corrections needed.",
    idealAnswer: sections.idealAnswer || "See explanation above.",
    nextStep: sections.nextStep || "Continue practicing this concept.",
  };
}

function extractSection(text: string, header: string): string {
  const regex = new RegExp(`## ${header}\\s*([\\s\\S]*?)(?=## |$)`, "i");
  const match = text.match(regex);
  return match ? match[1].trim() : "";
}

export async function updateMasteryAndSchedule(
  supabase: SupabaseClient,
  userId: string,
  entityType: "dsa_attempt" | "programming_exercise" | "learn_topic",
  entityId: string,
  newMasteryLevel: number,
  currentEaseFactor: number = 2.5,
  currentInterval: number = 1,
  currentRepetitions: number = 0,
): Promise<{ nextReviewDate: string; intervalDays: number; easeFactor: number }> {
  const sm2 = calculateSM2(currentInterval, currentEaseFactor, currentRepetitions, newMasteryLevel);

  if (entityType === "dsa_attempt") {
    await supabase
      .from("dsa_attempts")
      .update({
        mastery_level: newMasteryLevel,
        next_review_date: sm2.nextReviewDate,
        review_interval_days: sm2.intervalDays,
        ease_factor: sm2.easeFactor,
        repetitions: sm2.repetitions,
        last_reviewed: new Date().toISOString(),
        mastered_at: newMasteryLevel >= 4 ? new Date().toISOString() : null,
      })
      .eq("id", entityId)
      .eq("user_id", userId);
  } else if (entityType === "programming_exercise") {
    await supabase
      .from("programming_exercises")
      .update({
        mastery_level: newMasteryLevel,
      })
      .eq("id", entityId)
      .eq("user_id", userId);
  } else if (entityType === "learn_topic") {
    await supabase
      .from("learn_topics")
      .update({
        mastery_level: newMasteryLevel,
        last_practiced: new Date().toISOString(),
      })
      .eq("id", entityId)
      .eq("user_id", userId);
  }

  // Update or create revision_schedule entry
  await supabase.from("revision_schedule").upsert(
    {
      user_id: userId,
      source_type:
        entityType === "learn_topic"
          ? "learn_topic"
          : entityType === "dsa_attempt"
            ? "dsa_pattern"
            : "programming_concept",
      source_id: entityId,
      source_title: "", // Would need to fetch title
      next_review_date: sm2.nextReviewDate,
      interval_days: sm2.intervalDays,
      ease_factor: sm2.easeFactor,
      repetitions: sm2.repetitions,
      last_reviewed: new Date().toISOString(),
      last_grade: newMasteryLevel,
    },
    { onConflict: "user_id,source_type,source_id" },
  );

  return sm2;
}

export function classifyErrorType(errorDescription: string): string {
  const desc = errorDescription.toLowerCase();

  if (
    desc.includes("syntax") ||
    desc.includes("parse") ||
    desc.includes("compile") ||
    desc.includes("missing semicolon") ||
    desc.includes("bracket") ||
    desc.includes("parenthesis")
  ) {
    return "syntax";
  }
  if (
    desc.includes("logic") ||
    desc.includes("condition") ||
    desc.includes("branch") ||
    desc.includes("wrong output") ||
    desc.includes("incorrect result")
  ) {
    return "logic";
  }
  if (
    desc.includes("concept") ||
    desc.includes("misunderstand") ||
    desc.includes("don't understand") ||
    desc.includes("confused") ||
    desc.includes("wrong mental model")
  ) {
    return "concept";
  }
  if (
    desc.includes("edge") ||
    desc.includes("boundary") ||
    desc.includes("empty") ||
    desc.includes("null") ||
    desc.includes("zero") ||
    desc.includes("overflow")
  ) {
    return "edge_case";
  }
  if (
    desc.includes("complexity") ||
    desc.includes("time limit") ||
    desc.includes("too slow") ||
    desc.includes("O(") ||
    desc.includes("optimization")
  ) {
    return "complexity";
  }
  if (
    desc.includes("memory") ||
    desc.includes("leak") ||
    desc.includes("allocation") ||
    desc.includes("free") ||
    desc.includes("pointer") ||
    desc.includes("segfault")
  ) {
    return "memory";
  }
  if (
    desc.includes("debug") ||
    desc.includes("breakpoint") ||
    desc.includes("trace") ||
    desc.includes("watch") ||
    desc.includes("step through")
  ) {
    return "debugging";
  }
  if (
    desc.includes("interpret") ||
    desc.includes("read") ||
    desc.includes("understand problem") ||
    desc.includes("requirement") ||
    desc.includes("what is asked")
  ) {
    return "interpretation";
  }
  if (
    desc.includes("pattern") ||
    desc.includes("technique") ||
    desc.includes("approach") ||
    desc.includes("which algorithm") ||
    desc.includes("data structure")
  ) {
    return "pattern";
  }

  return "logic";
}
