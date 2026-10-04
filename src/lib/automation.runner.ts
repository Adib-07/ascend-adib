import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { generateText } from "ai";
import { MAX_TOKENS, MODEL, TEMPERATURE } from "./tutor.server";
import { logAutomationError, logAIError } from "./logger";

export type AutomationTriggerType =
  | "scheduled_time"
  | "task_completed"
  | "task_overdue"
  | "habit_completed"
  | "event_upcoming"
  | "reminder_due"
  | "document_uploaded"
  | "project_completed"
  | "manual";

export type AutomationActionType =
  | "create_task"
  | "create_reminder"
  | "create_event"
  | "create_habit_log"
  | "create_note"
  | "update_progress"
  | "generate_briefing"
  | "generate_review"
  | "send_notification";

export interface TriggerConfig {
  schedule?: string;
  timezone?: string;
  task_id?: string;
  habit_id?: string;
  event_id?: string;
  reminder_id?: string;
  project_id?: string;
  document_id?: string;
  days_of_week?: number[];
  hour?: number;
  minute?: number;
}

export interface ConditionConfig {
  field: string;
  operator: "equals" | "not_equals" | "contains" | "greater_than" | "less_than" | "in" | "not_in";
  value: unknown;
}

export interface ActionConfig {
  task_title?: string;
  task_priority?: "Low" | "Medium" | "High";
  task_due_date?: string;
  task_due_time?: string;
  task_type?: string;
  reminder_title?: string;
  reminder_message?: string;
  reminder_trigger_at?: string;
  reminder_timezone?: string;
  event_title?: string;
  event_description?: string;
  event_start_at?: string;
  event_end_at?: string;
  event_timezone?: string;
  event_all_day?: boolean;
  habit_id?: string;
  habit_value?: number;
  note_title?: string;
  note_content?: string;
  note_tag?: string;
  project_id?: string;
  progress?: number;
  briefing_date?: string;
  review_week_start?: string;
  notification_title?: string;
  notification_message?: string;
}

export interface AutomationContext {
  supabase: SupabaseClient;
  userId: string;
  now: Date;
  triggerData?: Record<string, unknown>;
}

export interface EvaluationResult {
  shouldExecute: boolean;
  reason: string;
  executionId: string;
}

export interface ActionResult {
  success: boolean;
  result?: Record<string, unknown>;
  error?: string;
}

export interface ExecutionResult {
  success: boolean;
  actionsExecuted: number;
  actionsFailed: number;
  results: ActionResult[];
  logId?: string;
  error?: string;
}

