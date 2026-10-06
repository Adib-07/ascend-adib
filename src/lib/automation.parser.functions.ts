import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ParsedAutomationCommand } from "./automation.parser";

export interface SerializedParsedAutomationCommand {
  intent: ParsedAutomationCommand["intent"];
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

export const parseAutomationCommand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      text: z.string().min(1).max(2000),
    }),
  )
  .handler(async ({ data }) => {
    const { parseAutomationCommand: parser } = await import("./automation.parser");
    const parsed = await parser({ data });
    const serialized: {
      intent: ParsedAutomationCommand["intent"];
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
    } = {
      intent: parsed.intent,
      confidence: parsed.confidence,
      requiresConfirmation: parsed.requiresConfirmation,
      parameters: {
        name: parsed.parameters.name,
        description: parsed.parameters.description,
        triggerType: parsed.parameters.triggerType,
        triggerConfig: parsed.parameters.triggerConfig
          ? JSON.parse(JSON.stringify(parsed.parameters.triggerConfig))
          : undefined,
        conditionConfig: parsed.parameters.conditionConfig
          ? JSON.parse(JSON.stringify(parsed.parameters.conditionConfig))
          : undefined,
        actionType: parsed.parameters.actionType,
        actionConfig: parsed.parameters.actionConfig
          ? JSON.parse(JSON.stringify(parsed.parameters.actionConfig))
          : undefined,
        ruleId: parsed.parameters.ruleId,
        triggerData: parsed.parameters.triggerData
          ? JSON.parse(JSON.stringify(parsed.parameters.triggerData))
          : undefined,
      },
      clarification: parsed.clarification,
    };
    return serialized;
  });
