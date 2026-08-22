import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { COACH_SYSTEM, MODEL } from "./english-coach.server";

export const coachChat = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        messages: z
          .array(
            z.object({
              role: z.enum(["user", "assistant"]),
              content: z.string().min(1).max(8000),
            }),
          )
          .min(1)
          .max(80),
        sessionDay: z.number().optional(),
        mode: z.string().max(4000).optional(),
      })
      .parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI service not configured");
    const gateway = createLovableAiGatewayProvider(key);
    const system =
      COACH_SYSTEM +
      (data.sessionDay ? `\n\nCURRENT SESSION DAY: ${data.sessionDay}.` : "") +
      (data.mode ? `\n\n${data.mode}` : "");
    const { text } = await generateText({
      model: gateway(MODEL),
      system,
      messages: data.messages,
    });
    if (!text?.trim()) throw new Error("Empty response from AI");
    return { text };
  });

export const coachReply = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        kind: z.enum(["speaking", "interview", "general"]),
        prompt: z.string().min(1).max(6000),
      })
      .parse(d),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI service not configured");
    const gateway = createLovableAiGatewayProvider(key);
    const { KIND_EXTENSIONS } = await import("./english-coach.server");
    const { text } = await generateText({
      model: gateway(MODEL),
      system: COACH_SYSTEM + (KIND_EXTENSIONS[data.kind] ?? ""),
      prompt: data.prompt,
    });
    if (!text?.trim()) throw new Error("Empty response from AI");
    return { text };
  });
