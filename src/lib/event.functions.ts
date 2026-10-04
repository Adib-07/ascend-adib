import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const createEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      title: z.string().min(1).max(200),
      description: z.string().max(2000).optional(),
      start_at: z.string().datetime(),
      end_at: z.string().datetime(),
      timezone: z.string().default("UTC"),
      all_day: z.boolean().default(false),
      location: z.string().max(500).optional(),
      task_id: z.string().uuid().optional(),
      project_id: z.string().uuid().optional(),
      recurrence: z.enum(["daily", "weekly", "monthly", "custom"]).optional(),
      recurrence_days: z.string().optional(),
      recurrence_end: z.string().datetime().optional(),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    })
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: event, error } = await supabase
      .from("events")
      .insert({ ...data, user_id: userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return event;
  });

export const updateEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      title: z.string().min(1).max(200).optional(),
      description: z.string().max(2000).optional(),
      start_at: z.string().datetime().optional(),
      end_at: z.string().datetime().optional(),
      timezone: z.string().optional(),
      all_day: z.boolean().optional(),
      location: z.string().max(500).optional(),
      task_id: z.string().uuid().nullable().optional(),
      project_id: z.string().uuid().nullable().optional(),
      recurrence: z.enum(["daily", "weekly", "monthly", "custom"]).nullable().optional(),
      recurrence_days: z.string().nullable().optional(),
      recurrence_end: z.string().datetime().nullable().optional(),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
    })
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { id, ...patch } = data;
    const { data: event, error } = await supabase
      .from("events")
      .update(patch)
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return event;
  });

export const deleteEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("events")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const listEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      start: z.string().datetime().optional(),
      end: z.string().datetime().optional(),
      limit: z.number().int().min(1).max(100).default(50),
    })
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    let q = supabase
      .from("events")
      .select("*")
      .eq("user_id", userId)
      .order("start_at", { ascending: true })
      .limit(data.limit);
    if (data.start) q = q.gte("start_at", data.start);
    if (data.end) q = q.lte("end_at", data.end);
    const { data: events, error } = await q;
    if (error) throw new Error(error.message);
    return events ?? [];
  });

export const getEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: event, error } = await supabase
      .from("events")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", userId)
      .single();
    if (error) throw new Error(error.message);
    return event;
  });