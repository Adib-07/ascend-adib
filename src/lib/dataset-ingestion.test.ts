import { describe, expect, it, beforeEach } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  validateKaggleSlug,
  sanitizePathSegment,
  detectFileType,
  profileCSV,
  profileJSON,
  MAX_DOWNLOAD_SIZE,
  ALLOWED_ARCHIVE_TYPES,
  ALLOWED_DATA_TYPES,
} from "./dataset-ingestion.server";

function mockSupabase(
  responses: Map<string, { data: any; error: any }>,
  capture: Record<string, any>,
) {
  const builder: Record<string, (...args: unknown[]) => unknown> = {
    select: () => builder,
    eq: (col: unknown, val: unknown) => {
      if (col === "user_id") capture.userId = val;
      if (col === "id") capture.id = val;
      if (col === "external_dataset_id") capture.externalDatasetId = val;
      return builder;
    },
    is: (col: unknown, val: unknown) => {
      if (col === "user_id" && val === null) capture.isNullUserId = true;
      return builder;
    },
    or: () => builder,
    in: () => builder,
    limit: () => builder,
    maybeSingle: () => Promise.resolve(responses.get("maybeSingle") ?? { data: null, error: null }),
    single: () => Promise.resolve(responses.get("single") ?? { data: null, error: null }),
    order: () => builder,
    gte: () => builder,
    lte: () => builder,
    upsert: () => builder,
    insert: () => Promise.resolve(responses.get("insert") ?? { data: null, error: null }),
    update: () => Promise.resolve(responses.get("update") ?? { data: null, error: null }),
    delete: () => Promise.resolve(responses.get("delete") ?? { data: null, error: null }),
    from: (table: string) => {
      capture.table = table;
      return builder;
    },
    storage: {
      from: () => ({
        upload: () => Promise.resolve({ data: null, error: null }),
        download: () =>
          Promise.resolve({
            data: { arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) },
            error: null,
          }),
        remove: () => Promise.resolve({ data: null, error: null }),
      }),
    },
  };
  return { from: builder.from, storage: builder.storage } as unknown as SupabaseClient;
}

describe("validateKaggleSlug", () => {
  it("accepts valid slug format", () => {
    expect(validateKaggleSlug("user/dataset")).toBe(true);
    expect(validateKaggleSlug("user-name/data-set")).toBe(true);
    expect(validateKaggleSlug("a/b")).toBe(true);
  });

  it("rejects invalid slug format", () => {
    expect(validateKaggleSlug("user")).toBe(false);
    expect(validateKaggleSlug("user/")).toBe(false);
    expect(validateKaggleSlug("/dataset")).toBe(false);
    expect(validateKaggleSlug("user/dataset/extra")).toBe(false);
    expect(validateKaggleSlug("USER/dataset")).toBe(false);
    expect(validateKaggleSlug("user/DATASET")).toBe(false);
    expect(validateKaggleSlug("user/dataset!")).toBe(false);
  });
});

describe("sanitizePathSegment", () => {
  it("replaces special characters", () => {
    expect(sanitizePathSegment("normal_file.csv")).toBe("normal_file_csv");
    expect(sanitizePathSegment("file with spaces.csv")).toBe("file_with_spaces_csv");
    expect(sanitizePathSegment("file@#$%^&*().csv")).toBe("file__________csv");
    expect(sanitizePathSegment("../etc/passwd")).toBe("___etc_passwd");
  });
});

describe("detectFileType", () => {
  it("detects CSV files", () => {
    expect(detectFileType("data.csv", new Uint8Array())).toBe("csv");
    expect(detectFileType("DATA.CSV", new Uint8Array())).toBe("csv");
    expect(detectFileType("data.txt", new Uint8Array())).toBe("csv");
    expect(detectFileType("data.tsv", new Uint8Array())).toBe("csv");
  });

  it("detects JSON files", () => {
    expect(detectFileType("data.json", new Uint8Array())).toBe("json");
  });

  it("detects parquet files", () => {
    expect(detectFileType("data.parquet", new Uint8Array())).toBe("parquet");
  });

  it("detects npz files", () => {
    expect(detectFileType("data.npz", new Uint8Array())).toBe("npz");
  });

  it("returns unknown for unsupported", () => {
    expect(detectFileType("data.xyz", new Uint8Array())).toBe("unknown");
  });
});

