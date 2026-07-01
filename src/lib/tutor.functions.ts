import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const MODEL = "google/gemini-3-flash-preview";

const TEACH_SYSTEM = `You are an expert CSE tutor for a B.Tech student aspiring to become an AI Engineer. Teach the requested concept from first principles using this exact structure with markdown headers:

## 1. Simple Explanation
A plain-English explanation with a real-world analogy.

## 2. Technical Deep Dive
The proper technical mechanics, terminology, and how it actually works.

## 3. Common Mistakes to Avoid
Bullet list of pitfalls students make.

## 4. Interview-Level Explanation
How to explain this crisply in a technical interview (2-3 sentences).

## 5. Quick Revision Summary
Concise bullet points for last-minute revision.

Be precise, honest, and clear. Use code blocks where helpful.`;

export const teachTopic = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ topic: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableAiGatewayProvider(key);
    const { text } = await generateText({
      model: gateway(MODEL),
      system: TEACH_SYSTEM,
      prompt: `Teach me: ${data.topic}`,
    });
    return { text };
  });

export const practiceQuestions = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ topic: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableAiGatewayProvider(key);
    const { text } = await generateText({
      model: gateway(MODEL),
      system: `Generate exactly 3 short practice questions on the given topic for a B.Tech CSE student. Return ONLY a JSON array of strings, no prose, no markdown fences. Example: ["Q1?","Q2?","Q3?"]`,
      prompt: data.topic,
    });
    try {
      const cleaned = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) return { questions: parsed.slice(0, 3).map(String) };
    } catch { /* noop */ }
    return { questions: [] as string[] };
  });

export const generateQuiz = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ topic: z.string().min(1).max(100) }).parse(d))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableAiGatewayProvider(key);
    const { text } = await generateText({
      model: gateway(MODEL),
      system: `Generate exactly 5 multiple-choice questions on the given topic for a B.Tech CSE student. Return ONLY a valid JSON array (no markdown fences, no prose) with this exact shape:
[{"question":"...","options":["A","B","C","D"],"correct":0,"explanation":"..."}]
The "correct" field is the 0-indexed integer of the right option in the options array.`,
      prompt: data.topic,
    });
    try {
      const cleaned = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        return {
          questions: parsed
            .filter((q) => q && typeof q.question === "string" && Array.isArray(q.options))
            .slice(0, 5)
            .map((q) => ({
              question: String(q.question),
              options: q.options.slice(0, 4).map(String),
              correct: Math.max(0, Math.min(3, Number(q.correct) || 0)),
              explanation: String(q.explanation ?? ""),
            })),
        };
      }
    } catch { /* noop */ }
    return { questions: [] as { question: string; options: string[]; correct: number; explanation: string }[] };
  });
