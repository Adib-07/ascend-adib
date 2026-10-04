import { describe, expect, it } from "bun:test";
import {
  normalizeKeywords,
  classifyQuestion,
  enforceBudget,
  rankDocumentChunks,
  buildUserPrompt,
  buildSystemPrompt,
  SOURCE_TIER,
  type ContextItem,
  type RawDocChunk,
} from "./context-engine-core";
import { retrieveDocumentChunks } from "./context-engine.server";

// Minimal mock of the RLS-scoped Supabase client injected by requireSupabaseAuth.
// It records the user_id filter so tests can prove retrieval never trusts a
// client-supplied user id.
function mockSupabase(rows: unknown[], capture: Record<string, unknown>) {
  const builder: Record<string, (...args: unknown[]) => unknown> = {
    select: () => builder,
    eq: (col: unknown, val: unknown) => {
      if (col === "user_id") capture.user = val;
      return builder;
    },
    or: () => builder,
    in: () => builder,
    limit: () => Promise.resolve({ data: rows, error: null }),
  };
  return { from: () => builder };
}

const authSampleChunks: RawDocChunk[] = [
  {
    content_text:
      "Diffraction is the bending of waves around obstacles. In Engineering Physics we study single-slit diffraction and interference patterns.",
    page_number: 3,
    heading: "Wave Optics",
    docTitle: "Engineering Physics Notes",
    docType: "lecture_notes",
    docSubject: "Engineering Physics",
  },
  {
    content_text:
      "The French Revolution began in 1789. It was a period of radical social and political upheaval.",
    page_number: 1,
    heading: "Introduction",
    docTitle: "World History Book",
    docType: "textbook",
    docSubject: "History",
  },
];
describe("normalizeKeywords", () => {
  it("removes stopwords and punctuation", () => {
    expect(normalizeKeywords("The Quick brown foxes!")).toEqual([
      "quick",
      "brown",
      "foxes",
    ]);
  });

  it("returns empty when only short/stopwords", () => {
    expect(normalizeKeywords("a an the to of")).toEqual([]);
  });

  it("deduplicates terms", () => {
    expect(normalizeKeywords("study study learn learn")).toEqual(["study", "learn"]);
  });
});

describe("classifyQuestion", () => {
  it("classifies academic physics questions", () => {
    expect(
      classifyQuestion("Explain diffraction in Engineering Physics"),
    ).toBe("ACADEMIC");
  });

  it("classifies freelancing questions", () => {
    expect(classifyQuestion("How do I negotiate a freelance contract?")).toBe(
      "FREELANCING",
    );
  });

  it("classifies english questions", () => {
    expect(classifyQuestion("Improve my english speaking fluency")).toBe("ENGLISH");
  });

  it("classifies work questions", () => {
    expect(classifyQuestion("How to write a proposal for a client?")).toBe("WORK");
  });

  it("falls back to general", () => {
    expect(classifyQuestion("What is the meaning of life?")).toBe("GENERAL");
  });
});

