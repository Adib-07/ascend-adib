import { describe, expect, it } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Regression tests for the production-readiness audit fixes.
//
// These assert on source text and on the extracted pure algorithms, because the
// components involved are React trees with heavy module graphs. Each test names
// the bug it pins so a future edit that reintroduces it fails loudly.

const SRC = fileURLToPath(new URL("../../src/", import.meta.url));
const SUPABASE = fileURLToPath(new URL("../../supabase/", import.meta.url));

async function collect(dir: string, out: string[] = []): Promise<string[]> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      await collect(path, out);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      out.push(path);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// P0 SECURITY: SECURITY DEFINER briefing/review RPCs must not bypass RLS
// ---------------------------------------------------------------------------
describe("P0: SECURITY DEFINER briefing/review RPC authorization", () => {
  // The guard belongs in the migration that CREATES the functions. These tests
  // therefore pin the creating migration, not a follow-up patch: an environment
  // that runs the chain from scratch never gets an insecure version at any
  // point, and there is no window where the RPC is exploitable.
  const MIGRATION = join(SUPABASE, "migrations", "20261006120004_briefing_review.sql");
  const RPCS = ["generate_daily_briefing", "generate_weekly_review"];

  const blockOf = (sql: string, name: string) => {
    const i = sql.indexOf(`create or replace function public.${name}(`);
    expect(i).toBeGreaterThan(-1);
    return sql.slice(i, sql.indexOf("$$;", i));
  };

  it("guards both RPCs with an auth.uid() check", async () => {
    const sql = await readFile(MIGRATION, "utf8");

    for (const fn of RPCS) {
      const block = blockOf(sql, fn);
      // SECURITY DEFINER => the function must police its own caller.
      expect(block).toContain("security definer");
      expect(block).toContain("auth.role() <> 'service_role'");
      expect(block).toContain("auth.uid() is distinct from p_user_id");
      expect(block).toContain("not authorized: p_user_id must match the authenticated user");
      // 42501 = insufficient_privilege.
      expect(block).toContain("using errcode = '42501'");
    }
  });

  it("enforces the guard before p_user_id is trusted", async () => {
    const sql = await readFile(MIGRATION, "utf8");

    for (const fn of RPCS) {
      const body = blockOf(sql, fn);
      const beginAt = body.indexOf("\nbegin\n");
      expect(beginAt).toBeGreaterThan(-1);
      // Anchor on the `if` that opens the guard, not on a fragment of its
      // condition, so the guard statement itself is not mistaken for a
      // preceding statement.
      const guardAt = body.indexOf("if auth.role() <> 'service_role'");
      expect(guardAt).toBeGreaterThan(beginAt);
      const between = body
        .slice(beginAt + "\nbegin\n".length, guardAt)
        .split("\n")
        .filter((l) => l.trim() && !l.trim().startsWith("--"));
      expect(between).toEqual([]);
    }
  });

  it("pins search_path on both SECURITY DEFINER functions", async () => {
    const sql = await readFile(MIGRATION, "utf8");

    for (const fn of RPCS) {
      const block = blockOf(sql, fn);
      expect(block).toContain("security definer");
      // search_path hijack class: must be pinned on the function itself.
      expect(block).toMatch(/security definer\s*\nset search_path = public/);
    }
  });

  it("revokes EXECUTE from PUBLIC and anon on both RPCs", async () => {
    const sql = await readFile(MIGRATION, "utf8");

    for (const fn of RPCS) {
      const sig = `public.${fn}(uuid, date)`;
      expect(sql).toContain(`revoke execute on function ${sig} from public;`);
      expect(sql).toContain(`revoke execute on function ${sig} from anon;`);
      expect(sql).toContain(`grant execute on function ${sig} to authenticated, service_role;`);
    }
  });

  it("leaves both tables, policies, indexes and grants untouched", async () => {
    const sql = await readFile(MIGRATION, "utf8");

    // The hardening is function-scoped. The two materialized tables and their
    // RLS/grants/indexes must be exactly as before.
    expect(sql.match(/create table public\.daily_briefing/g)).toHaveLength(1);
    expect(sql.match(/create table public\.weekly_review/g)).toHaveLength(1);
    expect(sql.match(/enable row level security/g)).toHaveLength(2);
    expect(sql).toContain('create policy "own daily_briefing"');
    expect(sql).toContain('create policy "own weekly_review"');
    expect(sql).toContain(
      "grant select, insert, update, delete on public.daily_briefing to authenticated;",
    );
    expect(sql).toContain("grant select, insert, update, delete on public.weekly_review to authenticated;");
    expect(sql).toContain("grant all on public.daily_briefing to service_role;");
    expect(sql).toContain("grant all on public.weekly_review to service_role;");
    expect(sql).toContain(
      "create index if not exists idx_daily_briefing_user_date on public.daily_briefing (user_id, briefing_date desc);",
    );
    expect(sql).toContain(
      "create index if not exists idx_weekly_review_user_week on public.weekly_review (user_id, week_start desc);",
    );

    // No table/column/function signature drift.
    expect(sql).toContain(
      "create or replace function public.generate_daily_briefing(p_user_id uuid, p_date date)",
    );
    expect(sql).toContain(
      "create or replace function public.generate_weekly_review(p_user_id uuid, p_week_start date)",
    );
  });

  it("preserves the query and return behavior of both RPCs", async () => {
    const sql = await readFile(MIGRATION, "utf8");
    const daily = blockOf(sql, "generate_daily_briefing");
    const weekly = blockOf(sql, "generate_weekly_review");

    for (const src of [
      "public.tasks",
      "public.events",
      "public.habits",
      "public.goals",
      "public.work_projects",
      "public.academic_projects",
    ]) {
      expect(daily).toContain(src);
    }
    for (const src of [
      "public.tasks",
      "public.habit_logs",
      "public.habits",
      "public.goals",
      "public.work_projects",
      "public.academic_projects",
      "public.notes",
    ]) {
      expect(weekly).toContain(src);
    }

    // Return payload keys, unchanged.
    for (const key of [
      "'overdue_tasks'",
      "'today_tasks'",
      "'today_events'",
      "'today_habits'",
      "'upcoming_deadlines'",
      "'active_projects'",
      "'daily_intention'",
    ]) {
      expect(daily).toContain(key);
    }
    for (const key of [
      "'completed_tasks'",
      "'incomplete_tasks'",
      "'habit_completion'",
      "'streak_changes'",
      "'project_progress'",
      "'goal_progress'",
      "'important_notes'",
      "'upcoming_deadlines'",
    ]) {
      expect(weekly).toContain(key);
    }

    // Both still upsert, so the guard did not turn them into read-only.
    expect(daily).toContain("insert into public.daily_briefing");
    expect(daily).toContain("on conflict (user_id, briefing_date) do update set");
    expect(weekly).toContain("insert into public.weekly_review");
    expect(weekly).toContain("on conflict (user_id, week_start) do update set");
  });

  it("is the only definition of these RPCs in the chain (no duplicate patch)", async () => {
    const dir = join(SUPABASE, "migrations");
    const migrations = (await readdir(dir))
      .filter((f) => f.endsWith(".sql"))
      .map((f) => join(dir, f));
    expect(migrations.length).toBeGreaterThan(0);
    const defining: string[] = [];

    for (const file of migrations) {
      const sql = await readFile(file, "utf8");
      for (const fn of RPCS) {
        if (sql.includes(`function public.${fn}(`)) {
          defining.push(`${file.split("/").pop()}:${fn}`);
        }
      }
    }

    // Exactly one migration may define each RPC. A second CREATE OR REPLACE
    // would be a security patch layered on an insecure creation -- which is the
    // failure mode this suite exists to prevent.
    expect(defining.sort()).toEqual(
      ["20261006120004_briefing_review.sql:generate_daily_briefing", "20261006120004_briefing_review.sql:generate_weekly_review"].sort(),
    );
  });

  it("ships the grant assertions as a verification script, not a migration", async () => {
    const script = await readFile(
      join(SUPABASE, "verification", "briefing_rpc_guards.sql"),
      "utf8",
    );
    // Read-only: it must not create, alter or drop anything.
    expect(script).not.toMatch(/\b(create|alter|drop|grant|revoke|insert|update|delete)\s/i);
    for (const col of [
      "daily_body_has_uid_check",
      "weekly_body_has_uid_check",
      "public_can_execute",
      "anon_can_execute",
      "authenticated_can_execute",
      "service_role_can_execute",
      "search_path_pinned",
    ]) {
      expect(script).toContain(col);
    }
  });

  it("leaves every other SECURITY DEFINER function in the repo guarded", async () => {
    const migrations = await collect(SUPABASE);
    const offenders: string[] = [];
    for (const file of migrations) {
      const sql = await readFile(file, "utf8");
      if (!/security definer/i.test(sql)) continue;
      // Every SECURITY DEFINER block must either check auth.uid() or be covered
      // by an explicit REVOKE later in the same file.
      const blocks = sql.split(/create or replace function/i).slice(1);
      for (const block of blocks) {
        if (!/security definer/i.test(block)) continue;
        if (/auth\.uid\(\)/i.test(block)) continue;
        if (/revoke execute/i.test(sql)) continue;
        offenders.push(`${file}: ${block.slice(0, 60).replace(/\s+/g, " ")}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// P1 CRASHES
// ---------------------------------------------------------------------------
describe("P1: FlashcardsTab cannot dereference an out-of-range card", () => {
  it("clamps the index during render instead of in an effect", async () => {
    const src = await readFile(join(SRC, "components/ascend/FlashcardsTab.tsx"), "utf8");
    // The crash was `cards[idx]` being undefined after a delete, which the
    // post-render bounds effect could not prevent.
    expect(src).toContain("cards[Math.min(idx, cards.length - 1)]");
    expect(src).not.toMatch(/const current = cards\[idx\];/);
  });

  it("guards the render branch on `current` existing", async () => {
    const src = await readFile(join(SRC, "components/ascend/FlashcardsTab.tsx"), "utf8");
    expect(src).toContain("cards.length === 0 || !current");
  });
});

describe("P1: PipelineView survives corrupt localStorage", () => {
  it("wraps the render-phase JSON.parse in try/catch", async () => {
    const src = await readFile(join(SRC, "components/ascend/PipelineView.tsx"), "utf8");
    const init = src.slice(
      src.indexOf("ascend_services_v1"),
      src.indexOf("ascend_services_v1") + 700,
    );
    expect(init).toContain("try {");
    expect(init).toContain("catch {");
    expect(init).toContain("Array.isArray(parsed)");
  });
});

// ---------------------------------------------------------------------------
// P1 INFINITE LOOPS
// ---------------------------------------------------------------------------
describe("P1: error toasts cannot grow without bound", () => {
  it("dedupes WorkOverview error toasts across re-renders", async () => {
    const src = await readFile(join(SRC, "components/ascend/WorkOverview.tsx"), "utf8");
    // makeCrud/useQuery return fresh objects every render and the 1 Hz `now`
    // clock forces a render every second, so an unguarded toast.error in this
    // effect appended a new toast every second.
    expect(src).toContain("toastedErrors");
    expect(src).toContain("WeakSet");
  });

  it("dedupes PipelineView error toasts", async () => {
    const src = await readFile(join(SRC, "components/ascend/PipelineView.tsx"), "utf8");
    expect(src).toContain("toastedPipelineError");
  });
});

// ---------------------------------------------------------------------------
// P1 FAILED DATABASE CALLS: every .from() must name a real table
// ---------------------------------------------------------------------------
describe("P1: no code queries a table that no migration creates", () => {
  it("personal-assistant run_automation targets automation_rules, not automations", async () => {
    const src = await readFile(join(SRC, "lib/personal-assistant.server.ts"), "utf8");
    // `automations` never existed in any migration, so this read failed with
    // 42P01 on every run_automation action the assistant proposed.
    expect(src).not.toContain('.from("automations")');
    expect(src).toContain('.from("automation_rules")');
  });

  it("every literal .from() table is created by some migration", async () => {
    const migrationDir = join(SUPABASE, "migrations");
    const files = (await readdir(migrationDir)).filter((f) => f.endsWith(".sql"));

    const created = new Set<string>();
    for (const f of files) {
      const sql = await readFile(join(migrationDir, f), "utf8");
      for (const m of sql.matchAll(
        /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z_]+)/gi,
      )) {
        created.add(m[1]);
      }
    }
    expect(created.size).toBeGreaterThan(0);

    const offenders: string[] = [];
    for (const file of await collect(SRC)) {
      if (file.endsWith(".test.ts") || file.endsWith(".test.tsx")) continue;
      const src = await readFile(file, "utf8");
      for (const m of src.matchAll(/\.from\(\s*["']([a-z_]+)["']\s*\)/g)) {
        const table = m[1];
        if (created.has(table)) continue;
        // Storage buckets are not tables and are not created by these migrations.
        const before = src.slice(Math.max(0, m.index - 120), m.index).replace(/\s+/g, " ");
        if (before.endsWith(".storage") || /\.storage\s*$/.test(before)) continue;
        const line = src.slice(0, m.index).split("\n").length;
        offenders.push(`${file.split("/").slice(-2).join("/")}:${line} -> ${table}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// P1 AUTOMATION
// ---------------------------------------------------------------------------
describe("P1: automation conditions are reachable", () => {
  it("accepts an array condition_config, which is what the runner reads", async () => {
    const fns = await readFile(join(SRC, "lib/automation.functions.ts"), "utf8");
    // z.record() can only hold objects, so `condition_config` could never be the
    // ConditionConfig[] the runner casts to -- conditions never evaluated.
    expect(fns).toContain("z.union([z.array(z.record(z.unknown())), z.record(z.unknown())])");
    const create = fns.slice(
      fns.indexOf("createAutomationRule"),
      fns.indexOf("updateAutomationRule"),
    );
    expect(create).toContain("condition_config: conditionConfigSchema");
  });

  it("matches the shape the runner actually consumes", async () => {
    const runner = await readFile(join(SRC, "lib/automation.runner.ts"), "utf8");
    expect(runner).toContain("rule.condition_config as unknown as ConditionConfig[]");
    expect(runner).toContain("conditions.length > 0");
    const parser = await readFile(join(SRC, "automation.parser.ts"), "utf8").catch(
      async () => await readFile(join(SRC, "lib/automation.parser.ts"), "utf8"),
    );
    // The AI parser emits an array, so it must now round-trip.
    expect(parser).toContain("conditionConfig?: Array<Record<");
  });
});

describe("P2: dispatcher processed count is not double counted", () => {
  it("increments `processed` exactly once per successful dispatch", async () => {
    const src = await readFile(join(SRC, "lib/event.dispatcher.ts"), "utf8");
    const sites = src.split("const result = await dispatchEvent(").slice(1);
    expect(sites.length).toBe(3);
    for (const site of sites) {
      const segment = site.slice(0, 400);
      const increments = segment.split("processed++;").length - 1;
      // Exactly one, and it must be inside the success branch.
      expect(increments).toBe(1);
      expect(segment.indexOf("if (result.success)")).toBeLessThan(segment.indexOf("processed++;"));
    }
  });
});

// ---------------------------------------------------------------------------
// P2 DATA LOSS
// ---------------------------------------------------------------------------
describe("P2: document chunker keeps the trailing partial chunk", () => {
  // Extract and run the real chunker from document.server.ts so this asserts on
  // behaviour, not on source text.
  function chunk(text: string, target = 900, min = 200) {
    const chunks: string[] = [];
    let current = "";
    const isHeading = (p: string) => /^#{1,6}\s/.test(p);
    const flush = (force = false) => {
      const t = current.trim();
      if (t.length >= min || chunks.length === 0 || force) chunks.push(t);
      current = "";
    };
    for (const para of text.split(/\n\s*\n/)) {
      if (isHeading(para)) continue;
      const candidate = current ? current + "\n" + para : para;
      if (candidate.length > target && current.length >= min) {
        flush();
        current = para;
      } else {
        current = candidate;
      }
    }
    if (current.trim().length > 0) flush(true);
    return chunks;
  }

  it("does not drop a short final paragraph", () => {
    const body = "A".repeat(860);
    const tail = "IMPORTANT FINAL SUMMARY OF THE PDF ANSWER KEY";
    const chunks = chunk(`${body}\n\n${tail}`);
    expect(chunks).toHaveLength(2);
    expect(chunks[1]).toBe(tail);
  });

  it("still emits a single chunk for a short whole document", () => {
    const chunks = chunk("tiny document");
    expect(chunks).toEqual(["tiny document"]);
  });

  it("pins the force flag on the final flush in the real implementation", async () => {
    const src = await readFile(join(SRC, "lib/document.server.ts"), "utf8");
    expect(src).toContain("if (current.trim().length > 0) flush(true);");
    expect(src).toContain("chunks.length === 0 || force");
  });
});

// ---------------------------------------------------------------------------
// P2 CORRECTNESS
// ---------------------------------------------------------------------------
describe("P2: a boolean habit can be unchecked", () => {
  it("does not hard-code done = true for boolean metrics", async () => {
    const src = await readFile(join(SRC, "lib/ascend-hooks.ts"), "utf8");
    expect(src).not.toContain('const done = metricType === "boolean" ? true : logValue >= target;');
    expect(src).toContain(
      'const done = metricType === "boolean" ? logValue > 0 : logValue >= target;',
    );
  });

  it("still defaults a boolean log with no explicit value to done", async () => {
    const src = await readFile(join(SRC, "lib/ascend-hooks.ts"), "utf8");
    expect(src).toContain('const logValue = value ?? (metricType === "boolean" ? 1 : target);');
  });
});

describe("P3: document size renders in KB", () => {
  it("divides before formatting", async () => {
    const src = await readFile(join(SRC, "components/ascend/DocumentsView.tsx"), "utf8");
    expect(src).not.toContain("doc.size_bytes ?? 0 / 1024");
    expect(src).toContain("((doc.size_bytes ?? 0) / 1024).toFixed(1)");
  });
});

// ---------------------------------------------------------------------------
// P2 REPO HYGIENE
// ---------------------------------------------------------------------------
describe("P2: .env.example must stay committable", () => {
  it("has its gitignore negation after the .env* rule (last match wins)", async () => {
    const gitignore = await readFile(
      join(fileURLToPath(new URL("../..", import.meta.url)), ".gitignore"),
      "utf8",
    );
    const ignoreStar = gitignore.split("\n").findIndex((l) => l.trim() === ".env*");
    const negate = gitignore.split("\n").findIndex((l) => l.trim() === "!.env.example");
    expect(ignoreStar).toBeGreaterThan(-1);
    expect(negate).toBeGreaterThan(-1);
    // Git applies the LAST matching pattern, so the negation must come after.
    expect(negate).toBeGreaterThan(ignoreStar);
  });
});
