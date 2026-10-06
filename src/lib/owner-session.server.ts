// OWNER SESSION — SERVER ONLY.
//
// Custody for the single-owner Supabase refresh token. This module must never
// be imported into the browser bundle: it reads a server-only environment
// variable and persists rotated refresh tokens to a server-only file.
//
// It never returns the refresh token to any caller. The browser receives only
// the short-lived access token plus the owner id/email it needs to build the
// Authorization header that Supabase RLS (auth.uid()) already expects.
//
// Why a file and not a database table: GoTrue rotates refresh tokens. A single
// static token in an env var eventually gets rejected (and can trip reuse
// detection, which revokes the family). Persisting the current token to a
// 0600 file on the private host keeps us rotation-correct without adding a new
// service-role-writable table to the database.

import { createClient } from "@supabase/supabase-js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const REFRESH_AHEAD_SECONDS = 60;

export interface OwnerSessionMaterial {
  access_token: string;
  expires_at: number;
  user: { id: string; email: string | null };
}

export class OwnerSessionError extends Error {
  readonly code:
    "not_configured" | "invalid_credentials" | "owner_mismatch" | "upstream_unavailable";

  constructor(code: OwnerSessionError["code"], message: string) {
    super(message);
    this.name = "OwnerSessionError";
    this.code = code;
  }
}

function tokenFilePath(): string {
  return (
    process.env.OWNER_REFRESH_TOKEN_FILE?.trim() ||
    join(homedir(), ".ascend", "owner-refresh-token")
  );
}

async function readStoredRefreshToken(): Promise<string | undefined> {
  try {
    const raw = await readFile(tokenFilePath(), "utf8");
    const value = raw.trim();
    return value.length > 0 ? value : undefined;
  } catch {
    return undefined;
  }
}

// Written with 0600 and created with restrictive perms so the current refresh
// token is never world-readable on a shared machine.
async function persistRefreshToken(token: string): Promise<void> {
  const path = tokenFilePath();
  try {
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    await writeFile(path, `${token}\n`, { encoding: "utf8", mode: 0o600 });
  } catch (err) {
    // Never log the token itself, only the failure.
    console.error(
      "[owner-session] could not persist rotated refresh token; set OWNER_REFRESH_TOKEN_FILE to a writable path",
      err instanceof Error ? err.message : "unknown error",
    );
  }
}

async function currentRefreshToken(): Promise<string | undefined> {
  return (await readStoredRefreshToken()) ?? (process.env.OWNER_REFRESH_TOKEN?.trim() || undefined);
}

// Serialize refreshes: GoTrue rotation means two concurrent refreshes with the
// same token would invalidate each other.
let inFlight: Promise<OwnerSessionMaterial> | undefined;

async function mint(): Promise<OwnerSessionMaterial> {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new OwnerSessionError(
      "not_configured",
      "Supabase server credentials are not configured on this host.",
    );
  }

  const refreshToken = await currentRefreshToken();
  if (!refreshToken) {
    throw new OwnerSessionError(
      "not_configured",
      "No owner refresh token is available on this host.",
    );
  }

  // Anon-key client: this performs a normal Supabase refresh for the existing
  // owner user. It is NOT the service-role key and grants no extra privilege.
  const supabase = createClient<never>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });

  let data: Awaited<ReturnType<typeof supabase.auth.refreshSession>>;
  try {
    data = await supabase.auth.refreshSession({ refresh_token: refreshToken });
  } catch (err) {
    throw new OwnerSessionError(
      "upstream_unavailable",
      `Supabase auth is unreachable: ${err instanceof Error ? err.message : "unknown error"}`,
    );
  }

  if (data.error || !data.data?.session) {
    throw new OwnerSessionError(
      "invalid_credentials",
      "The stored owner refresh token was rejected by Supabase.",
    );
  }

  const session = data.data.session;
  const userId = session.user?.id;
  if (!userId) {
    throw new OwnerSessionError(
      "invalid_credentials",
      "Supabase returned a session without a user.",
    );
  }

  // Optional binding: if the host declares the expected owner, refuse any
  // other account. Guards against a mistyped or swapped token silently
  // handing the app a different identity.
  const expectedOwner = process.env.OWNER_USER_ID?.trim();
  if (expectedOwner && expectedOwner !== userId) {
    throw new OwnerSessionError(
      "owner_mismatch",
      "The stored owner token does not match the configured OWNER_USER_ID.",
    );
  }

  // Rotation: keep the newest refresh token server-side only.
  if (session.refresh_token && session.refresh_token !== refreshToken) {
    await persistRefreshToken(session.refresh_token);
  }

  return {
    access_token: session.access_token,
    expires_at: session.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
    user: { id: userId, email: session.user?.email ?? null },
  };
}

export function getOwnerSession(): Promise<OwnerSessionMaterial> {
  inFlight ??= mint().finally(() => {
    inFlight = undefined;
  });
  return inFlight;
}

export function ownerSessionIsFresh(expiresAt: number | undefined): boolean {
  if (!expiresAt) return false;
  return expiresAt - REFRESH_AHEAD_SECONDS > Math.floor(Date.now() / 1000);
}
