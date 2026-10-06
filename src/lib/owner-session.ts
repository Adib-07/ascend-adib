// OWNER SESSION — browser side state.
//
// Holds ONLY the short-lived Supabase access token, in memory. The owner
// refresh token never exists in the browser: it lives in a server-only env var
// and a 0600 file on the private host, and is rotated server-side.
//
// There is deliberately no localStorage/sessionStorage/cookie persistence.
// After a refresh or a browser restart the app calls the private owner-session
// endpoint again, which is cheap and keeps no long-lived credential in the
// client.

import { getOwnerSession } from "./owner-session.functions";
const REFRESH_AHEAD_SECONDS = 60;

export interface OwnerUser {
  id: string;
  email: string | null;
}

let accessToken: string | null = null;
let expiresAt = 0;
let ownerUser: OwnerUser | null = null;
let bootstrapping: Promise<OwnerUser> | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

export function subscribeOwnerSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Synchronous read used by the fetch wrapper and the function middleware.
// Never triggers a network call, so it cannot recurse into the bootstrap.
export function getOwnerAccessTokenSync(): string | null {
  return accessToken;
}

export function getOwnerUserSync(): OwnerUser | null {
  return ownerUser;
}

export function isOwnerSessionBootstrapping(): boolean {
  return bootstrapping !== null;
}

export function isOwnerSessionFresh(): boolean {
  return Boolean(accessToken) && expiresAt - REFRESH_AHEAD_SECONDS > Date.now() / 1000;
}

export function clearOwnerSession(): void {
  accessToken = null;
  expiresAt = 0;
  ownerUser = null;
  notify();
}

export function ensureOwnerSession(force = false): Promise<OwnerUser> {
  if (!force && isOwnerSessionFresh() && ownerUser) {
    return Promise.resolve(ownerUser);
  }
  if (bootstrapping) return bootstrapping;

  bootstrapping = (async () => {
    try {
      const result = await getOwnerSession({ data: {} });
      if (!result.ok) {
        clearOwnerSession();
        throw new Error(`OWNER_SESSION_${result.code}: owner session unavailable.`);
      }
      accessToken = result.session.access_token;
      expiresAt = result.session.expires_at;
      ownerUser = result.session.user;
      notify();
      return result.session.user;
    } catch (err) {
      // Fail closed: no session, no data.
      clearOwnerSession();
      throw err;
    } finally {
      bootstrapping = null;
    }
  })();

  return bootstrapping;
}

export async function getOwnerUser(): Promise<OwnerUser> {
  return ensureOwnerSession();
}
