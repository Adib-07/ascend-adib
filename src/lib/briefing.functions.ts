import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getDailyBriefing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      regenerate: z.boolean().default(false),
    })
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const date = data.date || new Date().toISOString().split("T")[0];

    if (!data.regenerate) {
      const { data: existing } = await supabase
        .from("daily_briefing")
        .select("*")
        .eq("user_id", userId)
        .eq("briefing_date", date)
        .maybeSingle();
      if (existing) return existing;
    }

    // Call the database function
    const { data: result, error } = await (supabase as any).rpc("generate_daily_briefing", {
      p_user_id: userId,
      p_date: date,
    });
    if (error) throw new Error(error.message);
    return result;
  });

export const getWeeklyReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      regenerate: z.boolean().default(false),
    })
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const today = new Date();
    const dow = today.getDay();
    const weekStart = data.week_start || new Date(today.getTime() - dow * 86400000).toISOString().split("T")[0];

    if (!data.regenerate) {
      const { data: existing } = await supabase
        .from("weekly_review")
        .select("*")
        .eq("user_id", userId)
        .eq("week_start", weekStart)
        .maybeSingle();
      if (existing) return existing;
    }

    const { data: result, error } = await (supabase as any).rpc("generate_weekly_review", {
      p_user_id: userId,
      p_week_start: weekStart,
    });
    if (error) throw new Error(error.message);
    return result;
  });

export const listDailyBriefings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      limit: z.number().int().min(1).max(30).default(7),
    })
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: briefings, error } = await supabase
      .from("daily_briefing")
      .select("*")
      .eq("user_id", userId)
      .order("briefing_date", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return briefings ?? [];
  });

export const listWeeklyReviews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      limit: z.number().int().min(1).max(12).default(4),
    })
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: reviews, error } = await supabase
      .from("weekly_review")
      .select("*")
      .eq("user_id", userId)
      .order("week_start", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return reviews ?? [];
  });