import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  CHAT_SYSTEM,
  KIND_SYSTEMS,
  MAX_TOKENS,
  MODEL,
  PRACTICE_SYSTEM,
  QUIZ_SYSTEM,
  TEACH_SYSTEM,
  TEMPERATURE,
  stripFences,
} from "./tutor.server";

export const teachTopic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ topic: z.string().min(1).max(4000) }))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI service not configured");
    const gateway = createLovableAiGatewayProvider(key);
    const { text } = await generateText({
      model: gateway(MODEL),
      temperature: TEMPERATURE,
      maxOutputTokens: MAX_TOKENS,
      system: TEACH_SYSTEM,
      prompt: `Teach me: ${data.topic}`,
    });
    if (!text?.trim()) throw new Error("Empty response from AI");
    return { text };
  });

export const practiceQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ topic: z.string().min(1).max(4000) }))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI service not configured");
    const gateway = createLovableAiGatewayProvider(key);
    const { text } = await generateText({
      model: gateway(MODEL),
      temperature: TEMPERATURE,
      maxOutputTokens: MAX_TOKENS,
      system: PRACTICE_SYSTEM,
      prompt: data.topic,
    });
    try {
      const parsed = JSON.parse(stripFences(text));
      if (Array.isArray(parsed)) return { questions: parsed.slice(0, 3).map(String) };
    } catch {
      /* fall through to empty */
    }
    return { questions: [] as string[] };
  });

export const generateQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ topic: z.string().min(1).max(4000) }))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI service not configured");
    const gateway = createLovableAiGatewayProvider(key);
    const { text } = await generateText({
      model: gateway(MODEL),
      temperature: TEMPERATURE,
      maxOutputTokens: MAX_TOKENS,
      system: QUIZ_SYSTEM,
      prompt: data.topic,
    });
    try {
      const parsed = JSON.parse(stripFences(text));
      if (Array.isArray(parsed)) {
        return {
          questions: parsed
            .filter((q) => q && typeof q.question === "string" && Array.isArray(q.options))
            .slice(0, 5)
            .map((q) => ({
              question: String(q.question),
              options: q.options.slice(0, 4).map(String),
              correct: Number(q.correct) || 0,
              explanation: String(q.explanation ?? ""),
            })),
        };
      }
    } catch {
      /* fall through to empty */
    }
    return {
      questions: [] as {
        question: string;
        options: string[];
        correct: number;
        explanation: string;
      }[],
    };
  });

export const chatTutor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      messages: z
        .array(
          z.object({
            role: z.enum(["user", "assistant", "system"]),
            content: z.string().min(1).max(8000),
          }),
        )
        .min(1)
        .max(30),
    }),
  )
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI service not configured");
    const gateway = createLovableAiGatewayProvider(key);
    const { text } = await generateText({
      model: gateway(MODEL),
      temperature: TEMPERATURE,
      maxOutputTokens: MAX_TOKENS,
      system: CHAT_SYSTEM,
      messages: data.messages,
    });
    if (!text?.trim()) throw new Error("Empty response from AI");
    return { text };
  });

export const askTutor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      kind: z.enum(["coding", "debug", "exam", "project", "flashcards"]),
      prompt: z.string().min(1).max(4000),
    }),
  )
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI service not configured");
    const gateway = createLovableAiGatewayProvider(key);
    const { text } = await generateText({
      model: gateway(MODEL),
      temperature: TEMPERATURE,
      maxOutputTokens: MAX_TOKENS,
      system: KIND_SYSTEMS[data.kind] ?? CHAT_SYSTEM,
      prompt: data.prompt,
    });
    if (!text?.trim()) throw new Error("Empty response from AI");
    return { text };
  });
