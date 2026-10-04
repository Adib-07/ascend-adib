import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { QueryCategory } from "./context-engine-core";
import { classifyQuestion, normalizeKeywords } from "./context-engine-core";

const CATEGORY_VALUES = [
  "ACADEMIC",
  "PROGRAMMING",
  "EXAM_PREPARATION",
  "SYLLABUS",
  "DOCUMENT",
  "ENGLISH",
  "LIFE_SKILLS",
  "GENERAL",
  "WORK",
  "CLIENT",
  "FREELANCING",
] as const;

export const askWithContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      question: z.string().min(1).max(4000),
      subject: z.string().max(200).optional(),
      category: z.enum(CATEGORY_VALUES).optional(),
      mode: z.enum(["student", "work"]).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { askWithContextImpl } = await import("./context-engine.server");
    return askWithContextImpl({
      supabase: context.supabase,
      userId: context.userId,
      question: data.question,
      subject: data.subject,
      category: data.category as QueryCategory | undefined,
      mode: data.mode,
    });
  });

export const getGroundedContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      question: z.string().min(1).max(4000),
      subject: z.string().max(200).optional(),
      category: z.enum(CATEGORY_VALUES).optional(),
      includeDatasets: z.boolean().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { retrieveGroundedContext } = await import("./context-engine.server");
    const category = data.category ?? classifyQuestion(data.question);
    return retrieveGroundedContext(context.supabase, context.userId, data.question, {
      subject: data.subject,
      category,
      includeDatasets: data.includeDatasets,
    });
  });
