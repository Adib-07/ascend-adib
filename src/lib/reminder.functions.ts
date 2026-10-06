import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const createReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      title: z.string().min(1).max(200),
      message: z.string().max(1000).optional(),
      trigger_at: z.string().datetime(),
      timezone: z.string().default("UTC"),
      related_type: z.enum(["task", "event", "habit", "custom"]).optional(),
      related_id: z.string().uuid().optional(),
      delivery_channel: z.enum(["in_app", "push", "email"]).default("in_app"),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: reminder, error } = await supabase
      .from("reminders")
      .insert({ ...data, user_id: userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return reminder;
  });

export const updateReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      id: z.string().uuid(),
      title: z.string().min(1).max(200).optional(),
      message: z.string().max(1000).optional(),
      trigger_at: z.string().datetime().optional(),
      timezone: z.string().optional(),
      status: z.enum(["pending", "sent", "dismissed", "failed"]).optional(),
      delivery_channel: z.enum(["in_app", "push", "email"]).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { id, ...patch } = data;
    const { data: reminder, error } = await supabase
      .from("reminders")
      .update(patch)
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return reminder;
  });

export const dismissReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("reminders")
      .update({ status: "dismissed" })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const listReminders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      status: z.enum(["pending", "sent", "dismissed", "failed"]).optional(),
      limit: z.number().int().min(1).max(100).default(50),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    let q = supabase
      .from("reminders")
      .select("*")
      .eq("user_id", userId)
      .order("trigger_at", { ascending: true })
      .limit(data.limit);
    if (data.status) q = q.eq("status", data.status);
    const { data: reminders, error } = await q;
    if (error) throw new Error(error.message);
    return reminders ?? [];
  });
