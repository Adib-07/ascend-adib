// OWNER SESSION — server function boundary.
//
// Reachable only from the private host (Tailscale). It deliberately does NOT
// use `requireSupabaseAuth`: establishing the session is what makes auth
// available, so it cannot itself require auth.
//
// Defence in depth on the request shape: the validator is `.strict()`, so a
// request carrying `user_id`, `owner_id`, `email`, or any other key is
// rejected outright. There is no parameter through which a caller could name
// an identity.
//
// Failures are returned as a discriminated union rather than thrown. TanStack
// Start does not serialize thrown handler errors across the RPC boundary (they
// degrade to an opaque "Seroval Error"), and a plain value guarantees the
// browser learns the failure *code* without ever receiving a token, the
// Supabase URL, or a stack trace.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type OwnerSessionFailureCode =
  "not_configured" | "invalid_credentials" | "owner_mismatch" | "upstream_unavailable";

export interface OwnerSessionMaterial {
  access_token: string;
  expires_at: number;
  user: { id: string; email: string | null };
}

export type OwnerSessionResult =
  { ok: true; session: OwnerSessionMaterial } | { ok: false; code: OwnerSessionFailureCode };

// Re-entrancy guard. The global `attachSupabaseAuth` client middleware runs on
// every serverFn call including this one; without the guard, asking for an
// owner session would recurse into asking for an owner session.
let inProgress = false;

export function ownerSessionRequestInFlight(): boolean {
  return inProgress;
}

export const getOwnerSession = createServerFn({ method: "POST" })
  .validator(z.object({}).strict())
  .handler(async (): Promise<OwnerSessionResult> => {
    inProgress = true;
    try {
      const server = await import("./owner-session.server");
      const material = await server.getOwnerSession();
      // Explicit projection: the refresh token is never part of this response.
      return {
        ok: true,
        session: {
          access_token: material.access_token,
          expires_at: material.expires_at,
          user: material.user,
        },
      };
    } catch (err) {
      const code = (err as { code?: unknown } | null | undefined)?.code;
      if (
        code === "not_configured" ||
        code === "invalid_credentials" ||
        code === "owner_mismatch" ||
        code === "upstream_unavailable"
      ) {
        return { ok: false, code };
      }
      return { ok: false, code: "upstream_unavailable" };
    } finally {
      inProgress = false;
    }
  });
