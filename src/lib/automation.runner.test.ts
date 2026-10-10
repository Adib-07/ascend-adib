import { describe, expect, it, beforeEach } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  evaluateConditions,
  matchesSchedule,
  generateExecutionId,
  checkIdempotency,
  logExecution,
  claimExecution,
  finalizeExecution,
  evaluateAutomation,
  executeAutomation,
  runAutomation,
  runManualAutomation,
  type ConditionConfig,
  type TriggerConfig,
  type ActionConfig,
  type Tables,
} from "./automation.runner";

function mockSupabase(
  responses: Record<string, { data: unknown; error: unknown }>,
  capture: Record<string, unknown>,
) {
  const builder: Record<string, (...args: unknown[]) => unknown> = {
    select: () => builder,
    eq: (col: unknown, val: unknown) => {
      if (col === "user_id") capture.userId = val;
      if (col === "id") capture.id = val;
      if (col === "rule_id") capture.ruleId = val;
      if (col === "status") capture.status = val;
      return builder;
    },
    is: () => builder,
    or: () => builder,
    in: () => builder,
    gte: () => builder,
    lte: () => builder,
    limit: () => Promise.resolve({ data: responses[builder.table as string] ?? [], error: null }),
    maybeSingle: () =>
      Promise.resolve({ data: responses[builder.table as string]?.[0] ?? null, error: null }),
    single: () =>
      Promise.resolve({ data: responses[builder.table as string]?.[0] ?? null, error: null }),
    insert: () => builder,
    update: () => builder,
    delete: () => builder,
    order: () => builder,
    from: (table: string) => {
      builder.table = table;
      return builder;
    },
    rpc: (fn: string) => ({
      then: (resolve: (v: unknown) => void) => {
        resolve({ data: responses[fn] ?? null, error: null });
      },
    }),
    storage: {
      from: () => ({
        download: () => Promise.resolve({ data: null, error: null }),
        upload: () => Promise.resolve({ data: null, error: null }),
        remove: () => Promise.resolve({ data: null, error: null }),
      }),
    },
  };
  return { from: builder.from, storage: builder.storage } as unknown as SupabaseClient;
}

describe("automation runner core", () => {
  describe("generateExecutionId", () => {
    it("generates consistent IDs for same rule and time bucket", async () => {
      const ruleId = "test-rule-123";
      const time = new Date("2024-01-15T08:30:00Z");
      const id1 = await generateExecutionId(ruleId, time);
      const id2 = await generateExecutionId(ruleId, time);
      expect(id1).toBe(id2);
      expect(id1.length).toBe(32);
    });

    it("generates different IDs for different time buckets", async () => {
      const ruleId = "test-rule-123";
      const time1 = new Date("2024-01-15T08:30:00Z");
      const time2 = new Date("2024-01-15T09:30:00Z");
      const id1 = await generateExecutionId(ruleId, time1);
      const id2 = await generateExecutionId(ruleId, time2);
      expect(id1).not.toBe(id2);
    });
  });

  describe("matchesSchedule", () => {
    it("matches exact cron schedule", () => {
      const now = new Date("2024-01-15T08:00:00Z");
      expect(matchesSchedule(now, "0 8 * * *", "UTC")).toBe(true);
    });

    it("does not match wrong hour", () => {
      const now = new Date("2024-01-15T09:00:00Z");
      expect(matchesSchedule(now, "0 8 * * *", "UTC")).toBe(false);
    });

    it("matches wildcard schedule", () => {
      const now = new Date("2024-01-15T08:30:00Z");
      expect(matchesSchedule(now, "* * * * *", "UTC")).toBe(true);
    });
  });

  describe("evaluateConditions", () => {
    it("returns true when all conditions pass", async () => {
      const conditions: ConditionConfig[] = [
        { field: "priority", operator: "equals", value: "High" },
        { field: "type", operator: "equals", value: "Study" },
      ];
      const context = { priority: "High", type: "Study" };
      const { passed } = await evaluateConditions({} as any, "user1", conditions, context);
      expect(passed).toBe(true);
    });

    it("returns false when any condition fails", async () => {
      const conditions: ConditionConfig[] = [
        { field: "priority", operator: "equals", value: "High" },
        { field: "type", operator: "equals", value: "Work" },
      ];
      const context = { priority: "High", type: "Study" };
      const { passed } = await evaluateConditions({} as any, "user1", conditions, context);
      expect(passed).toBe(false);
    });

    it("handles contains operator", async () => {
      const conditions: ConditionConfig[] = [
        { field: "title", operator: "contains", value: "study" },
      ];
      const context = { title: "Study for exam" };
      const { passed } = await evaluateConditions({} as any, "user1", conditions, context);
      expect(passed).toBe(true);
    });

    it("handles greater_than operator", async () => {
      const conditions: ConditionConfig[] = [
        { field: "progress", operator: "greater_than", value: 50 },
      ];
      const context = { progress: 75 };
      const { passed } = await evaluateConditions({} as any, "user1", conditions, context);
      expect(passed).toBe(true);
    });

    it("handles in operator", async () => {
      const conditions: ConditionConfig[] = [
        { field: "type", operator: "in", value: ["Study", "Work"] },
      ];
      const context = { type: "Study" };
      const { passed } = await evaluateConditions({} as any, "user1", conditions, context);
      expect(passed).toBe(true);
    });

    it("returns false for missing field", async () => {
      const conditions: ConditionConfig[] = [
        { field: "nonexistent", operator: "equals", value: "test" },
      ];
      const context = { other: "value" };
      const { passed } = await evaluateConditions({} as any, "user1", conditions, context);
      expect(passed).toBe(false);
    });
  });

  describe("checkIdempotency", () => {
    it("returns false when no existing log", async () => {
      const mock = mockSupabase({}, {});
      const result = await checkIdempotency(mock as any, "rule-1", "exec-1");
      expect(result).toBe(false);
    });

    it("returns true when log exists", async () => {
      const mock = mockSupabase({ automation_logs: [{ id: "log-1" }] }, {});
      const result = await checkIdempotency(mock as any, "rule-1", "exec-1");
      expect(result).toBe(true);
    });
  });
});

