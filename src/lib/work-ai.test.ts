// Tests for the Ascend Work AI Operating System.
// Pure prompt builders tested directly; workNextActionsImpl tested with a
// mock Supabase client (proves RLS scoping + aggregation, no network).

import { describe, expect, it } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildAudit,
  buildOpportunities,
  buildOutreach,
  buildProposal,
  buildQualify,
  buildReplyClassifier,
  buildResearch,
  buildWebsiteSpec,
} from "./work-ai-core";
import { workNextActionsImpl } from "./work-ai.server";

describe("Work AI prompt builders", () => {
  it("qualify separates OBSERVED/INFERRED/UNKNOWN and potential levels", () => {
    const { system, user } = buildQualify({
      name: "Acme Co",
      website: "acme.com",
      niche: "cafe",
    });
    expect(system).toContain("OBSERVED");
    expect(system).toContain("INFERRED");
    expect(system).toContain("UNKNOWN");
    expect(system).toContain("HIGH POTENTIAL");
    expect(user).toContain("Acme Co");
  });

  it("research marks UNKNOWN when not measurable", () => {
    const { system } = buildResearch({ name: "Acme", website: "acme.com" });
    expect(system).toContain("UNKNOWN");
    expect(system).toContain("Do not invent observations");
  });

  it("audit requires confidence and actionable findings", () => {
    const { system } = buildAudit({ name: "Acme", website: "acme.com" });
    expect(system).toContain("DESIGN");
    expect(system).toContain("confidence");
    expect(system.toLowerCase()).toContain("recommended improvement");
  });

  it("opportunities include confidence and avoid guaranteed-buy claims", () => {
    const { system } = buildOpportunities("Summary here");
    expect(system).toContain("OPPORTUNITY");
    expect(system).toContain("WHY IT MATTERS");
    expect(system).toContain("CONFIDENCE");
    expect(system).toContain("will definitely buy");
  });

  it("outreach requires human approval and no auto-send", () => {
    const { system } = buildOutreach({
      lead: { name: "Acme" },
      channel: "cold_email",
    });
    expect(system).toContain("human approval");
    expect(system).toContain("No generic spam");
  });

  it("reply classifier returns a draft response", () => {
    const { system } = buildReplyClassifier("Thanks, can you send a quote?");
    expect(system).toContain("PRICE_OBJECTION");
    expect(system).toContain("DRAFT RESPONSE");
  });

  it("proposal uses pricing placeholders, not invented facts", () => {
    const { system } = buildProposal({ lead: { name: "Acme" } });
    expect(system).toContain("PLACEHOLDER");
    expect(system).toContain("timeline");
  });

  it("website spec includes acceptance criteria and no deploy", () => {
    const { system } = buildWebsiteSpec({ requirements: "A portfolio site" });
    expect(system).toContain("acceptance criteria");
    expect(system).toContain("Do NOT deploy");
  });
});

function mockSupabase(counts: Record<string, number>, finance: { amount: number }[], capture: Record<string, unknown>) {
  const from = (table: string) => {
    capture.table = table;
    const b: Record<string, unknown> = {
      _count: false,
      select(...args: unknown[]) {
        b._count = !!(args[1] && (args[1] as { count?: string }).count === "exact");
        return b;
      },
      eq(col: unknown, val: unknown) {
        if (col === "user_id") capture.user = val;
        return b;
      },
      then(res: (r: unknown) => void) {
        const r = b._count
          ? { count: counts[table] ?? 0, error: null }
          : { data: finance, error: null };
        res(r);
      },
    } as Record<string, unknown> & {
      _count: boolean;
      select: (...a: unknown[]) => typeof b;
      eq: (c: unknown, v: unknown) => typeof b;
      then: (res: (r: unknown) => void) => void;
    };
    b._count = false;
    return b;
  };
  return { from };
}

describe("workNextActionsImpl", () => {
  it("scopes aggregation to the authenticated user and computes recommendations", () => {
    const capture: Record<string, unknown> = {};
    const supabase = mockSupabase(
      { leads: 2, outreach: 1 },
      [{ amount: 100 }, { amount: 250 }],
      capture,
    ) as unknown as SupabaseClient;

    return workNextActionsImpl({ supabase, userId: "user-A" }).then((res) => {
      expect(capture.user).toBe("user-A");
      expect(res.leadsNeedingResearch).toBe(2);
      expect(res.incomeTotal).toBe(350);
      expect(res.recommendations.length).toBeGreaterThan(0);
      expect(res.recommendations[0].action).toBe("RESEARCH");
    });
  });

  it("never aggregates for a different user", () => {
    const capture: Record<string, unknown> = {};
    const supabase = mockSupabase({}, [], capture) as unknown as SupabaseClient;
    return workNextActionsImpl({ supabase, userId: "user-A" }).then(() => {
      expect(capture.user).toBe("user-A");
      expect(capture.user).not.toBe("user-B");
    });
  });
});
