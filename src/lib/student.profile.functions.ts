import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getStudentProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("student_profile")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  });

export const upsertStudentProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      semester: z.string().optional(),
      academic_goals: z.string().optional(),
      study_availability: z.record(z.number()).optional(),
      preferred_session_length: z.number().int().positive().optional(),
      exam_alert_days_before: z.number().int().nonnegative().optional(),
    })
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("student_profile")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    const payload = { user_id: userId, ...data, updated_at: new Date().toISOString() };

    if (existing) {
      const { data: resultData, error } = await supabase
        .from("student_profile")
        .update(payload)
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw error;
      return resultData;
    } else {
      const { data: resultData, error } = await supabase
        .from("student_profile")
        .insert({ user_id: userId, ...data })
        .select()
        .single();
      if (error) throw error;
      return resultData;
    }
  });