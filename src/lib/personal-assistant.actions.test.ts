import { describe, expect, it } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { executeActionImpl, type AssistantAction } from "./personal-assistant.server";
import type { ActionType } from "./personal-assistant.types";

// Minimal Supabase mock: captures every insert/update/upsert call per table so
// tests can assert that a refused action never reaches the database.
function mockSupabase(options?: { insertError?: unknown }) {
  const writes: Array<{ table: string; op: string; payload: unknown }> = [];
  const builder = {
    select: () => builder,
    eq: () => builder,
    single: () =>
      Promise.resolve(
        options?.insertError
          ? { data: null, error: options.insertError }
          : { data: { id: "row-1" }, error: null },
      ),
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
    insert: (payload: unknown) => {
      writes.push({ table: builder.table as string, op: "insert", payload });
      return builder;
    },
    update: (payload: unknown) => {
      writes.push({ table: builder.table as string, op: "update", payload });
      return builder;
    },
    upsert: (payload: unknown) => {
      writes.push({ table: builder.table as string, op: "upsert", payload });
      return builder;
    },
    from: (table: string) => {
      builder.table = table;
      return builder;
    },
  };
  return { supabase: builder as unknown as SupabaseClient, writes };
}

function action(type: ActionType, requiresConfirmation: boolean): AssistantAction {
  return { type, payload: {}, description: "test action", requiresConfirmation };
}

const USER_ID = "user-1";

describe("executeActionImpl — server-side confirmation gate", () => {
  it("refuses a mutating action with requiresConfirmation=false and confirm=false", async () => {
    const { supabase, writes } = mockSupabase();
    const result = await executeActionImpl({
      supabase,
      userId: USER_ID,
      action: action("create_task", false),
      confirm: false,
    });
    expect(result.success).toBe(false);
    expect(result.message).toBe("Action requires confirmation");
    expect(writes).toHaveLength(0);
  });

  it("refuses a mutating action with requiresConfirmation=true and confirm=false", async () => {
    const { supabase, writes } = mockSupabase();
    const result = await executeActionImpl({
      supabase,
      userId: USER_ID,
      action: action("create_task", true),
      confirm: false,
    });
    expect(result.success).toBe(false);
    expect(result.message).toBe("Action requires confirmation");
    expect(writes).toHaveLength(0);
  });

  it("executes a mutating action with valid confirmation (flag supplied false)", async () => {
    const { supabase, writes } = mockSupabase();
    const result = await executeActionImpl({
      supabase,
      userId: USER_ID,
      action: {
        type: "create_task",
        payload: { title: "Write report" },
        description: "test action",
        requiresConfirmation: false,
      },
      confirm: true,
    });
    expect(result.success).toBe(true);
    expect(result.message).toBe("Created task: Write report");
    expect(writes).toHaveLength(1);
    expect(writes[0].table).toBe("tasks");
  });

  it("executes a mutating action with valid confirmation (flag supplied true)", async () => {
    const { supabase, writes } = mockSupabase();
    const result = await executeActionImpl({
      supabase,
      userId: USER_ID,
      action: {
        type: "create_task",
        payload: { title: "Write report" },
        description: "test action",
        requiresConfirmation: true,
      },
      confirm: true,
    });
    expect(result.success).toBe(true);
    expect(writes).toHaveLength(1);
  });

  it("requires confirmation for run_automation (consequential trigger)", async () => {
    const { supabase, writes } = mockSupabase();
    const result = await executeActionImpl({
      supabase,
      userId: USER_ID,
      action: action("run_automation", false),
      confirm: false,
    });
    expect(result.success).toBe(false);
    expect(result.message).toBe("Action requires confirmation");
    expect(writes).toHaveLength(0);
  });

  it("requires confirmation for every mutating action type", async () => {
    const mutatingTypes: ActionType[] = [
      "create_task",
      "create_reminder",
      "create_event",
      "create_habit",
      "create_goal",
      "create_project",
      "create_study_plan",
      "log_revision",
      "update_topic",
      "run_automation",
    ];
    for (const type of mutatingTypes) {
      const { supabase, writes } = mockSupabase();
      const result = await executeActionImpl({
        supabase,
        userId: USER_ID,
        action: action(type, false),
        confirm: false,
      });
      expect(result.success).toBe(false);
      expect(result.message).toBe("Action requires confirmation");
      expect(writes).toHaveLength(0);
    }
  });

  it("returns a failure for an unknown action type without writing to the database", async () => {
    const { supabase, writes } = mockSupabase();
    const result = await executeActionImpl({
      supabase,
      userId: USER_ID,
      action: action("not_a_real_type" as ActionType, false),
      confirm: true,
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain("Unknown action type");
    expect(writes).toHaveLength(0);
  });

  it("surfaces a database failure on a confirmed action (error path preserved)", async () => {
    const { supabase, writes } = mockSupabase({ insertError: { message: "insert failed" } });
    const result = await executeActionImpl({
      supabase,
      userId: USER_ID,
      action: {
        type: "create_task",
        payload: {},
        description: "test action",
        requiresConfirmation: false,
      },
      confirm: true,
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain("Failed to execute action");
    expect(writes).toHaveLength(1);
  });
});
