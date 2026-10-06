import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { QuestionType, TutorLevel, TutorMode } from "./student-tutor-core";

const MODE_VALUES = ["TEACH", "PRACTICE", "EVALUATE", "EXAM", "CHAT"] as const;
const LEVEL_VALUES = ["simple", "normal", "technical"] as const;
const QT_VALUES = ["mcq", "short", "conceptual", "numerical", "coding"] as const;

export const studentTutor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      mode: z.enum(MODE_VALUES),
      message: z.string().min(1).max(4000),
      subject: z.string().max(200).optional(),
      level: z.enum(LEVEL_VALUES).optional(),
      questionType: z.enum(QT_VALUES).optional(),
      userAnswer: z.string().max(4000).optional(),
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
    const { studentTutorImpl } = await import("./student-tutor.server");
    return studentTutorImpl({
      supabase: context.supabase,
      userId: context.userId,
      mode: data.mode as TutorMode,
      message: data.message,
      subject: data.subject,
      level: data.level as TutorLevel | undefined,
      questionType: data.questionType as QuestionType | undefined,
      userAnswer: data.userAnswer,
      history: data.history,
    });
  });

export const groundedTutor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      mode: z.enum(MODE_VALUES),
      message: z.string().min(1).max(4000),
      subject: z.string().max(200).optional(),
      level: z.enum(LEVEL_VALUES).optional(),
      questionType: z.enum(QT_VALUES).optional(),
      userAnswer: z.string().max(4000).optional(),
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
    const { groundedTutorImpl } = await import("./student-tutor.server");
    return groundedTutorImpl({
      supabase: context.supabase,
      userId: context.userId,
      mode: data.mode as TutorMode,
      message: data.message,
      subject: data.subject,
      level: data.level as TutorLevel | undefined,
      questionType: data.questionType as QuestionType | undefined,
      userAnswer: data.userAnswer,
      history: data.history,
    });
  });
