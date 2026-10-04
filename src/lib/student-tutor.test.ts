// Tests for the Ascend Student AI Tutor.
// Pure prompt builders are tested directly; retrieval scoping + prompt assembly
// are tested via prepareTutorContext using a mock Supabase client (no network).

import { describe, expect, it } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildTutorSystem,
  buildTutorUser,
  type ContextItem,
} from "./student-tutor-core";
import { prepareTutorContext } from "./student-tutor.server";

const docItem: ContextItem = {
  source: "document",
  title: "Engineering Physics Notes",
  page: 3,
  heading: "Wave Optics",
  text: "Diffraction bends waves around obstacles.",
  score: 5,
};

const docRow = {
  content_text: "Diffraction bends waves around obstacles in Engineering Physics.",
  page_number: 3,
  heading: "Wave Optics",
  user_documents: {
    filename: "Engineering Physics Notes",
    document_type: "lecture_notes",
    subject: "Engineering Physics",
  },
};

function mockSupabase(rowsByTable: Record<string, unknown[]>, capture: Record<string, unknown>) {
  const builder: Record<string, (...args: unknown[]) => unknown> = {
    select: () => builder,
    eq: (col: unknown, val: unknown) => {
      if (col === "user_id") capture.user = val;
      return builder;
    },
    or: () => builder,
    in: () => builder,
    order: () => builder,
    gt: () => builder,
    gte: () => builder,
    lt: () => builder,
    lte: () => builder,
    limit: () =>
      Promise.resolve({ data: rowsByTable[capture.table as string] ?? [], error: null }),
    maybeSingle: () =>
      Promise.resolve({ data: rowsByTable[capture.table as string]?.[0] ?? null, error: null }),
  };
  return {
    from: (table: string) => {
      capture.table = table;
      return builder;
    },
  };
}

describe("buildTutorSystem", () => {
  it("TEACH includes teaching structure and source rules", () => {
    const sys = buildTutorSystem("TEACH", { level: "normal" });
    expect(sys).toContain("## Concept");
    expect(sys).toContain("## Practice");
    expect(sys).toContain("Never invent");
    expect(sys).toContain("Source:");
    expect(sys).toContain("LEVEL 2");
  });

  it("PRACTICE asks one question at a time and withholds the answer", () => {
    const sys = buildTutorSystem("PRACTICE", { questionType: "mcq" });
    expect(sys).toContain("ONE practice question");
    expect(sys).toContain("do NOT provide the answer");
    expect(sys).toContain("mcq");
  });

  it("EVALUATE uses the mastery scale and evaluation sections", () => {
    const sys = buildTutorSystem("EVALUATE");
    expect(sys).toContain("## Result");
    expect(sys).toContain("## Ideal Answer");
    expect(sys).toContain("## Next Step");
    expect(sys).toContain("mastery level 0-5");
  });

  it("EXAM builds a revision foundation without inventing syllabus", () => {
    const sys = buildTutorSystem("EXAM", { subject: "Physics" });
    expect(sys).toContain("Syllabus Coverage");
    expect(sys).toContain("Topic Prioritization");
    expect(sys).toContain("Do NOT invent the user's university syllabus");
    expect(sys).toContain("Physics");
  });
});

describe("buildTutorUser", () => {
  it("includes source citations when evidence is present", () => {
    const user = buildTutorUser({ message: "What is diffraction?", items: [docItem] });
    expect(user).toContain("Engineering Physics Notes");
    expect(user).toContain("page 3");
    expect(user).toContain("Wave Optics");
  });

  it("signals no evidence when empty", () => {
    const user = buildTutorUser({ message: "Anything?", items: [] });
    expect(user).toContain("no relevant uploaded documents");
  });

  it("embeds the student answer for evaluation", () => {
    const user = buildTutorUser({
      message: "What is diffraction?",
      items: [docItem],
      userAnswer: "It is bending of light.",
    });
    expect(user).toContain("STUDENT ANSWER:");
    expect(user).toContain("It is bending of light.");
  });

  it("includes conversation history when provided", () => {
    const user = buildTutorUser({
      message: "Follow up",
      items: [],
      history: [{ role: "user", content: "Teach me X" }],
    });
    expect(user).toContain("CONVERSATION HISTORY:");
    expect(user).toContain("STUDENT: Teach me X");
  });
});

describe("prepareTutorContext authorization", () => {
  it("scopes retrieval to the authenticated user and returns document sources", () => {
    const capture: Record<string, unknown> = {};
    const supabase = mockSupabase(
      { document_chunks: [docRow] },
      capture,
    ) as unknown as SupabaseClient;

    return prepareTutorContext({
      supabase,
      userId: "user-A",
      mode: "TEACH",
      message: "Explain diffraction in Engineering Physics",
      subject: "Engineering Physics",
    }).then((ctx) => {
      expect(capture.user).toBe("user-A");
      expect(ctx.sources.some((s) => s.title === "Engineering Physics Notes")).toBe(
        true,
      );
      expect(ctx.system).toContain("Source:");
    });
  });

  it("never builds context for a different user id", () => {
    const capture: Record<string, unknown> = {};
    const supabase = mockSupabase({}, capture) as unknown as SupabaseClient;

    return prepareTutorContext({
      supabase,
      userId: "user-A",
      mode: "CHAT",
      message: "Hello",
    }).then(() => {
      expect(capture.user).toBe("user-A");
      expect(capture.user).not.toBe("user-B");
    });
  });
});
