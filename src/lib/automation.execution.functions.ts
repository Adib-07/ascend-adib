import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

interface ExecutionResultInput {
  success: boolean;
  actionsExecuted: number;
  actionsFailed: number;
  results: Array<{ success: boolean; result?: Record<string, unknown>; error?: string }>;
  logId?: string;
  error?: string;
}

function serializeExecutionResult(input: ExecutionResultInput): SerializedExecutionResult {
  const serialized: SerializedExecutionResult = {
    success: input.success,
    actionsExecuted: input.actionsExecuted,
    actionsFailed: input.actionsFailed,
    results: input.results.map((r) => ({
      success: r.success,
      result: r.result ? JSON.parse(JSON.stringify(r.result)) : undefined,
      error: r.error,
    })),
    logId: input.logId,
    error: input.error,
  };
  return serialized;
}

export const executeAutomation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      ruleId: z.string().uuid(),
      triggerData: z.record(z.unknown()).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { runAutomation } = await import("./automation.runner");
    const result = await runAutomation(supabase, userId, data.ruleId, data.triggerData);
    return serializeExecutionResult(result);
  });

export const executeManualAutomation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ ruleId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { runManualAutomation } = await import("./automation.runner");
    const result = await runManualAutomation(supabase, userId, data.ruleId);
    return serializeExecutionResult(result);
  });

export const evaluateAutomationRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      ruleId: z.string().uuid(),
      triggerData: z.record(z.unknown()).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { evaluateAutomation } = await import("./automation.runner");
    const { data: rule, error } = await supabase
      .from("automation_rules")
      .select("*")
      .eq("id", data.ruleId)
      .eq("user_id", userId)
      .single();
    if (error || !rule) throw new Error("Rule not found");
    const evaluation = await evaluateAutomation(supabase, userId, rule, data.triggerData ?? null);
    return {
      shouldExecute: evaluation.shouldExecute,
      reason: evaluation.reason,
      executionId: evaluation.executionId,
    };
  });
