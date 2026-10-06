import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MODE_VALUES = [
  "TEACH",
  "PRACTICE",
  "EVALUATE",
  "EXAM",
  "CODING",
  "DEBUG",
  "PROJECT",
  "CHAT",
  "DAILY_PLAN",
] as const;

const LEVEL_VALUES = ["simple", "normal", "technical"] as const;
const QT_VALUES = ["mcq", "short", "conceptual", "numerical", "coding"] as const;
const LANG_VALUES = ["C", "Python", "C++", "HTML", "CSS"] as const;

const ENABLE_UNIFIED_TUTOR = process.env.ENABLE_UNIFIED_TUTOR === "true";

export const unifiedTutor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      mode: z.enum(MODE_VALUES),
      message: z.string().min(1).max(4000),
      subject: z.string().max(200).optional(),
      language: z.enum(LANG_VALUES).optional(),
      level: z.enum(LEVEL_VALUES).optional(),
      questionType: z.enum(QT_VALUES).optional(),
      userAnswer: z.string().max(4000).optional(),
      sessionId: z.string().uuid().optional(),
      availableMinutes: z.number().int().min(15).max(240).optional(),
      examDate: z.string().optional(),
      history: z
        .array(
          z.object({
            role: z.enum(["user", "assistant", "system"]),
            content: z.string().min(1).max(8000),
          }),
        )
        .max(20)
        .optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    if (!ENABLE_UNIFIED_TUTOR) {
      throw new Error("Unified tutor is disabled. Enable ENABLE_UNIFIED_TUTOR to use.");
    }
    const { unifiedTutorImpl } = await import("./unified-tutor.server");
    return unifiedTutorImpl({
      supabase: context.supabase,
      userId: context.userId,
      mode: data.mode,
      message: data.message,
      subject: data.subject,
      language: data.language,
      level: data.level,
      questionType: data.questionType,
      userAnswer: data.userAnswer,
      sessionId: data.sessionId,
      availableMinutes: data.availableMinutes,
      history: data.history,
    });
  });