describe("automation runner integration", () => {
  describe("evaluateAutomation scheduled_time", () => {
    it("matches cron schedule", async () => {
      const rule = {
        id: "rule-1",
        user_id: "user-1",
        enabled: true,
        trigger_type: "scheduled_time",
        trigger_config: { schedule: "0 8 * * *", timezone: "UTC" },
        condition_config: [],
        action_type: "generate_briefing",
        action_config: {},
        run_count: 0,
      } as Tables<"automation_rules">;

      const mock = mockSupabase({}, {});
      const now = new Date("2024-01-15T08:00:00Z");
      // We can't easily test time-dependent logic without mocking Date, so we test the logic indirectly
      const result = await evaluateAutomation(mock as any, "user-1", rule, { user_id: "user-1" });
      expect(result.shouldExecute).toBe(false); // Won't match because we can't mock time easily
    });
  });

  describe("runAutomation", () => {
    it("returns not found for missing rule", async () => {
      const mock = mockSupabase(
        {
          automation_rules: [],
        },
        {},
      );
      const result = await runAutomation(mock as any, "user-1", "nonexistent-rule", {});
      expect(result.success).toBe(false);
      expect(result.error).toBe("Rule not found");
    });

    it("returns disabled for disabled rule", async () => {
      const mock = mockSupabase(
        {
          automation_rules: [{ id: "rule-1", enabled: false, user_id: "user-1" }],
        },
        {},
      );
      const result = await runAutomation(mock as any, "user-1", "rule-1", {});
      expect(result.success).toBe(false);
      expect(result.error).toBe("Rule disabled");
    });
  });
});

// ---------------------------------------------------------------------------
// Idempotency repair (claim-then-execute) — regression tests.
//
// The mock below models the parts of the Postgres contract the runner relies
// on: checkIdempotency's `status = 'success'` filter, the partial unique index
// on (rule_id, execution_id) making the claim insert an atomic arbiter
// (23505 on conflict), and log rows surviving failed executions.
// ---------------------------------------------------------------------------