export async function generateExecutionId(ruleId: string, triggerTime: Date): Promise<string> {
  const bucket = new Date(triggerTime);
  bucket.setMinutes(0, 0, 0);
  const key = `${ruleId}:${bucket.toISOString()}`;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

export interface SerializedActionResult {
  success: boolean;
  result?: Record<string, string | number | boolean | null>;
  error?: string;
}

export interface SerializedExecutionResult {
  success: boolean;
  actionsExecuted: number;
  actionsFailed: number;
  results: SerializedActionResult[];
  logId?: string;
  error?: string;
}

export interface SerializedActionResult {
  success: boolean;
  result?: Record<string, string | number | boolean | null>;
  error?: string;
}

export interface SerializedExecutionResult {
  success: boolean;
  actionsExecuted: number;
  actionsFailed: number;
  results: SerializedActionResult[];
  logId?: string;
  error?: string;
}

export async function checkIdempotency(
  supabase: SupabaseClient,
  ruleId: string,
  executionId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("automation_logs")
    .select("id")
    .eq("rule_id", ruleId)
    .eq("execution_id", executionId)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function logExecution(
  supabase: SupabaseClient,
  userId: string,
  ruleId: string,
  executionId: string,
  status: "success" | "failed" | "skipped",
  triggerData: Record<string, unknown> | null,
  conditionResult: boolean | null,
  actionResult: Record<string, unknown> | null,
  errorMessage: string | null,
): Promise<string> {
  const { data, error } = await supabase
    .from("automation_logs")
    .insert({
      user_id: userId,
      rule_id: ruleId,
      execution_id: executionId,
      status,
      trigger_data: triggerData,
      condition_result: conditionResult,
      action_result: actionResult,
      error_message: errorMessage,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function evaluateConditions(
  supabase: SupabaseClient,
  userId: string,
  conditions: ConditionConfig[],
  context: Record<string, unknown>,
): Promise<{ passed: boolean; results: Array<{ condition: ConditionConfig; passed: boolean }> }> {
  const results: Array<{ condition: ConditionConfig; passed: boolean }> = [];

  for (const condition of conditions) {
    let value = context[condition.field];
    let passed = false;

    if (value === undefined || value === null) {
      passed = false;
    } else {
      switch (condition.operator) {
        case "equals":
          passed = value === condition.value;
          break;
        case "not_equals":
          passed = value !== condition.value;
          break;
        case "contains":
          passed = String(value).toLowerCase().includes(String(condition.value).toLowerCase());
          break;
        case "greater_than":
          passed = Number(value) > Number(condition.value);
          break;
        case "less_than":
          passed = Number(value) < Number(condition.value);
          break;
        case "in":
          passed = Array.isArray(condition.value) && condition.value.includes(value);
          break;
        case "not_in":
          passed = Array.isArray(condition.value) && !condition.value.includes(value);
          break;
        default:
          passed = false;
      }
    }
    results.push({ condition, passed });
  }

  const allPassed = results.every((r) => r.passed);
  return { passed: allPassed, results };
}

async function buildContext(
  supabase: SupabaseClient,
  userId: string,
  triggerData: Record<string, unknown> | null,
): Promise<Record<string, unknown>> {
  const context: Record<string, unknown> = { ...(triggerData ?? {}) };

  const now = new Date();
  context["now"] = now.toISOString();
  context["today"] = now.toISOString().split("T")[0];
  context["now_timestamp"] = now.getTime();

  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title, done, priority, due_date, due_time, type")
    .eq("user_id", userId);
  context["tasks"] = tasks ?? [];

  const { data: habits } = await supabase
    .from("habits")
    .select("id, name, streak, last_done, target, frequency")
    .eq("user_id", userId);
  context["habits"] = habits ?? [];

  const { data: events } = await supabase
    .from("events")
    .select("id, title, start_at, end_at, all_day")
    .eq("user_id", userId)
    .gte("start_at", new Date().toISOString().split("T")[0]);
  context["events"] = events ?? [];

  const { data: reminders } = await supabase
    .from("reminders")
    .select("id, title, trigger_at, status")
    .eq("user_id", userId)
    .eq("status", "pending");
  context["reminders"] = reminders ?? [];

  const { data: goals } = await supabase
    .from("goals")
    .select("id, text, scope, done, deadline")
    .eq("user_id", userId);
  context["goals"] = goals ?? [];

  return context;
}

export async function evaluateAutomation(
  supabase: SupabaseClient,
  userId: string,
  rule: Tables<"automation_rules">,
  triggerData: Record<string, unknown> | null,
): Promise<EvaluationResult> {
  const executionId = await generateExecutionId(rule.id, new Date());

  const idempotent = await checkIdempotency(supabase, rule.id, executionId);
  if (idempotent) {
    return {
      shouldExecute: false,
      reason: "Already executed in this time window (idempotency)",
      executionId,
    };
  }

  const now = new Date();
  const triggerType = rule.trigger_type as AutomationTriggerType;
  const triggerConfig = rule.trigger_config as TriggerConfig;

  let shouldExecute = false;
  let reason = "";

  switch (triggerType) {
    case "scheduled_time": {
      const schedule = triggerConfig.schedule;
      const timezone = triggerConfig.timezone || "UTC";
      if (schedule && matchesSchedule(now, schedule, timezone)) {
        shouldExecute = true;
        reason = `Schedule matched: ${schedule} in ${timezone}`;
      } else {
        reason = `Schedule not matched: ${schedule} in ${timezone}`;
      }
      break;
    }
    case "task_completed": {
      const taskId = triggerConfig.task_id;
      if (triggerData?.task_id === taskId && triggerData?.completed === true) {
        shouldExecute = true;
        reason = `Task ${taskId} completed`;
      } else {
        reason = "Task not completed or wrong task";
      }
      break;
    }
    case "task_overdue": {
      const userIdForQuery = (triggerData?.user_id as string) || rule.user_id;
      const { data: overdueTasks } = await supabase
        .from("tasks")
        .select("id")
        .eq("user_id", userIdForQuery)
        .eq("done", false)
        .lt("due_date", new Date().toISOString().split("T")[0]);
      if (overdueTasks && overdueTasks.length > 0) {
        shouldExecute = true;
        reason = `${overdueTasks.length} overdue tasks`;
      } else {
        reason = "No overdue tasks";
      }
      break;
    }
    case "habit_completed": {
      const habitId = triggerConfig.habit_id;
      if (triggerData?.habit_id === habitId && triggerData?.completed === true) {
        shouldExecute = true;
        reason = `Habit ${habitId} completed`;
      } else {
        reason = "Habit not completed or wrong habit";
      }
      break;
    }
    case "event_upcoming": {
      const eventId = triggerConfig.event_id;
      if (triggerData?.event_id === eventId) {
        shouldExecute = true;
        reason = `Event ${eventId} upcoming`;
      } else {
        reason = "Event not upcoming or wrong event";
      }
      break;
    }
    case "reminder_due": {
      const reminderId = triggerConfig.reminder_id;
      if (triggerData?.reminder_id === reminderId) {
        shouldExecute = true;
        reason = `Reminder ${reminderId} due`;
      } else {
        reason = "Reminder not due or wrong reminder";
      }
      break;
    }
    case "document_uploaded": {
      const documentId = triggerConfig.document_id;
      if (triggerData?.document_id === documentId) {
        shouldExecute = true;
        reason = `Document ${documentId} uploaded`;
      } else {
        reason = "Document not uploaded or wrong document";
      }
      break;
    }
    case "project_completed": {
      const projectId = triggerConfig.project_id;
      if (triggerData?.project_id === projectId && triggerData?.completed === true) {
        shouldExecute = true;
        reason = `Project ${projectId} completed`;
      } else {
        reason = "Project not completed or wrong project";
      }
      break;
    }
    case "manual": {
      shouldExecute = true;
      reason = "Manual trigger";
      break;
    }
    default:
      reason = `Unknown trigger type: ${triggerType}`;
  }

  if (!shouldExecute) {
    return { shouldExecute: false, reason, executionId };
  }

  const conditions = rule.condition_config as unknown as ConditionConfig[];
  if (conditions && conditions.length > 0) {
    const context = await buildContext(supabase, rule.user_id, triggerData);
    const { passed } = await evaluateConditions(supabase, rule.user_id, conditions, context);
    if (!passed) {
      return { shouldExecute: false, reason: "Conditions not met", executionId };
    }
  }

  return { shouldExecute: true, reason, executionId };
}

export function matchesSchedule(now: Date, schedule: string, timezone: string): boolean {
  try {
    const parts = schedule.split(" ");
    if (parts.length === 5) {
      const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
      const nowInTz = new Date(now.toLocaleString("en-US", { timeZone: timezone }));

      const matchMinute = minute === "*" || Number(minute) === nowInTz.getMinutes();
      const matchHour = hour === "*" || Number(hour) === nowInTz.getHours();
      const matchDayOfMonth = dayOfMonth === "*" || Number(dayOfMonth) === nowInTz.getDate();
      const matchMonth = month === "*" || Number(month) === nowInTz.getMonth() + 1;
      const matchDayOfWeek = dayOfWeek === "*" || Number(dayOfWeek) === nowInTz.getDay();

      return matchMinute && matchHour && matchDayOfMonth && matchMonth && matchDayOfWeek;
    }
    return false;
  } catch {
    return false;
  }
}

export async function executeAutomation(
  supabase: SupabaseClient,
  userId: string,
  rule: Tables<"automation_rules">,
  triggerData: Record<string, unknown> | null,
  executionId?: string,
): Promise<ExecutionResult> {
  const execId = executionId || (await generateExecutionId(rule.id, new Date()));
  const results: ActionResult[] = [];
  let actionsExecuted = 0;
  let actionsFailed = 0;

  const actionType = rule.action_type as AutomationActionType;
  const actionConfig = rule.action_config as ActionConfig;

  try {
    let result: ActionResult;

    switch (actionType) {
      case "create_task": {
        const { data, error } = await supabase
          .from("tasks")
          .insert({
            user_id: userId,
            title: actionConfig.task_title || "Automated Task",
            priority: actionConfig.task_priority || "Medium",
            due_date: actionConfig.task_due_date || null,
            due_time: actionConfig.task_due_time || null,
            type: actionConfig.task_type || "Automation",
            done: false,
          })
          .select()
          .single();
        if (error) throw error;
        result = { success: true, result: data };
        break;
      }
      case "create_reminder": {
        const { data, error } = await supabase
          .from("reminders")
          .insert({
            user_id: userId,
            title: actionConfig.reminder_title || "Automated Reminder",
            message: actionConfig.reminder_message || "",
            trigger_at: actionConfig.reminder_trigger_at || new Date().toISOString(),
            timezone: actionConfig.reminder_timezone || "UTC",
            status: "pending",
          })
          .select()
          .single();
        if (error) throw error;
        result = { success: true, result: data };
        break;
      }
      case "create_event": {
        const { data, error } = await supabase
          .from("events")
          .insert({
            user_id: userId,
            title: actionConfig.event_title || "Automated Event",
            description: actionConfig.event_description || "",
            start_at: actionConfig.event_start_at || new Date().toISOString(),
            end_at: actionConfig.event_end_at || new Date(Date.now() + 3600000).toISOString(),
            timezone: actionConfig.event_timezone || "UTC",
            all_day: actionConfig.event_all_day || false,
          })
          .select()
          .single();
        if (error) throw error;
        result = { success: true, result: data };
        break;
      }
      case "create_habit_log": {
        if (!actionConfig.habit_id) throw new Error("habit_id required for create_habit_log");
        const { data, error } = await supabase
          .from("habit_logs")
          .upsert(
            {
              user_id: userId,
              habit_id: actionConfig.habit_id,
              day: new Date().toISOString().split("T")[0],
              done: true,
              value: actionConfig.habit_value || 1,
            },
            { onConflict: "user_id,habit_id,day" },
          )
          .select()
          .single();
        if (error) throw error;
        result = { success: true, result: data };
        break;
      }
      case "create_note": {
        const { data, error } = await supabase
          .from("notes")
          .insert({
            user_id: userId,
            title: actionConfig.note_title || "Automated Note",
            content: actionConfig.note_content || "",
            tag: actionConfig.note_tag || "Automation",
          })
          .select()
          .single();
        if (error) throw error;
        result = { success: true, result: data };
        break;
      }
      case "update_progress": {
        if (!actionConfig.project_id) throw new Error("project_id required for update_progress");
        const { data, error } = await supabase
          .from("work_projects")
          .update({ progress: actionConfig.progress })
          .eq("id", actionConfig.project_id)
          .eq("user_id", userId)
          .select()
          .single();
        if (error) throw error;
        result = { success: true, result: data };
        break;
      }
      case "generate_briefing": {
        const { data, error } = await (supabase as any).rpc("generate_daily_briefing", {
          p_user_id: userId,
          p_date: actionConfig.briefing_date || new Date().toISOString().split("T")[0],
        });
        if (error) throw error;
        result = { success: true, result: data };
        break;
      }
      case "generate_review": {
        const { data, error } = await (supabase as any).rpc("generate_weekly_review", {
          p_user_id: userId,
          p_week_start: actionConfig.review_week_start || new Date().toISOString().split("T")[0],
        });
        if (error) throw error;
        result = { success: true, result: data };
        break;
      }
      case "send_notification": {
        result = { success: true, result: { message: "Notification queued (stub)" } };
        break;
      }
      default:
        throw new Error(`Unknown action type: ${actionType}`);
    }

    results.push({ success: true, result: result.result });
    actionsExecuted++;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logAutomationError(rule.id, err, { actionType, actionConfig });
    results.push({ success: false, error: err.message });
    actionsFailed++;
  }

  return {
    success: actionsFailed === 0,
    actionsExecuted,
    actionsFailed,
    results,
  };
}

export async function runAutomation(
  supabase: SupabaseClient,
  userId: string,
  ruleId: string,
  triggerData?: Record<string, unknown>,
): Promise<ExecutionResult> {
  const { data: rule, error } = await supabase
    .from("automation_rules")
    .select("*")
    .eq("id", ruleId)
    .eq("user_id", userId)
    .single();

  if (error || !rule) {
    return {
      success: false,
      actionsExecuted: 0,
      actionsFailed: 0,
      results: [],
      error: "Rule not found",
    };
  }

  if (!rule.enabled) {
    return {
      success: false,
      actionsExecuted: 0,
      actionsFailed: 0,
      results: [],
      error: "Rule disabled",
    };
  }

  const evaluation = await evaluateAutomation(supabase, userId, rule, triggerData ?? null);
  if (!evaluation.shouldExecute) {
    await logExecution(
      supabase,
      userId,
      rule.id,
      evaluation.executionId,
      "skipped",
      triggerData ?? null,
      null,
      null,
      evaluation.reason,
    );
    return {
      success: false,
      actionsExecuted: 0,
      actionsFailed: 0,
      results: [],
      error: evaluation.reason,
    };
  }

  const executionResult = await executeAutomation(
    supabase,
    userId,
    rule,
    triggerData ?? null,
    evaluation.executionId,
  );

  await logExecution(
    supabase,
    userId,
    rule.id,
    evaluation.executionId,
    executionResult.success ? "success" : "failed",
    triggerData ?? null,
    true,
    { results: executionResult.results },
    executionResult.error || null,
  );

  await supabase
    .from("automation_rules")
    .update({
      last_run_at: new Date().toISOString(),
      last_triggered_at: new Date().toISOString(),
      run_count: rule.run_count + 1,
    })
    .eq("id", ruleId);

  return { ...executionResult, logId: undefined };
}

export async function runManualAutomation(
  supabase: SupabaseClient,
  userId: string,
  ruleId: string,
): Promise<ExecutionResult> {
  return runAutomation(supabase, userId, ruleId, { manual: true });
}