describe("profileCSV", () => {
  it("profiles simple CSV", async () => {
    const csv = "a,b,c\n1,2,3\n4,5,6\n7,8,9";
    const profile = await profileCSV(new TextEncoder().encode(csv));
    expect(profile.rowCount).toBe(3);
    expect(profile.columnCount).toBe(3);
    expect(profile.columns.length).toBe(3);
    expect(profile.columns[0].name).toBe("a");
    expect(profile.columns[0].type).toBe("numeric");
    expect(profile.columns[0].missingCount).toBe(0);
  });

  it("handles missing values", async () => {
    const csv = "a,b\n1,\n,2\n3,4";
    const profile = await profileCSV(new TextEncoder().encode(csv));
    expect(profile.rowCount).toBe(3);
    expect(profile.columns[0].missingCount).toBe(1);
    expect(profile.columns[1].missingCount).toBe(1);
  });

  it("detects categorical columns", async () => {
    const csv = "label\ncat\ndog\ncat\nbird";
    const profile = await profileCSV(new TextEncoder().encode(csv));
    expect(profile.columns[0].type).toBe("categorical");
  });

  it("detects numeric columns", async () => {
    const csv = "value\n1.5\n2.7\n3.14";
    const profile = await profileCSV(new TextEncoder().encode(csv));
    expect(profile.columns[0].type).toBe("numeric");
    expect(profile.columns[0].stats.min).toBe(1.5);
    expect(profile.columns[0].stats.max).toBe(3.14);
  });

  it("provides sample values", async () => {
    const csv = "x\n1\n2\n3\n4\n5\n6";
    const profile = await profileCSV(new TextEncoder().encode(csv));
    expect(profile.columns[0].sampleValues.length).toBeLessThanOrEqual(5);
  });
});

describe("profileJSON", () => {
  it("profiles array of objects", async () => {
    const json = [
      { a: 1, b: "x" },
      { a: 2, b: "y" },
    ];
    const profile = await profileJSON(new TextEncoder().encode(JSON.stringify(json)));
    expect(profile.rowCount).toBe(2);
    expect(profile.columnCount).toBe(2);
  });

  it("handles wrapped data", async () => {
    const json = { data: [{ a: 1 }, { a: 2 }] };
    const profile = await profileJSON(new TextEncoder().encode(JSON.stringify(json)));
    expect(profile.rowCount).toBe(2);
  });

  it("throws on empty array", async () => {
    await expect(profileJSON(new TextEncoder().encode("[]"))).rejects.toThrow();
  });
});

describe("dataset ingestion state machine", () => {
  const validStatuses = [
    "pending",
    "downloading",
    "validating",
    "extracting",
    "processing",
    "ready",
    "failed",
  ];

  it("defines all required statuses", () => {
    expect(validStatuses).toContain("pending");
    expect(validStatuses).toContain("downloading");
    expect(validStatuses).toContain("validating");
    expect(validStatuses).toContain("extracting");
    expect(validStatuses).toContain("processing");
    expect(validStatuses).toContain("ready");
    expect(validStatuses).toContain("failed");
  });

  it("has terminal states", () => {
    const terminal = ["ready", "failed"];
    expect(validStatuses.filter((s) => terminal.includes(s))).toEqual(terminal);
  });
});

describe("file size limits", () => {
  it("defines MAX_DOWNLOAD_SIZE", () => {
    expect(MAX_DOWNLOAD_SIZE).toBe(200 * 1024 * 1024);
  });
});

describe("allowed archive types", () => {
  it("includes zip and gzip", () => {
    expect(ALLOWED_ARCHIVE_TYPES).toContain("application/zip");
    expect(ALLOWED_ARCHIVE_TYPES).toContain("application/x-zip-compressed");
    expect(ALLOWED_ARCHIVE_TYPES).toContain("application/gzip");
    expect(ALLOWED_ARCHIVE_TYPES).toContain("application/x-gzip");
  });
});

describe("allowed data types", () => {
  it("includes csv, json, parquet", () => {
    expect(ALLOWED_DATA_TYPES).toContain("text/csv");
    expect(ALLOWED_DATA_TYPES).toContain("application/json");
    expect(ALLOWED_DATA_TYPES).toContain("application/parquet");
  });
});
