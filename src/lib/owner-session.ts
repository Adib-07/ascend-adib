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

let notifyPending = false;
let notifyScheduled = false;
let flushing = false;

// Notifications are queued onto a microtask and are never delivered
// re-entrantly. Previously `notify()` ran listeners inline, so a listener that
// caused a transition re-entered the store while the first transition was still
// mid-flight -- and because `clearOwnerSession()` notified from inside the very
// bootstrap that was failing, a single failure could drive an unbounded
// owner-session request loop that pegs the renderer.
//
// A transition triggered by a listener is delivered on the *next* turn rather
// than nested inside the current one, so a listener never observes a half-applied
// transition. Nothing is coalesced away: a genuine second transition (e.g. a
// rotated token) always schedules a fresh flush. There is no timer and no
// polling -- a flush is scheduled only while a notification is actually pending.
function flushNotifications(): void {
  notifyScheduled = false;
  flushing = true;
  try {
    if (notifyPending) {
      notifyPending = false;
      for (const listener of [...listeners]) {
        // A listener may have unsubscribed while an earlier listener ran.
        if (listeners.has(listener)) listener();
      }
    }
  } finally {
    flushing = false;
  }
  // Transitions caused by the flush above are delivered on the next turn, never
  // recursively inside this one.
  if (notifyPending) notify();
}

function notify(): void {
  notifyPending = true;
  if (flushing || notifyScheduled) return;
  notifyScheduled = true;
  queueMicrotask(flushNotifications);
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
  // Notify only on a real transition. The failure path below clears more than
  // once per bootstrap; an idempotent clear must not fan out to listeners, or
  // every failure re-enters bootstrap on the next turn.
  const hadState = accessToken !== null || expiresAt !== 0 || ownerUser !== null;
  accessToken = null;
  expiresAt = 0;
  ownerUser = null;
  if (hadState) notify();
}

export function ensureOwnerSession(force = false): Promise<OwnerUser> {
  if (!force && isOwnerSessionFresh() && ownerUser) {
    return Promise.resolve(ownerUser);
  }
  if (bootstrapping) return bootstrapping;

  // Claim the in-flight slot *before* the request is issued. Previously the
  // async IIFE ran synchronously up to the `getOwnerSession()` call, so
  // `bootstrapping` was still null when that call synchronously entered the
  // global function middleware -- whose `isOwnerSessionBootstrapping()` guard
  // therefore saw "not bootstrapping" and started a second bootstrap. The gate
  // below makes the invariant hold: at most one owner-session request is in
  // flight, and no request can be issued while `bootstrapping` reads null.
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });

  const pending = (async () => {
    await gate;
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

  bootstrapping = pending;
  release();

  return pending;
}

export async function getOwnerUser(): Promise<OwnerUser> {
  return ensureOwnerSession();
}
