import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

// Guards the owner-session bootstrap / 401 refresh amplification fix.
//
// Before: `notify()` ran subscribers inline, `clearOwnerSession()` notified from
// inside the failing bootstrap, `useAuth` initiated a second competing bootstrap,
// and every concurrent 401 forced its own owner-session request. Together these
// could drive an unbounded owner-session request loop that hangs/crashes the
// /app renderer.

const OWNER_UUID = "11111111-2222-3333-4444-555555555555";

// Number of times the owner-session server function was actually invoked.
let calls = 0;
let impl: () => Promise<unknown>;
// Invoked synchronously at request-issue time.
let onRequest: (() => void) | null = null;

mock.module("./owner-session.functions", () => ({
  getOwnerSession: () => {
    calls += 1;
    onRequest?.();
    return impl();
  },
}));

type OwnerSessionModule = typeof import("./owner-session");

async function loadModule(): Promise<OwnerSessionModule> {
  // Fresh instance per test so the in-flight slot and notification queue reset.
  return await import(`./owner-session.ts?bust=${Math.random()}`);
}

function okSession() {
  return {
    ok: true,
    session: {
      access_token: "issued-access-token",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: OWNER_UUID, email: "owner@example.com" },
    },
  };
}

function failingSession(code = "upstream_unavailable") {
  return { ok: false, code };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  calls = 0;
  onRequest = null;
  impl = async () => okSession();
});

afterEach(() => {
  onRequest = null;
  impl = async () => okSession();
});

