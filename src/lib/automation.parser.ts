import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { generateText } from "ai";
import { MAX_TOKENS, MODEL, TEMPERATURE } from "./tutor.server";

export interface ParsedAutomationCommand {
  intent: "CREATE_AUTOMATION" | "EXECUTE_AUTOMATION" | "LIST_AUTOMATIONS" | "DELETE_AUTOMATION" | "UNKNOWN";
  confidence: number;
  requiresConfirmation: boolean;
  parameters: {
    name?: string;
    description?: string;
    triggerType?: string;
    triggerConfig?: Record<string, string | number | boolean | null>;
    conditionConfig?: Array<Record<string, string | number | boolean | null>>;
    actionType?: string;
    actionConfig?: Record<string, string | number | boolean | null>;
    ruleId?: string;
    triggerData?: Record<string, string | number | boolean | null>;
  };
  clarification?: string;
}

const PARSER_SYSTEM = `You are the Ascend Automation Parser. Your job is to parse natural language into structured automation commands.

SUPPORTED INTENTS:
1. CREATE_AUTOMATION - Create a new automation rule
2. EXECUTE_AUTOMATION - Manually execute an existing automation
3. LIST_AUTOMATIONS - List existing automations
4. DELETE_AUTOMATION - Delete an automation
5. UNKNOWN - Cannot determine intent

SUPPORTED TRIGGER TYPES:
- scheduled_time: Run on a cron-like schedule (cron expression)
- task_completed: When a specific task is completed
- task_overdue: When any task becomes overdue
- habit_completed: When a specific habit is logged
- event_upcoming: When a specific event is about to start
- reminder_due: When a specific reminder is due
- document_uploaded: When a document is uploaded
- project_completed: When a project is marked complete
- manual: Manual trigger only

SUPPORTED ACTION TYPES:
- create_task: Create a new task
- create_reminder: Create a reminder
- create_event: Create a calendar event
- create_habit_log: Log a habit completion
- create_note: Create a note
- update_progress: Update project progress
- generate_briefing: Generate daily briefing
- generate_review: Generate weekly review
- send_notification: Send a notification (stub)

CONDITION OPERATORS: equals, not_equals, contains, greater_than, less_than, in, not_in

OUTPUT FORMAT (JSON only):
{
  "intent": "CREATE_AUTOMATION",
  "confidence": 0.95,
  "requiresConfirmation": false,
  "parameters": {
    "name": "Morning Briefing",
    "description": "Generate daily briefing at 8 AM",
    "triggerType": "scheduled_time",
    "triggerConfig": { "schedule": "0 8 * * *", "timezone": "UTC" },
    "conditionConfig": [],
    "actionType": "generate_briefing",
    "actionConfig": {}
  },
  "clarification": null
}

RULES:
- Return ONLY valid JSON
- If ambiguous, set confidence < 0.7 and requiresConfirmation: true
- If destructive (DELETE), always requireConfirmation: true
- If missing required parameters, ask for clarification
- For CREATE_AUTOMATION, name is required
- For scheduled_time, schedule (cron) is required
- For task_completed/habit_completed, task_id/habit_id in triggerConfig is required
- For create_task, task_title in actionConfig is required
- For create_reminder, reminder_title and reminder_trigger_at in actionConfig are required
- For create_event, event_title, event_start_at, event_end_at in actionConfig are required
- For create_habit_log, habit_id in actionConfig is required
- For create_note, note_title in actionConfig is required
- For update_progress, project_id and progress in actionConfig are required
- For generate_briefing, briefing_date in actionConfig is optional (defaults to today)
- For generate_review, review_week_start in actionConfig is optional (defaults to this week)

EXAMPLES:
Input: "Create an automation that generates my daily briefing every morning at 8 AM"
Output: { intent: "CREATE_AUTOMATION", confidence: 0.95, requiresConfirmation: false, parameters: { name: "Daily Morning Briefing", description: "Generate daily briefing at 8 AM", triggerType: "scheduled_time", triggerConfig: { schedule: "0 8 * * *", timezone: "UTC" }, conditionConfig: [], actionType: "generate_briefing", actionConfig: {} } }

Input: "Remind me to call Rahul at 5 PM tomorrow"
Output: { intent: "CREATE_AUTOMATION", confidence: 0.9, requiresConfirmation: false, parameters: { name: "Call Rahul", triggerType: "scheduled_time", triggerConfig: { schedule: "0 17 * * *", timezone: "UTC" }, conditionConfig: [], actionType: "create_reminder", actionConfig: { reminder_title: "Call Rahul", reminder_message: "Call Rahul", reminder_trigger_at: "2024-01-15T17:00:00Z", reminder_timezone: "UTC" } } }

Input: "When I complete my study task, log my study habit"
Output: { intent: "CREATE_AUTOMATION", confidence: 0.85, requiresConfirmation: true, parameters: { name: "Log study habit on task completion", triggerType: "task_completed", triggerConfig: { task_id: "NEED_TASK_ID" }, conditionConfig: [], actionType: "create_habit_log", actionConfig: { habit_id: "NEED_HABIT_ID" } }, clarification: "Please specify which task and habit IDs to use" }

Input: "Delete all my tasks"
Output: { intent: "UNKNOWN", confidence: 0.5, requiresConfirmation: true, parameters: {}, clarification: "This request is ambiguous. Did you mean to delete completed tasks, or create an automation to clean up old tasks?" }`;

