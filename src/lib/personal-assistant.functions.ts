import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { aiRateLimit, automationRateLimit } from "./rate-limit";

const ACTION_TYPES = [
  "create_task",
  "create_reminder",
  "create_event",
  "create_habit",
  "create_goal",
  "create_project",
  "create_study_plan",
  "log_revision",
  "update_topic",
  "run_automation",
] as const;

const ActionPayloadSchema = z.object({
  title: z.string().optional(),
  priority: z.enum(["High", "Medium", "Low"]).optional(),
  due_date: z.string().optional(),
  type: z.enum(["Study", "Work", "Personal"]).optional(),
  mit_slot: z.boolean().optional(),
  message: z.string().optional(),
  trigger_at: z.string().optional(),
  related_type: z.string().optional(),
  related_id: z.string().optional(),
  description: z.string().optional(),
  start_at: z.string().optional(),
  end_at: z.string().optional(),
  all_day: z.boolean().optional(),
  location: z.string().optional(),
  name: z.string().optional(),
  category: z.string().optional(),
  frequency: z.enum(["daily", "weekly", "custom"]).optional(),
  target: z.number().optional(),
  metric_type: z.enum(["count", "minutes", "boolean"]).optional(),
  unit: z.string().optional(),
  scope: z.string().optional(),
  text: z.string().optional(),
  deadline: z.string().optional(),
  status: z.string().optional(),
  progress: z.number().optional(),
  mastery_level: z.number().optional(),
  source_type: z.string().optional(),
  source_id: z.string().optional(),
  source_title: z.string().optional(),
  next_review_date: z.string().optional(),
  priority_boost: z.number().optional(),
  topic_id: z.string().optional(),
  automation_id: z.string().optional(),
});

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
    type: (typeof ACTION_TYPES)[number];
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
