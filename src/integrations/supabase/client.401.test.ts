import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

// Guards the 401 refresh amplification fix in the Supabase browser client.
//
// Before: every 401 called `ensureOwnerSession(true)` on its own. Because
// `force` skips the freshness check and the in-flight guard only dedupes
// *concurrent* bootstraps, a burst of parallel 401s produced one owner-session
// server request per request -- a 401 -> refresh -> 401 storm.

let refreshes = 0;
let refreshImpl: () => Promise<unknown>;
let accessToken: string | null = null;

const isFresh = () => true;

mock.module("@/lib/owner-session", () => ({
  ensureOwnerSession: (force?: boolean) => {
    if (force) {
      refreshes += 1;
      return refreshImpl();
    }
    return Promise.resolve({ id: "owner" });
  },
  getOwnerAccessTokenSync: () => accessToken,
  isOwnerSessionFresh: isFresh,
}));

type ClientModule = typeof import("@/integrations/supabase/client");

async function loadModule(): Promise<ClientModule> {
  return await import(`@/integrations/supabase/client?bust=${Math.random()}`);
}

// A fetch stub. `statusesFor[url]` is a per-URL queue of statuses, one consumed
// per attempt; the last entry repeats once the queue is down to one, so
// `[401]` means "always 401" and `[401, 200]` means "401 then 200".
let statusesFor: Record<string, number[]> = {};
let requests: string[] = [];

const realFetch = globalThis.fetch;

function nextStatus(url: string): number {
  const queue = statusesFor[url];
  if (!queue || queue.length === 0) return 200;
  return queue.length === 1 ? queue[0]! : queue.shift()!;
}

function installFetchStub() {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : String(input);
    requests.push(url);
    const status = nextStatus(url);
    return new Response(status === 200 ? "{}" : "unauthorized", { status });
  }) as typeof fetch;
}

beforeEach(() => {
  refreshes = 0;
  requests = [];
  statusesFor = {};
  accessToken = null;
  refreshImpl = async () => {
    accessToken = "refreshed-token";
    return { id: "owner" };
  };
  installFetchStub();
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("supabase client 401 refresh single-flight", () => {
  it("shares one forced refresh across concurrent 401s", async () => {
    const mod = await loadModule();
    refreshImpl = async () => {
      await new Promise((r) => setTimeout(r, 10));
      accessToken = "refreshed-token";
      return { id: "owner" };
    };
    // Every attempt 401s, so the retry cannot be mistaken for a real success.
    statusesFor = { "https://api.test/a": [401], "https://api.test/b": [401], "https://api.test/c": [401] };

    const supabaseFetch = mod.createSupabaseFetch("publishable-key");
    await Promise.all([
      supabaseFetch("https://api.test/a"),
      supabaseFetch("https://api.test/b"),
      supabaseFetch("https://api.test/c"),
    ]);

    expect(refreshes).toBe(1);
    // One original attempt + exactly one retry each.
    expect(requests).toHaveLength(6);
  });

  it("retries each original request at most once", async () => {
    const mod = await loadModule();
    statusesFor = { "https://api.test/a": [401, 200] };

    const supabaseFetch = mod.createSupabaseFetch("publishable-key");
    const response = await supabaseFetch("https://api.test/a");

    // Attempt 1 -> 401, attempt 2 -> 200.
    expect(requests).toHaveLength(2);
    expect(response.status).toBe(200);
    expect(refreshes).toBe(1);
  });

  it("does not refresh again when the retried request also returns 401", async () => {
    const mod = await loadModule();
    statusesFor = { "https://api.test/a": [401] };

    const supabaseFetch = mod.createSupabaseFetch("publishable-key");
    const response = await supabaseFetch("https://api.test/a");

    // Still 401 after the retry, and surfaced as-is with no second refresh.
    expect(response.status).toBe(401);
    expect(requests).toHaveLength(2);
    expect(refreshes).toBe(1);
  });

  it("does not refresh at all when the request succeeds", async () => {
    const mod = await loadModule();
    statusesFor = { "https://api.test/a": [200] };

    const supabaseFetch = mod.createSupabaseFetch("publishable-key");
    const response = await supabaseFetch("https://api.test/a");

    expect(response.status).toBe(200);
    expect(requests).toHaveLength(1);
    expect(refreshes).toBe(0);
  });

  it("surfaces the 401 normally when the refresh fails", async () => {
    const mod = await loadModule();
    refreshImpl = async () => {
      throw new Error("OWNER_SESSION_upstream_unavailable: owner session unavailable.");
    };
    statusesFor = { "https://api.test/a": [401] };

    const supabaseFetch = mod.createSupabaseFetch("publishable-key");
    const response = await supabaseFetch("https://api.test/a");

    expect(response.status).toBe(401);
    expect(requests).toHaveLength(2);
    expect(refreshes).toBe(1);
  });

  it("allows a later, separate 401 to start its own refresh wave", async () => {
    const mod = await loadModule();
    statusesFor = { "https://api.test/a": [401], "https://api.test/b": [401] };

    const supabaseFetch = mod.createSupabaseFetch("publishable-key");
    await supabaseFetch("https://api.test/a");
    // The previous wave has settled and released the slot.
    await supabaseFetch("https://api.test/b");

    expect(refreshes).toBe(2);
  });

  it("attaches the refreshed bearer token on the retry", async () => {
    const mod = await loadModule();
    statusesFor = { "https://api.test/a": [401, 200] };
    const authHeaders: (string | null)[] = [];

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : String(input);
      requests.push(url);
      const status = nextStatus(url);
      authHeaders.push(new Headers(init?.headers).get("Authorization"));
      return new Response(status === 200 ? "{}" : "unauthorized", { status });
    }) as typeof fetch;

    const supabaseFetch = mod.createSupabaseFetch("publishable-key");
    await supabaseFetch("https://api.test/a");

    expect(authHeaders[0]).toBeNull();
    expect(authHeaders[1]).toBe("Bearer refreshed-token");
  });
});