export const parseAutomationCommand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      text: z.string().min(1).max(2000),
    })
  )
  .handler(async ({ context, data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI service not configured");

    const gateway = createLovableAiGatewayProvider(key);
    const { text } = await generateText({
      model: gateway(MODEL),
      temperature: 0.1,
      maxOutputTokens: MAX_TOKENS,
      system: PARSER_SYSTEM,
      prompt: data.text,
    });

    if (!text?.trim()) throw new Error("Empty response from AI");

    let parsed: ParsedAutomationCommand;
    try {
      parsed = JSON.parse(text.trim());
    } catch {
      throw new Error("Failed to parse AI response as JSON");
    }

    // Validate required fields based on intent
    if (parsed.intent === "CREATE_AUTOMATION") {
      if (!parsed.parameters.name) {
        parsed.requiresConfirmation = true;
        parsed.clarification = "Automation name is required. What should this automation be called?";
        parsed.confidence = Math.min(parsed.confidence, 0.6);
      }
      if (parsed.parameters.triggerType === "scheduled_time" && !parsed.parameters.triggerConfig?.schedule) {
        parsed.requiresConfirmation = true;
        parsed.clarification = "Cron schedule is required for scheduled_time triggers. What schedule should I use (e.g., '0 8 * * *' for 8 AM daily)?";
        parsed.confidence = Math.min(parsed.confidence, 0.6);
      }
      if (parsed.parameters.triggerType === "task_completed" && !parsed.parameters.triggerConfig?.task_id) {
        parsed.requiresConfirmation = true;
        parsed.clarification = "Task ID is required for task_completed trigger. Which task should trigger this?";
        parsed.confidence = Math.min(parsed.confidence, 0.6);
      }
      if (parsed.parameters.triggerType === "habit_completed" && !parsed.parameters.triggerConfig?.habit_id) {
        parsed.requiresConfirmation = true;
        parsed.clarification = "Habit ID is required for habit_completed trigger. Which habit should trigger this?";
        parsed.confidence = Math.min(parsed.confidence, 0.6);
      }
      if (parsed.parameters.actionType === "create_task" && !parsed.parameters.actionConfig?.task_title) {
        parsed.requiresConfirmation = true;
        parsed.clarification = "Task title is required for create_task action. What should the task be called?";
        parsed.confidence = Math.min(parsed.confidence, 0.6);
      }
      if (parsed.parameters.actionType === "create_reminder" && (!parsed.parameters.actionConfig?.reminder_title || !parsed.parameters.actionConfig?.reminder_trigger_at)) {
        parsed.requiresConfirmation = true;
        parsed.clarification = "Reminder title and trigger time are required. What should the reminder say and when should it fire?";
        parsed.confidence = Math.min(parsed.confidence, 0.6);
      }
      if (parsed.parameters.actionType === "create_event" && (!parsed.parameters.actionConfig?.event_title || !parsed.parameters.actionConfig?.event_start_at || !parsed.parameters.actionConfig?.event_end_at)) {
        parsed.requiresConfirmation = true;
        parsed.clarification = "Event title, start time, and end time are required. What should the event be called and when is it?";
        parsed.confidence = Math.min(parsed.confidence, 0.6);
      }
      if (parsed.parameters.actionType === "create_habit_log" && !parsed.parameters.actionConfig?.habit_id) {
        parsed.requiresConfirmation = true;
        parsed.clarification = "Habit ID is required for create_habit_log action. Which habit should be logged?";
        parsed.confidence = Math.min(parsed.confidence, 0.6);
      }
      if (parsed.parameters.actionType === "create_note" && !parsed.parameters.actionConfig?.note_title) {
        parsed.requiresConfirmation = true;
        parsed.clarification = "Note title is required for create_note action. What should the note be called?";
        parsed.confidence = Math.min(parsed.confidence, 0.6);
      }
      if (parsed.parameters.actionType === "update_progress" && (!parsed.parameters.actionConfig?.project_id || parsed.parameters.actionConfig?.progress === undefined)) {
        parsed.requiresConfirmation = true;
        parsed.clarification = "Project ID and progress percentage are required for update_progress action. Which project and what progress?";
        parsed.confidence = Math.min(parsed.confidence, 0.6);
      }
    }

    if (parsed.intent === "DELETE_AUTOMATION" && !parsed.parameters.ruleId) {
      parsed.requiresConfirmation = true;
      parsed.clarification = "Rule ID is required to delete an automation. Which automation should be deleted?";
      parsed.confidence = Math.min(parsed.confidence, 0.5);
    }

    if (parsed.intent === "EXECUTE_AUTOMATION" && !parsed.parameters.ruleId) {
      parsed.requiresConfirmation = true;
      parsed.clarification = "Rule ID is required to execute an automation. Which automation should be executed?";
      parsed.confidence = Math.min(parsed.confidence, 0.6);
    }

    // Destructive actions always require confirmation
    if (parsed.intent === "DELETE_AUTOMATION") {
      parsed.requiresConfirmation = true;
    }

    return parsed;
  });