import * as React from "react";
import {
  subscribeOwnerSession,
  ensureOwnerSession,
  getOwnerUserSync,
  type OwnerUser,
} from "@/lib/owner-session";

// Retained because `components/layout/*` imports it. Single-owner semantics:
// there is no sign-out (the owner session is the app), and `loading` reflects
// whether the private owner session has been established.
export function useAuth() {
  const [user, setUser] = React.useState<OwnerUser | null>(getOwnerUserSync());
  const [loading, setLoading] = React.useState(!getOwnerUserSync());

  React.useEffect(() => {
    const unsubscribe = subscribeOwnerSession(() => {
      setUser(getOwnerUserSync());
      setLoading(!getOwnerUserSync());
    });
    ensureOwnerSession()
      .then(() => undefined)
      .catch(() => undefined)
      .finally(() => setLoading(false));
    return unsubscribe;
  }, []);

  return { user, loading, signOut: async () => undefined };
}
