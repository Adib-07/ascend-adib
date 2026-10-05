import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { aiRateLimit, automationRateLimit } from "./rate-limit";
import { ActionPayloadSchema, ActionType, ACTION_TYPES } from "./personal-assistant.types";

const AskSchema = z.object({
  question: z.string().min(1).max(4000),
  subject: z.string().max(200).optional(),
  category: z
    .enum([
      "ACADEMIC",
      "PROGRAMMING",
      "EXAM_PREPARATION",
      "SYLLABUS",
      "DOCUMENT",
      "ENGLISH",
      "LIFE_SKILLS",
      "GENERAL",
      "WORK",
      "CLIENT",
      "FREELANCING",
    ])
    .optional(),
  mode: z.enum(["student", "work"]).optional(),
});

export const personalAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, aiRateLimit])
  .inputValidator(AskSchema)
  .handler(async ({ context, data }) => {
    const { personalAssistantImpl } = await import("./personal-assistant.server");
    return personalAssistantImpl({
      supabase: context.supabase,
      userId: context.userId,
      question: data.question,
      subject: data.subject,
      history: undefined,
    });
  });

export interface ExecuteActionInput {
  action: {
    type: ActionType;
    payload: z.infer<typeof ActionPayloadSchema>;
    description: string;
    requiresConfirmation: boolean;
  };
  confirm: boolean;
}

export const executeAssistantAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, automationRateLimit])
  .inputValidator(
    z.object({
      action: z.object({
        type: z.enum(ACTION_TYPES),
        payload: ActionPayloadSchema,
        description: z.string(),
        requiresConfirmation: z.boolean(),
      }),
      confirm: z.boolean(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { executeActionImpl } = await import("./personal-assistant.server");
    return executeActionImpl({
      supabase: context.supabase,
      userId: context.userId,
      action: data.action,
      confirm: data.confirm,
    });
  });
