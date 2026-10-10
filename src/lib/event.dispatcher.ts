import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tables } from "@/integrations/supabase/types";
import {
  runAutomation,
  evaluateAutomation,
  logExecution,
  checkIdempotency,
  generateExecutionId,
  type EvaluationResult,
  type ExecutionResult,
} from "./automation.runner";
import {
  type DomainEvent,
  type DomainEventType,
  type DomainEventPayload,
  createEvent,
} from "./events.types";
import { logAutomationError, logSchedulerError } from "./logger";
import { todayISO } from "./date-core";

export interface EventDispatchResult {
  success: boolean;
  matchedRules: number;
  executedAutomations: number;
  errors: string[];
}

export interface EventDispatchContext {
  supabase: SupabaseClient;
  userId: string;
  event: DomainEvent;
  eventIdempotencyKey: string;
}

async function checkEventIdempotency(
  supabase: SupabaseClient,
  userId: string,
  eventIdempotencyKey: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("event_processing_logs")
    .select("id")
    .eq("user_id", userId)
    .eq("event_idempotency_key", eventIdempotencyKey)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

async function logEventProcessing(
  supabase: SupabaseClient,
  userId: string,
  eventIdempotencyKey: string,
  eventType: string,
  entityId: string,
  status: "success" | "failed" | "skipped",
  matchedRules: number,
  executedAutomations: number,
  errorMessage: string | null,
): Promise<string> {
  const { data, error } = await supabase
    .from("event_processing_logs")
    .insert({
      user_id: userId,
      event_idempotency_key: eventIdempotencyKey,
      event_type: eventType,
      entity_id: entityId,
      status,
      matched_rules: matchedRules,
      executed_automations: executedAutomations,
      error_message: errorMessage,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function dispatchEvent(
  supabase: SupabaseClient,
  userId: string,
  event: DomainEvent,
): Promise<EventDispatchResult> {
  const eventIdempotencyKey = `${event.type}:${event.entityId}:${event.timestamp}`;

  const idempotent = await checkEventIdempotency(supabase, userId, eventIdempotencyKey);
  if (idempotent) {
    return {
      success: true,
      matchedRules: 0,
      executedAutomations: 0,
      errors: ["Event already processed (idempotency)"],
    };
  }

  const triggerData: Record<string, unknown> = {
    ...event.payload,
    event_type: event.type,
    event_entity_id: event.entityId,
    event_timestamp: event.timestamp,
  };

  const { data: rules, error: rulesError } = await supabase
    .from("automation_rules")
    .select("*")
    .eq("user_id", userId)
    .eq("enabled", true)
    .eq("trigger_type", event.type);

  if (rulesError) throw rulesError;

  let matchedRules = 0;
  let executedAutomations = 0;
  const errors: string[] = [];

  for (const rule of rules ?? []) {
    const evaluation = await evaluateAutomation(supabase, userId, rule, {
      ...triggerData,
      event_type: event.type,
    });
    if (!evaluation.shouldExecute) {
      continue;
    }

    matchedRules++;

    try {
      const executionResult = await runAutomation(supabase, userId, rule.id, {
        ...triggerData,
        event_type: event.type,
      });

      if (executionResult.success) {
        executedAutomations += executionResult.actionsExecuted;
      } else {
        errors.push(`Automation ${rule.id} failed: ${executionResult.error}`);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logAutomationError(rule.id, err, { eventType: event.type, eventEntityId: event.entityId });
      errors.push(`Automation ${rule.id} threw: ${err.message}`);
    }
  }

  const status = errors.length > 0 ? "failed" : "success";
  await logEventProcessing(
    supabase,
    userId,
    eventIdempotencyKey,
    event.type,
    event.entityId,
    status,
    matchedRules,
    executedAutomations,
    errors.length > 0 ? errors.join("; ") : null,
  );

  return {
    success: errors.length === 0,
    matchedRules,
    executedAutomations,
    errors,
  };
}

export async function runScheduledAutomationSweep(
  supabase: SupabaseClient,
  options: { batchSize?: number; lookAheadMinutes?: number } = {},
): Promise<{
  processedRules: number;
  executedAutomations: number;
  skipped: number;
  errors: string[];
}> {
  const { batchSize = 50, lookAheadMinutes = 5 } = options;
  const now = new Date();
  const lookAheadTime = new Date(now.getTime() + lookAheadMinutes * 60 * 1000);

  let processedRules = 0;
  let executedAutomations = 0;
  let skipped = 0;
  const errors: string[] = [];

  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data: rules, error: rulesError } = await supabase
      .from("automation_rules")
      .select("*")
      .eq("enabled", true)
      .eq("trigger_type", "scheduled_time")
      .range(offset, offset + batchSize - 1);

    if (rulesError) throw rulesError;
    if (!rules || rules.length === 0) {
      hasMore = false;
      break;
    }

    for (const rule of rules) {
      processedRules++;

      const triggerConfig = rule.trigger_config as { schedule?: string; timezone?: string };
      const schedule = triggerConfig.schedule;
      const timezone = triggerConfig.timezone || "UTC";

      if (!schedule) {
        skipped++;
        continue;
      }

      const triggerData = {
        user_id: rule.user_id,
        scheduled_time: true,
        rule_id: rule.id,
        rule_trigger_type: "scheduled_time",
      };

      const evaluation = await evaluateAutomation(supabase, rule.user_id, rule, triggerData);

      if (!evaluation.shouldExecute) {
        if (
          evaluation.reason.includes("idempotency") ||
          evaluation.reason.includes("Already executed")
        ) {
          skipped++;
        } else if (evaluation.reason.includes("Schedule not matched")) {
          // Not due yet, not an error
        } else {
          errors.push(`Rule ${rule.id}: ${evaluation.reason}`);
        }
        continue;
      }

      try {
        const executionResult = await runAutomation(supabase, rule.user_id, rule.id, triggerData);
        if (executionResult.success) {
          executedAutomations += executionResult.actionsExecuted;
        } else {
          errors.push(`Rule ${rule.id}: ${executionResult.error}`);
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logAutomationError(rule.id, err, { scheduled: true, triggerData });
        errors.push(`Rule ${rule.id} threw: ${err.message}`);
      }
    }

    offset += batchSize;
    if (rules.length < batchSize) {
      hasMore = false;
    }
  }

  return {
    processedRules,
    executedAutomations,
    skipped,
    errors,
  };
}

export async function processDueReminders(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ processed: number; errors: string[] }> {
  const now = new Date().toISOString();

  const { data: reminders, error } = await supabase
    .from("reminders")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "pending")
    .lte("trigger_at", now);

  if (error) throw error;

  let processed = 0;
  const errors: string[] = [];

  for (const reminder of reminders ?? []) {
    try {
      const event = createEvent("REMINDER_DUE", userId, reminder.id, {
        reminderId: reminder.id,
        title: reminder.title,
        message: reminder.message,
        triggerAt: reminder.trigger_at,
      });

      const result = await dispatchEvent(supabase, userId, event);
      if (result.success) {
        processed++;
      } else {
        errors.push(...result.errors);
      }

      await supabase.from("reminders").update({ status: "sent" }).eq("id", reminder.id);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      errors.push(`Reminder ${reminder.id}: ${err.message}`);
    }
  }

  return { processed, errors };
}

export async function processUpcomingEvents(
  supabase: SupabaseClient,
  userId: string,
  lookAheadMinutes: number = 30,
): Promise<{ processed: number; errors: string[] }> {
  const now = new Date();
  const lookAheadTime = new Date(now.getTime() + lookAheadMinutes * 60 * 1000);

  const { data: events, error } = await supabase
    .from("events")
    .select("*")
    .eq("user_id", userId)
    .gte("start_at", now.toISOString())
    .lte("start_at", lookAheadTime.toISOString());

  if (error) throw error;

  let processed = 0;
  const errors: string[] = [];

  for (const event of events ?? []) {
    try {
      const domainEvent = createEvent("EVENT_UPCOMING", userId, event.id, {
        eventId: event.id,
        title: event.title,
        startAt: event.start_at,
        endAt: event.end_at,
        location: event.location,
      });

      const result = await dispatchEvent(supabase, userId, domainEvent);
      if (result.success) {
        processed++;
      } else {
        errors.push(...result.errors);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      errors.push(`Event ${event.id}: ${err.message}`);
    }
  }

  return { processed, errors };
}

export async function processOverdueTasks(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ processed: number; errors: string[] }> {
  // Business-timezone "today", consistent with task due-date logic elsewhere.
  const today = todayISO();

  const { data: tasks, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .eq("done", false)
    .lt("due_date", today);

  if (error) throw error;

  let processed = 0;
  const errors: string[] = [];

  for (const task of tasks ?? []) {
    try {
      const domainEvent = createEvent("TASK_OVERDUE", userId, task.id, {
        taskId: task.id,
        title: task.title,
        dueDate: task.due_date,
      });

      const result = await dispatchEvent(supabase, userId, domainEvent);
      if (result.success) {
        processed++;
      } else {
        errors.push(...result.errors);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      errors.push(`Task ${task.id}: ${err.message}`);
    }
  }

  return { processed, errors };
}