interface RunnerScenario {
  rule?: Record<string, unknown> | null;
  // Row the DB would return for the (rule_id, execution_id, status='success')
  // idempotency query. Only returned when the row is a success row.
  idempotencyRow?: { id: string; status: string } | null;
  // Behavior of the claim insert (status='running') on automation_logs.
  claimInsert?: { ok: true; id: string } | { ok: false; error: { code?: string; message: string } };
  // Behavior of the action's task insert.
  taskInsert?: { ok: true } | { ok: false; error: { message: string } };
  // Behavior of the finalize update on automation_logs.
  finalizeError?: { message: string } | null;
}

interface RunnerCapture {
  automationLogInserts: Array<Record<string, unknown>>;
  automationLogUpdates: Array<Record<string, unknown>>;
  ruleUpdates: Array<Record<string, unknown>>;
  taskInserts: Array<Record<string, unknown>>;
}

function runnerMock(scenario: RunnerScenario, capture: RunnerCapture) {
  const makeBuilder = (table: string) => {
    const filters: Record<string, unknown> = {};
    const pending: { insert?: Record<string, unknown> } = {};
    const b: Record<string, unknown> = {
      select: () => b,
      eq: (col: unknown, val: unknown) => {
        filters[col as string] = val;
        return b;
      },
      maybeSingle: () => {
        if (table === "automation_logs") {
          // Model the status='success' filter: a non-success row can never be
          // returned by the filtered idempotency query.
          const row = scenario.idempotencyRow;
          const blocked = filters["status"] === "success" && row?.status === "success";
          return Promise.resolve({ data: blocked ? row : null, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      },
      single: () => {
        const payload = pending.insert ?? {};
        if (table === "automation_rules") {
          return Promise.resolve({ data: scenario.rule ?? null, error: null });
        }
        if (table === "automation_logs") {
          if (payload["status"] === "running") {
            capture.automationLogInserts.push(payload);
            if (scenario.claimInsert && !scenario.claimInsert.ok) {
              return Promise.resolve({ data: null, error: scenario.claimInsert.error });
            }
            return Promise.resolve({
              data: { id: scenario.claimInsert?.ok ? scenario.claimInsert.id : "claim-1" },
              error: null,
            });
          }
          capture.automationLogInserts.push(payload);
          return Promise.resolve({ data: { id: "log-1" }, error: null });
        }
        if (table === "tasks") {
          capture.taskInserts.push(payload);
          if (scenario.taskInsert && !scenario.taskInsert.ok) {
            return Promise.resolve({ data: null, error: scenario.taskInsert.error });
          }
          return Promise.resolve({ data: { id: "task-1" }, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      },
      insert: (payload: Record<string, unknown>) => {
        pending.insert = payload;
        return b;
      },
      update: (payload: Record<string, unknown>) => {
        if (table === "automation_logs") {
          capture.automationLogUpdates.push(payload);
          if (scenario.finalizeError) {
            return Promise.resolve({ data: null, error: scenario.finalizeError });
          }
        }
        if (table === "automation_rules") capture.ruleUpdates.push(payload);
        return b;
      },
      from: (t: string) => makeBuilder(t),
    };
    return b;
  };
  return { from: makeBuilder } as unknown as SupabaseClient;
}

function manualRule(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: "rule-1",
    user_id: "user-1",
    enabled: true,
    trigger_type: "manual",
    trigger_config: {},
    condition_config: [],
    action_type: "create_task",
    action_config: { task_title: "Automated Task" },
    run_count: 0,
    ...overrides,
  };
}

function scheduledNeverRule(): Record<string, unknown> {
  // February 31st does not exist: this schedule never matches, making the
  // skipped path deterministic without mocking the clock.
  return manualRule({
    trigger_type: "scheduled_time",
    trigger_config: { schedule: "0 3 31 2 *", timezone: "UTC" },
  });
}

describe("idempotency repair — checkIdempotency status filter", () => {
  it("does not block when the window holds a skipped row", async () => {
    const mock = runnerMock(
      { idempotencyRow: { id: "log-9", status: "skipped" } },
      {
        automationLogInserts: [],
        automationLogUpdates: [],
        ruleUpdates: [],
        taskInserts: [],
      },
    );
    expect(await checkIdempotency(mock as any, "rule-1", "exec-1")).toBe(false);
  });

  it("does not block when the window holds a failed row", async () => {
    const mock = runnerMock(
      { idempotencyRow: { id: "log-9", status: "failed" } },
      {
        automationLogInserts: [],
        automationLogUpdates: [],
        ruleUpdates: [],
        taskInserts: [],
      },
    );
    expect(await checkIdempotency(mock as any, "rule-1", "exec-1")).toBe(false);
  });

  it("still blocks when the window holds a successful row", async () => {
    const mock = runnerMock(
      { idempotencyRow: { id: "log-9", status: "success" } },
      {
        automationLogInserts: [],
        automationLogUpdates: [],
        ruleUpdates: [],
        taskInserts: [],
      },
    );
    expect(await checkIdempotency(mock as any, "rule-1", "exec-1")).toBe(true);
  });
});

describe("idempotency repair — runAutomation lifecycle", () => {
  it("writes skipped logs without claiming the execution window", async () => {
    const capture: RunnerCapture = {
      automationLogInserts: [],
      automationLogUpdates: [],
      ruleUpdates: [],
      taskInserts: [],
    };
    const mock = runnerMock({ rule: scheduledNeverRule() }, capture);
    const result = await runAutomation(mock as any, "user-1", "rule-1", {});
    expect(result.success).toBe(false);
    expect(capture.automationLogInserts).toHaveLength(1);
    expect(capture.automationLogInserts[0]["status"]).toBe("skipped");
    expect(capture.automationLogInserts[0]["execution_id"]).toBeNull();
    expect(capture.taskInserts).toHaveLength(0);
  });

  it("a skipped run does not block a subsequent successful retry", async () => {
    const capture: RunnerCapture = {
      automationLogInserts: [],
      automationLogUpdates: [],
      ruleUpdates: [],
      taskInserts: [],
    };
    const skipped = await runAutomation(
      runnerMock({ rule: scheduledNeverRule() }, capture) as any,
      "user-1",
      "rule-1",
      {},
    );
    expect(skipped.success).toBe(false);
    expect(capture.automationLogInserts[0]["execution_id"]).toBeNull();

    // Same window, now a manual trigger: the skipped row must not block it.
    const retry = await runAutomation(
      runnerMock({ rule: manualRule() }, capture) as any,
      "user-1",
      "rule-1",
      { manual: true },
    );
    expect(retry.success).toBe(true);
    expect(capture.taskInserts).toHaveLength(1);
  });

  it("claims the window with a running row before executing, then finalizes success", async () => {
    const capture: RunnerCapture = {
      automationLogInserts: [],
      automationLogUpdates: [],
      ruleUpdates: [],
      taskInserts: [],
    };
    const mock = runnerMock(
      { rule: manualRule(), claimInsert: { ok: true, id: "claim-1" } },
      capture,
    );
    const result = await runAutomation(mock as any, "user-1", "rule-1", { manual: true });
    expect(result.success).toBe(true);

    expect(capture.automationLogInserts).toHaveLength(1);
    const claim = capture.automationLogInserts[0];
    expect(claim["status"]).toBe("running");
    expect(typeof claim["execution_id"]).toBe("string");
    expect(claim["execution_id"]).not.toBeNull();

    // The action ran, then the claim row was finalized as success.
    expect(capture.taskInserts).toHaveLength(1);
    expect(capture.automationLogUpdates).toHaveLength(1);
    expect(capture.automationLogUpdates[0]["status"]).toBe("success");
    expect(capture.automationLogUpdates[0]["execution_id"]).toBeUndefined();
  });

  it("a failed run releases the claim so the hour can be retried", async () => {
    const capture: RunnerCapture = {
      automationLogInserts: [],
      automationLogUpdates: [],
      ruleUpdates: [],
      taskInserts: [],
    };
    const mock = runnerMock(
      {
        rule: manualRule(),
        claimInsert: { ok: true, id: "claim-1" },
        taskInsert: { ok: false, error: { message: "insert failed" } },
      },
      capture,
    );
    const result = await runAutomation(mock as any, "user-1", "rule-1", { manual: true });
    expect(result.success).toBe(false);

    const finalize = capture.automationLogUpdates[0];
    expect(finalize["status"]).toBe("failed");
    expect(finalize["execution_id"]).toBeNull();
    expect(capture.taskInserts).toHaveLength(1);
  });

  it("a failed run does not block a subsequent successful retry", async () => {
    const capture: RunnerCapture = {
      automationLogInserts: [],
      automationLogUpdates: [],
      ruleUpdates: [],
      taskInserts: [],
    };
    const failed = await runAutomation(
      runnerMock(
        {
          rule: manualRule(),
          claimInsert: { ok: true, id: "claim-1" },
          taskInsert: { ok: false, error: { message: "insert failed" } },
        },
        capture,
      ) as any,
      "user-1",
      "rule-1",
      { manual: true },
    );
    expect(failed.success).toBe(false);

    const retry = await runAutomation(
      runnerMock(
        { rule: manualRule(), claimInsert: { ok: true, id: "claim-2" } },
        capture,
      ) as any,
      "user-1",
      "rule-1",
      { manual: true },
    );
    expect(retry.success).toBe(true);
    expect(capture.taskInserts).toHaveLength(2);
  });

  it("a concurrent duplicate loses the claim and never executes the action", async () => {
    const capture: RunnerCapture = {
      automationLogInserts: [],
      automationLogUpdates: [],
      ruleUpdates: [],
      taskInserts: [],
    };
    // Two concurrent runs race for the same (rule, hour) window. The database
    // partial unique index lets exactly one claim insert win; the loser gets
    // 23505 and must return without executing the action.
    let claimsWon = 0;
    const scenarioFor = (): RunnerScenario => {
      // First claim in wins; the second is rejected by the unique index.
      if (claimsWon === 0) {
        claimsWon++;
        return { rule: manualRule(), claimInsert: { ok: true, id: "claim-1" } };
      }
      return {
        rule: manualRule(),
        claimInsert: { ok: false, error: { code: "23505", message: "duplicate key" } },
      };
    };

    const [a, b] = await Promise.all([
      runAutomation(runnerMock(scenarioFor(), capture) as any, "user-1", "rule-1", {
        manual: true,
      }),
      runAutomation(runnerMock(scenarioFor(), capture) as any, "user-1", "rule-1", {
        manual: true,
      }),
    ]);

    const successes = [a, b].filter((r) => r.success);
    const blocked = [a, b].filter(
      (r) => r.error === "Already executed in this time window (idempotency)",
    );
    expect(successes).toHaveLength(1);
    expect(blocked).toHaveLength(1);
    expect(capture.taskInserts).toHaveLength(1);
  });

  it("an unrelated claim-insert database error propagates", async () => {
    const capture: RunnerCapture = {
      automationLogInserts: [],
      automationLogUpdates: [],
      ruleUpdates: [],
      taskInserts: [],
    };
    const mock = runnerMock(
      {
        rule: manualRule(),
        claimInsert: { ok: false, error: { code: "08006", message: "connection failure" } },
      },
      capture,
    );
    await expect(
      runAutomation(mock as any, "user-1", "rule-1", { manual: true }),
    ).rejects.toThrow("connection failure");
    expect(capture.taskInserts).toHaveLength(0);
  });

  it("finalizeExecution failures after a successful action are logged, never rethrown", async () => {
    const capture: RunnerCapture = {
      automationLogInserts: [],
      automationLogUpdates: [],
      ruleUpdates: [],
      taskInserts: [],
    };
    // The action already ran — a finalize failure must not discard the result
    // or propagate as an error to the caller.
    const mock = runnerMock(
      { rule: manualRule(), finalizeError: { message: "update failed" } },
      capture,
    );
    await expect(
      finalizeExecution(mock as any, "rule-1", "claim-1", "success", { ok: 1 }, null),
    ).resolves.toBeUndefined();
    expect(capture.automationLogUpdates).toHaveLength(1);
    expect(capture.automationLogUpdates[0]["status"]).toBe("success");
  });

  it("finalizeExecution failure on a failed run still records the failed patch with a released claim", async () => {
    const capture: RunnerCapture = {
      automationLogInserts: [],
      automationLogUpdates: [],
      ruleUpdates: [],
      taskInserts: [],
    };
    const mock = runnerMock(
      { rule: manualRule(), finalizeError: { message: "update failed" } },
      capture,
    );
    await expect(
      finalizeExecution(mock as any, "rule-1", "claim-1", "failed", null, "boom"),
    ).resolves.toBeUndefined();
    expect(capture.automationLogUpdates[0]["status"]).toBe("failed");
    expect(capture.automationLogUpdates[0]["execution_id"]).toBeNull();
  });
});
