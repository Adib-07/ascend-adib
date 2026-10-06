import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { automationRateLimit } from "./rate-limit";
import type { Json, TablesUpdate } from "@/integrations/supabase/types";

const TRIGGER_TYPES = [
  "task_completed",
  "task_overdue",
  "habit_completed",
  "event_upcoming",
  "reminder_due",
  "scheduled_time",
  "document_uploaded",
  "project_completed",
] as const;

const ACTION_TYPES = [
  "create_reminder",
  "create_task",
  "create_habit_log",
  "update_progress",
  "generate_briefing",
  "generate_review",
  "send_notification",
] as const;

export const createAutomationRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, automationRateLimit])
  .validator(
    z.object({
      name: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
      trigger_type: z.enum(TRIGGER_TYPES),
      trigger_config: z.record(z.unknown()).default({}),
      condition_config: z.record(z.unknown()).default({}),
      action_type: z.enum(ACTION_TYPES),
      action_config: z.record(z.unknown()).default({}),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: rule, error } = await supabase
      .from("automation_rules")
      .insert({
        ...data,
        user_id: userId,
        trigger_config: data.trigger_config as Json,
        condition_config: data.condition_config as Json,
        action_config: data.action_config as Json,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rule;
  });

export const updateAutomationRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, automationRateLimit])
  .validator(
    z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(100).optional(),
      description: z.string().max(500).optional(),
      enabled: z.boolean().optional(),
      trigger_type: z.enum(TRIGGER_TYPES).optional(),
      trigger_config: z.record(z.unknown()).optional(),
      condition_config: z.record(z.unknown()).optional(),
      action_type: z.enum(ACTION_TYPES).optional(),
      action_config: z.record(z.unknown()).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { id, ...patch } = data;
    const updateData: TablesUpdate<"automation_rules"> = { ...patch } as TablesUpdate<"automation_rules">;
    if (patch.trigger_config) updateData.trigger_config = patch.trigger_config as Json;
    if (patch.condition_config) updateData.condition_config = patch.condition_config as Json;
    if (patch.action_config) updateData.action_config = patch.action_config as Json;
    const { data: rule, error } = await supabase
      .from("automation_rules")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rule;
  });

export const deleteAutomationRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, automationRateLimit])
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("automation_rules")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const listAutomationRules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      enabled: z.boolean().optional(),
      limit: z.number().int().min(1).max(50).default(50),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    let q = supabase
      .from("automation_rules")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.enabled !== undefined) q = q.eq("enabled", data.enabled);
    const { data: rules, error } = await q;
    if (error) throw new Error(error.message);
    return rules ?? [];
  });

export const listAutomationLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      rule_id: z.string().uuid().optional(),
      limit: z.number().int().min(1).max(100).default(50),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    let q = supabase
      .from("automation_logs")
      .select("*")
      .eq("user_id", userId)
      .order("executed_at", { ascending: false })
      .limit(data.limit);
    if (data.rule_id) q = q.eq("rule_id", data.rule_id);
    const { data: logs, error } = await q;
    if (error) throw new Error(error.message);
    return logs ?? [];
  });
