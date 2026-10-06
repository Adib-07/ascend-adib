# Ascend — private single-owner deployment

Ascend is a personal OS / second brain for a single owner. It runs on a private
host reachable only over Tailscale. There is no login page: the app
establishes the owner's Supabase session automatically using a server-only
refresh token.

---

## 1. Architecture

```
Internet
   X   (no public production URL)
   |
Tailscale (network boundary)
   |
private host  ── runs the Ascend Node server
   |
   ├─ POST owner-session RPC  ──> exchanges server-only refresh token
   |                              for a short-lived access token
   |                              (browser never sees the refresh token)
   |
   └─ browser ── Authorization: Bearer <access token> ──> Supabase
                                                          │
                                                  RLS: auth.uid()
                                                          │
                                                  owner data
```

Two independent layers protect the data:

1. **Network** — the app is only reachable on your tailnet.
2. **Application** — every request still needs a valid Supabase JWT, and every
   RLS policy is still `auth.uid() = user_id`. Removing the login screen did
   **not** weaken any policy.

Supabase remains the authoritative data store. The private host is only the
application runtime; losing it does not lose data.

## 2. What was removed

- The `/auth` route (login + signup UI) and the `_authenticated` route guard.
- Browser-side session persistence (`persistSession`/`autoRefreshToken` off),
  so no refresh token is ever written to `localStorage`.

## 3. What was preserved

- All RLS policies and storage policies (unchanged).
- `requireSupabaseAuth` on all ~50 protected server functions (unchanged).
- The existing owner `auth.users` UUID and every `user_id` relationship.
- The `auth-attacher` middleware that attaches the bearer token to serverFn RPCs.

## 4. Private host setup

### Requirements

- Node 20+
- A Tailscale node on the host (so the host itself is tailnet-only)

### Install

```bash
git clone <your-repo> ascend-adib && cd ascend-adib
npm ci
```

### Configure

```bash
cp .env.example .env
$EDITOR .env
```

Required in `.env`:

| Variable | Scope | Notes |
|---|---|---|
| `SUPABASE_URL` | server | same project as `VITE_SUPABASE_URL` |
| `SUPABASE_PUBLISHABLE_KEY` | server | anon/publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | server | **server only**, never `VITE_` |
| `VITE_SUPABASE_URL` | build | must equal `SUPABASE_URL` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | build | must equal `SUPABASE_PUBLISHABLE_KEY` |
| `OWNER_REFRESH_TOKEN` | server | long-lived refresh token for the owner |
| `OWNER_USER_ID` | server | recommended; pins the owner UUID |
| `LOVABLE_API_KEY` | server | AI features |
| `KAGGLE_USERNAME` / `KAGGLE_KEY` | server | dataset ingestion |

### Build and run

```bash
npm run build:private     # node-server preset -> .output/
npm start                 # node .output/server/index.mjs
```

Serves on `http://localhost:3000` by default. Set `PORT` / `HOST` to change.

### Get `OWNER_REFRESH_TOKEN`

Sign in to Supabase with the owner account once (any client), then from the
Supabase dashboard or a local Supabase CLI session read the session's
`refresh_token`. Treat it like a password: server-only, never committed, never
shared. Alternatively:

```bash
curl -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $SUPABASE_PUBLISHABLE_KEY" -H 'content-type: application/json' \
  -d '{"email":"OWNER_EMAIL","password":"OWNER_PASSWORD"}' | jq -r .refresh_token
```

Do not paste the result into a tracked file. Put it in `.env` on the host or in
your process manager's secret store.

## 5. Refresh-token rotation

Supabase rotates refresh tokens. `owner-session.server.ts`:

1. reads the current token from `OWNER_REFRESH_TOKEN_FILE`, falling back to
   `OWNER_REFRESH_TOKEN`;
2. exchanges it for a session;
3. writes the rotated token back to that file with mode `0600`.

Back up `OWNER_REFRESH_TOKEN_FILE` alongside your database backups. If the
private host's disk is wiped, set `OWNER_REFRESH_TOKEN` again.

## 6. Sessions in the browser

The browser keeps only a short-lived access token **in memory**. On a 401 the
client re-requests the owner session automatically. A page refresh or browser
restart triggers one extra HTTP call and then works normally. There is no
"remember me" flow and nothing to clear.

## 7. Health checks

```bash
curl -fsS http://127.0.0.1:3000/app -o /dev/null -w '%{http_code}\n'   # expect 200
```

A `200` on `/app` means the server is up. Owner-session health additionally
depends on Supabase; check the host logs for `OWNER_SESSION_` codes.

## 8. Failure modes

| Situation | Behaviour |
|---|---|
| Host offline | No access at all. Fails closed. |
| Tailscale down | No access. The public app does not exist. |
| Supabase unreachable | UI shows "Ascend is temporarily unable to connect to its data service." No data served. |
| `OWNER_REFRESH_TOKEN` missing/rejected | UI shows "Ascend could not establish the private owner session." Fails closed. |
| Access token expired | Client transparently re-requests the owner session. |
| Token in `OWNER_USER_ID` mismatch | Refused with `OWNER_SESSION_owner_mismatch`. |

## 9. Revoking access

- **Revoke the owner session:** in Supabase → Authentication → Users → owner →
  sign out / revoke sessions. Ascend will then fail closed until
  `OWNER_REFRESH_TOKEN` is replaced with a fresh one.
- **Revoke the network boundary:** stop or remove the Tailscale node on the host.
- **Full stop:** shut down the host process.

## 10. Vercel

Vercel is retained for preview/dev builds only and is **not** the production
data path. Retiring the public production deployment requires dashboard
actions — see the manual checklist in the migration report. Vercel Standard
Protection covers preview deployments only, so if a production deployment is
left in place it is publicly reachable and must not be treated as production.

## 11. Backups

- Supabase: the authoritative store — use Supabase's own backups/pg_dump.
- `OWNER_REFRESH_TOKEN_FILE`: small, but losing it requires re-issuing the
  token.
- `.output/`: rebuildable from source; no backup needed.
