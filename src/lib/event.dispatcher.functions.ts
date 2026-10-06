import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const runScheduledAutomationSweepFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      batchSize: z.number().int().min(1).max(100).optional(),
      lookAheadMinutes: z.number().int().min(1).max(60).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { runScheduledAutomationSweep } = await import("./event.dispatcher");
    const result = await runScheduledAutomationSweep(supabase, {
      batchSize: data.batchSize,
      lookAheadMinutes: data.lookAheadMinutes,
    });
    return result;
  });

export const processDueRemindersFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { processDueReminders } = await import("./event.dispatcher");
    const result = await processDueReminders(supabase, userId);
    return result;
  });

export const processUpcomingEventsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      lookAheadMinutes: z.number().int().min(1).max(1440).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { processUpcomingEvents } = await import("./event.dispatcher");
    const result = await processUpcomingEvents(supabase, userId, data.lookAheadMinutes);
    return result;
  });

export const processOverdueTasksFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { processOverdueTasks } = await import("./event.dispatcher");
    const result = await processOverdueTasks(supabase, userId);
    return result;
  });

export const runFullAutomationSweepFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      batchSize: z.number().int().min(1).max(100).optional(),
      lookAheadMinutes: z.number().int().min(1).max(60).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    const {
      runScheduledAutomationSweep,
      processDueReminders,
      processUpcomingEvents,
      processOverdueTasks,
    } = await import("./event.dispatcher");

    const sweepResult = await Promise.allSettled([
      runScheduledAutomationSweep(supabase, {
        batchSize: data.batchSize,
        lookAheadMinutes: data.lookAheadMinutes,
      }),
      processDueReminders(supabase, userId),
      processUpcomingEvents(supabase, userId, data.lookAheadMinutes),
      processOverdueTasks(supabase, userId),
    ]);

    const combinedResults = {
      scheduled:
        sweepResult[0].status === "fulfilled"
          ? sweepResult[0].value
          : { error: sweepResult[0].reason?.message },
      reminders:
        sweepResult[1].status === "fulfilled"
          ? sweepResult[1].value
          : { error: sweepResult[1].reason?.message },
      upcomingEvents:
        sweepResult[2].status === "fulfilled"
          ? sweepResult[2].value
          : { error: sweepResult[2].reason?.message },
      overdueTasks:
        sweepResult[3].status === "fulfilled"
          ? sweepResult[3].value
          : { error: sweepResult[3].reason?.message },
    };

    return combinedResults;
  });