describe("owner session bootstrap single-flight", () => {
  it("shares one bootstrap across concurrent ensureOwnerSession calls", async () => {
    impl = async () => {
      await new Promise((r) => setTimeout(r, 10));
      return okSession();
    };
    const mod = await loadModule();

    const results = await Promise.all([
      mod.ensureOwnerSession(),
      mod.ensureOwnerSession(),
      mod.ensureOwnerSession(),
      mod.ensureOwnerSession(),
    ]);

    expect(calls).toBe(1);
    for (const user of results) expect(user.id).toBe(OWNER_UUID);
  });

  it("returns the identical promise object to concurrent callers", async () => {
    impl = async () => {
      await new Promise((r) => setTimeout(r, 10));
      return okSession();
    };
    const mod = await loadModule();

    const a = mod.ensureOwnerSession();
    const b = mod.ensureOwnerSession();

    expect(a).toBe(b);
    await a;
  });

  it("claims the in-flight slot before issuing the request", async () => {
    // The exact recursion window: the global function middleware reads
    // `isOwnerSessionBootstrapping()` while `getOwnerSession()` is being issued.
    // If the slot is claimed too late, that guard sees "not bootstrapping" and
    // starts a second bootstrap.
    const mod = await loadModule();
    let bootstrappingWhenIssued: boolean | null = null;
    onRequest = () => {
      bootstrappingWhenIssued = mod.isOwnerSessionBootstrapping();
    };

    await mod.ensureOwnerSession();

    expect(bootstrappingWhenIssued).toBe(true);
    expect(calls).toBe(1);
  });

  it("does not recursively trigger unlimited bootstrap attempts on failure", async () => {
    impl = async () => failingSession();
    const mod = await loadModule();

    // A subscriber that re-enters bootstrap on every notification, exactly like
    // the old __root / useAuth wiring did.
    let notifications = 0;
    const unsubscribe = mod.subscribeOwnerSession(() => {
      notifications += 1;
      void mod.ensureOwnerSession().catch(() => undefined);
    });

    await expect(mod.ensureOwnerSession()).rejects.toThrow(/OWNER_SESSION_upstream_unavailable/);
    await tick();
    await tick();
    await tick();

    unsubscribe();
    // Nothing to clear, so there is no transition to report: the failure cannot
    // reach the subscriber at all.
    expect(notifications).toBe(0);
    expect(calls).toBe(1);
  });

  it("terminates after a single retry when a live session later fails to refresh", async () => {
    const mod = await loadModule();

    // Establish a real session first.
    await mod.ensureOwnerSession();
    await tick();
    expect(calls).toBe(1);

    // Now it starts failing. This time there IS state to clear.
    impl = async () => failingSession();
    let notifications = 0;
    const unsubscribe = mod.subscribeOwnerSession(() => {
      notifications += 1;
      void mod.ensureOwnerSession().catch(() => undefined);
    });

    await expect(mod.ensureOwnerSession(true)).rejects.toThrow(/OWNER_SESSION_upstream_unavailable/);
    await tick();
    await tick();
    await tick();

    unsubscribe();
    // Exactly one notification for the clear. The subscriber's retry is one
    // further request, which fails against an already-empty store and therefore
    // reports no transition -- so the loop terminates. Bounded at 3 total
    // requests instead of running forever.
    expect(notifications).toBe(1);
    expect(calls).toBe(3);
    expect(mod.getOwnerAccessTokenSync()).toBeNull();
  });

  it("does not synchronously re-enter bootstrap from a notification", async () => {
    impl = async () => okSession();
    const mod = await loadModule();

    let listenerCalls = 0;
    let sawBootstrappingDuringNotify: boolean | null = null;
    const unsubscribe = mod.subscribeOwnerSession(() => {
      listenerCalls += 1;
      sawBootstrappingDuringNotify = mod.isOwnerSessionBootstrapping();
    });

    const promise = mod.ensureOwnerSession();

    // Notifications are queued onto a microtask, so nothing has been delivered
    // by the time `ensureOwnerSession` has returned.
    expect(listenerCalls).toBe(0);
    expect(mod.isOwnerSessionBootstrapping()).toBe(true);

    await promise;

    expect(listenerCalls).toBe(1);
    // The transition that produced the notification has already finished.
    expect(sawBootstrappingDuringNotify).toBe(false);
    expect(mod.getOwnerAccessTokenSync()).toBe("issued-access-token");

    unsubscribe();
  });

  it("delivers a genuine second transition instead of coalescing it away", async () => {
    // Guards refresh-token rotation: two quick but real transitions must both be
    // observed, because notifications are deferred rather than debounced.
    const mod = await loadModule();

    const seen: (string | null)[] = [];
    const unsubscribe = mod.subscribeOwnerSession(() => {
      seen.push(mod.getOwnerAccessTokenSync());
    });

    await mod.ensureOwnerSession();
    await tick();

    mod.clearOwnerSession();
    await tick();

    unsubscribe();
    expect(seen).toEqual(["issued-access-token", null]);
  });

  it("keeps existing successful owner-session behaviour", async () => {
    const mod = await loadModule();

    expect(mod.isOwnerSessionFresh()).toBe(false);
    const user = await mod.ensureOwnerSession();

    expect(user).toEqual({ id: OWNER_UUID, email: "owner@example.com" });
    expect(mod.getOwnerUserSync()).toEqual(user);
    expect(mod.getOwnerAccessTokenSync()).toBe("issued-access-token");
    expect(mod.isOwnerSessionFresh()).toBe(true);
    expect(mod.isOwnerSessionBootstrapping()).toBe(false);

    // A fresh session is reused without another server request.
    await mod.ensureOwnerSession();
    expect(calls).toBe(1);
  });

  it("fails closed and keeps no token when the session is unavailable", async () => {
    impl = async () => failingSession("not_configured");
    const mod = await loadModule();

    await expect(mod.ensureOwnerSession()).rejects.toThrow(/OWNER_SESSION_not_configured/);
    expect(mod.getOwnerAccessTokenSync()).toBeNull();
    expect(mod.getOwnerUserSync()).toBeNull();
    expect(mod.isOwnerSessionFresh()).toBe(false);
  });

  it("stops notifying once unsubscribed", async () => {
    const mod = await loadModule();

    let notified = 0;
    const unsubscribe = mod.subscribeOwnerSession(() => {
      notified += 1;
    });
    unsubscribe();

    await mod.ensureOwnerSession();
    await tick();

    expect(notified).toBe(0);
  });
});