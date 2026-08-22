// Centralized, user-facing error mapping for authenticated server functions.
// Server-side middleware throws technical messages (e.g. "Unauthorized: Invalid
// token"); we never show those to users. Import this wherever a serverFn or
// Supabase call can fail so every feature surfaces a useful, consistent message.

export function mapAuthError(e: unknown): string {
  const msg = e instanceof Error ? e.message : "Something went wrong.";
  const m = msg.toLowerCase();

  if (
    /unauthorized|invalid token|no (authorization|token|user)|session expired|not signed in/i.test(
      m,
    )
  ) {
    return "Your session expired. Please sign in again.";
  }
  if (/not configured|ai service|lovable_api_key/i.test(m)) {
    return "The AI service isn't available right now. Please try again later.";
  }
  if (/network|fetch failed|timeout|econn/i.test(m)) {
    return "Network error. Check your connection and try again.";
  }
  return msg;
}
