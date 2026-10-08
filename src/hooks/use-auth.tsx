import * as React from "react";
import { subscribeOwnerSession, getOwnerUserSync, type OwnerUser } from "@/lib/owner-session";

// Retained because `components/layout/*` imports it. Single-owner semantics:
// there is no sign-out (the owner session is the app), and `loading` reflects
// whether the private owner session has been established.
//
// Observation only: `__root` owns the single owner-session bootstrap. This hook
// used to call `ensureOwnerSession()` itself, which meant a second component
// competing to start a bootstrap (and, on every notification, a second one).
// It now reads the settled state and subscribes. The store delivers
// notifications on a microtask after the state change, so the synchronous reads
// below always observe a settled transition.
export function useAuth() {
  const [user, setUser] = React.useState<OwnerUser | null>(getOwnerUserSync());
  const [loading, setLoading] = React.useState(!getOwnerUserSync());

  React.useEffect(() => {
    const unsubscribe = subscribeOwnerSession(() => {
      const current = getOwnerUserSync();
      setUser(current);
      setLoading(!current);
    });
    // Cover a transition that landed between render and subscribe.
    const current = getOwnerUserSync();
    setUser(current);
    setLoading(!current);
    return unsubscribe;
  }, []);

  return { user, loading, signOut: async () => undefined };
}
