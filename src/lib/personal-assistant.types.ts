import { z } from "zod";

export const ACTION_TYPES = [
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

export const ActionPayloadSchema = z
  .object({
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
  })
  .strict();

export type ActionPayload = z.infer<typeof ActionPayloadSchema>;
export type ActionType = (typeof ACTION_TYPES)[number];
