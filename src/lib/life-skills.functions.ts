import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { KIND_EXTENSIONS, LIFE_SKILLS_SYSTEM, MENTOR_SYSTEM, MODEL } from "./life-skills.server";

export const askProfessor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      kind: z.enum([
        "learn",
        "book",
        "business",
        "resources",
        "memory",
        "answerCheck",
        "flashcards",
      ]),
      prompt: z.string().min(1).max(6000),
    }),
  )
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI service not configured");
    const gateway = createLovableAiGatewayProvider(key);
    const { text } = await generateText({
      model: gateway(MODEL),
      system: LIFE_SKILLS_SYSTEM + (KIND_EXTENSIONS[data.kind] ?? ""),
      prompt: data.prompt,
    });
    if (!text?.trim()) throw new Error("Empty response from AI");
    return { text };
  });

export const chatMentor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      messages: z
        .array(
          z.object({
            role: z.enum(["user", "assistant"]),
            content: z.string().min(1).max(8000),
          }),
        )
        .min(1)
        .max(60),
    }),
  )
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI service not configured");
    const gateway = createLovableAiGatewayProvider(key);
    const { text } = await generateText({
      model: gateway(MODEL),
      system: MENTOR_SYSTEM,
      messages: data.messages,
    });
    if (!text?.trim()) throw new Error("Empty response from AI");
    return { text };
  });
