import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const OWNER_UUID = "11111111-2222-3333-4444-555555555555";
const OTHER_UUID = "99999999-8888-7777-6666-555555555555";

const SECRET_TOKEN = "super-secret-refresh-token-value";
const ROTATED_TOKEN = "rotated-refresh-token-value";

let tempDir: string;
let seenRefreshTokens: string[] = [];
let refreshSessionImpl: () => Promise<{
  data: { session: unknown } | { session: null };
  error: { message: string } | null;
}>;

mock.module("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      refreshSession: async (opts: { refresh_token: string }) => {
        // Assert the server is the one supplying the token, never the caller.
        expect(opts.refresh_token).toBeString();
        seenRefreshTokens.push(opts.refresh_token);
        return refreshSessionImpl();
      },
    },
  }),
}));

const OWNER_ENV_KEYS = [
  "OWNER_REFRESH_TOKEN",
  "OWNER_REFRESH_TOKEN_FILE",
  "OWNER_USER_ID",
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
] as const;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "ascend-owner-"));
  seenRefreshTokens = [];
  for (const key of OWNER_ENV_KEYS) delete process.env[key];
  process.env.SUPABASE_URL = "https://project.supabase.co";
  process.env.SUPABASE_PUBLISHABLE_KEY = "publishable-key";
  process.env.OWNER_REFRESH_TOKEN_FILE = join(tempDir, "token");
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
  for (const key of OWNER_ENV_KEYS) delete process.env[key];
});

function okSession(refreshToken = SECRET_TOKEN) {
  return {
    data: {
      session: {
        access_token: "issued-access-token",
        refresh_token: refreshToken,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: OWNER_UUID, email: "owner@example.com" },
      },
    },
    error: null,
  } as never;
}

async function loadModule() {
  // Fresh module instance so the in-flight mutex and cached path are reset.
  return await import(`./owner-session.server.ts?bust=${Math.random()}`);
}

describe("owner session server", () => {
  it("fails closed with not_configured when no owner token exists", async () => {
    refreshSessionImpl = async () => okSession();
    const mod = await loadModule();

    await expect(mod.getOwnerSession()).rejects.toMatchObject({ code: "not_configured" });
  });

  it("fails closed when Supabase rejects the stored token", async () => {
    process.env.OWNER_REFRESH_TOKEN = SECRET_TOKEN;
    refreshSessionImpl = async () =>
      ({ data: { session: null }, error: { message: "bad" } }) as never;
    const mod = await loadModule();

    await expect(mod.getOwnerSession()).rejects.toMatchObject({ code: "invalid_credentials" });
  });

  it("returns the access token and owner identity but never the refresh token", async () => {
    process.env.OWNER_REFRESH_TOKEN = SECRET_TOKEN;
    refreshSessionImpl = async () => okSession();
    const mod = await loadModule();

    const material = await mod.getOwnerSession();

    expect(material.access_token).toBe("issued-access-token");
    expect(material.user.id).toBe(OWNER_UUID);
    expect(material.user.email).toBe("owner@example.com");

    // The single most important assertion in this file.
    const serialised = JSON.stringify(material);
    expect(serialised).not.toContain(SECRET_TOKEN);
    expect(Object.keys(material)).toEqual(["access_token", "expires_at", "user"]);
  });

  it("binds the session to OWNER_USER_ID and refuses a different account", async () => {
    process.env.OWNER_REFRESH_TOKEN = SECRET_TOKEN;
    process.env.OWNER_USER_ID = OTHER_UUID;
    refreshSessionImpl = async () => okSession();
    const mod = await loadModule();

    await expect(mod.getOwnerSession()).rejects.toMatchObject({ code: "owner_mismatch" });
  });

  it("accepts the session when OWNER_USER_ID matches", async () => {
    process.env.OWNER_REFRESH_TOKEN = SECRET_TOKEN;
    process.env.OWNER_USER_ID = OWNER_UUID;
    refreshSessionImpl = async () => okSession();
    const mod = await loadModule();

    const material = await mod.getOwnerSession();
    expect(material.user.id).toBe(OWNER_UUID);
  });

  it("persists the rotated refresh token server-side and never logs it", async () => {
    process.env.OWNER_REFRESH_TOKEN = SECRET_TOKEN;
    refreshSessionImpl = async () => okSession(ROTATED_TOKEN);
    const mod = await loadModule();

    const logs: string[] = [];
    const originalError = console.error;
    const originalWarn = console.warn;
    console.error = (...args: unknown[]) => logs.push(args.map(String).join(" "));
    console.warn = (...args: unknown[]) => logs.push(args.map(String).join(" "));

    try {
      await mod.getOwnerSession();
    } finally {
      console.error = originalError;
      console.warn = originalWarn;
    }

    // Rotated token must be written to the server-only file...
    const stored = await readFile(join(tempDir, "token"), "utf8");
    expect(stored.trim()).toBe(ROTATED_TOKEN);

    // ...and must not have been written to any log.
    expect(logs.join("\n")).not.toContain(SECRET_TOKEN);
    expect(logs.join("\n")).not.toContain(ROTATED_TOKEN);
  });

  it("prefers the rotated token file over the original env var", async () => {
    process.env.OWNER_REFRESH_TOKEN = SECRET_TOKEN;
    await Bun.write(join(tempDir, "token"), `${ROTATED_TOKEN}\n`);
    refreshSessionImpl = async () => okSession(ROTATED_TOKEN);
    const mod = await loadModule();

    await mod.getOwnerSession();

    expect(seenRefreshTokens).toEqual([ROTATED_TOKEN]);
  });

  it("serialises concurrent refreshes so rotation cannot invalidate itself", async () => {
    process.env.OWNER_REFRESH_TOKEN = SECRET_TOKEN;
    let calls = 0;
    refreshSessionImpl = async () => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 5));
      return okSession(ROTATED_TOKEN);
    };
    const mod = await loadModule();

    await Promise.all([mod.getOwnerSession(), mod.getOwnerSession(), mod.getOwnerSession()]);

    expect(calls).toBe(1);
  });
});