describe("rankDocumentChunks", () => {
  const sampleChunks: RawDocChunk[] = [
    {
      content_text:
        "Diffraction is the bending of waves around obstacles. In Engineering Physics we study single-slit diffraction and interference patterns.",
      page_number: 3,
      heading: "Wave Optics",
      docTitle: "Engineering Physics Notes",
      docType: "lecture_notes",
      docSubject: "Engineering Physics",
    },
    {
      content_text:
        "The French Revolution began in 1789. It was a period of radical social and political upheaval.",
      page_number: 1,
      heading: "Introduction",
      docTitle: "World History Book",
      docType: "textbook",
      docSubject: "History",
    },
  ];

  it("ranks relevant subject chunks first", () => {
    const terms = normalizeKeywords("diffraction Engineering Physics");
    const ranked = rankDocumentChunks(sampleChunks, terms, {
      subject: "Engineering Physics",
    });
    expect(ranked[0].title).toBe("Engineering Physics Notes");
    expect(ranked[0].page).toBe(3);
  });

  it("excludes irrelevant documents when score is zero", () => {
    const terms = normalizeKeywords("diffraction physics");
    const ranked = rankDocumentChunks(sampleChunks, terms, {
      category: "ACADEMIC",
    });
    expect(ranked.every((r) => r.title === "Engineering Physics Notes")).toBe(
      true,
    );
  });

  it("respects the context budget", () => {
    const big: RawDocChunk[] = Array.from({ length: 20 }, (_, i) => ({
      content_text: "neural networks backpropagation gradient " + "x".repeat(500),
      page_number: i,
      heading: null,
      docTitle: "ML Book",
      docType: "textbook",
      docSubject: null,
    }));
    const ranked = rankDocumentChunks(big, ["neural", "backpropagation"], {
      maxItems: 5,
      maxChars: 4000,
    });
    expect(ranked.length).toBeLessThanOrEqual(5);
  });
});

describe("enforceBudget", () => {
  it("caps by item count and char budget", () => {
    const items: ContextItem[] = Array.from({ length: 10 }, (_, i) => ({
      source: "document",
      title: `Doc ${i}`,
      page: null,
      heading: null,
      text: "word ".repeat(200),
      score: 10 - i,
    }));
    expect(enforceBudget(items, 3, 100000).length).toBe(3);
    expect(enforceBudget(items, 100, 400).length).toBeGreaterThan(0);
    expect(enforceBudget(items, 100, 400).length).toBeLessThan(10);
  });
});

describe("buildUserPrompt", () => {
  it("includes source labels for citations", () => {
    const items: ContextItem[] = [
      {
        source: "task",
        title: "Finish DB assignment",
        page: null,
        heading: null,
        text: "Due tomorrow at 7 PM",
        score: 5,
      },
    ];
    const prompt = buildUserPrompt("What should I do today?", items);
    expect(prompt).toContain("Finish DB assignment");
    expect(prompt).toContain("TASK");
    expect(prompt).toContain("Due tomorrow at 7 PM");
  });

  it("signals no evidence when empty", () => {
    const prompt = buildUserPrompt("Anything?", []);
    expect(prompt).toContain("no relevant");
  });
});

describe("buildSystemPrompt", () => {
  it("contains hallucination controls", () => {
    const sys = buildSystemPrompt("ACADEMIC");
    expect(sys).toContain("Focus area");
    expect(sys).toContain("Never invent");
    expect(sys).toContain("not covered");
  });
});

describe("SOURCE_TIER", () => {
  it("prioritizes user data over curated", () => {
    expect(SOURCE_TIER.task).toBeLessThan(SOURCE_TIER.curated);
    expect(SOURCE_TIER.goal).toBeLessThan(SOURCE_TIER.official);
    expect(SOURCE_TIER.dataset).toBeGreaterThan(SOURCE_TIER.curated);
  });
});
describe("retrieveDocumentChunks authorization", () => {
  it("scopes the query to the authenticated userId (no client user_id trust)", () => {
    const capture: Record<string, unknown> = {};
    const supabase = mockSupabase(
      authSampleChunks as unknown[],
      capture,
    ) as unknown as Parameters<typeof retrieveDocumentChunks>[0];

    return retrieveDocumentChunks(supabase, "user-A", "diffraction").then(
      (items) => {
        expect(capture.user).toBe("user-A");
        expect(items.length).toBeGreaterThan(0);
      },
    );
  });

  it("never queries with a different user id", () => {
    const capture: Record<string, unknown> = {};
    const supabase = mockSupabase([], capture) as unknown as Parameters<
      typeof retrieveDocumentChunks
    >[0];

    return retrieveDocumentChunks(supabase, "user-A", "notes").then(() => {
      expect(capture.user).toBe("user-A");
      expect(capture.user).not.toBe("user-B");
    });
  });
});
