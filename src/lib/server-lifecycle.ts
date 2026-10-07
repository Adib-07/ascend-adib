// Guards the private Node/Nitro server against a silent start-then-exit.
//
// srvx's `NodeServer` constructor does `this.serve().catch(() => {})`, so a
// failed `server.listen()` (EADDRINUSE, unusable NITRO_HOST/HOST, ...) is
// swallowed: nothing is printed, nothing keeps the event loop alive, and
// `node .output/server/index.mjs` exits 0 straight back to the shell with no
// socket bound. The terminal just returns to the prompt and the browser cannot
// reach :3000. This turns that silent exit into a loud, non-zero failure.
//
// It only observes the already-created http.Server; it never listens, closes,
// or reconfigures it, and it never runs again once the server is confirmed up.
// Routing, auth, RLS, the owner session and Supabase are untouched.

import { Server } from "node:net";
import { definePlugin } from "nitro";

const STARTUP_CHECK_MS = 1500;

function resolvePort(): number {
  const parsed = Number.parseInt(process.env.NITRO_PORT ?? process.env.PORT ?? "", 10);
  return Number.isNaN(parsed) ? 3000 : parsed;
}

// `process.getActiveResourcesInfo()` is not usable here: `http.createServer()`
// registers a TCPServerWrap *before* listen() is attempted, and that entry
// survives a failed bind. Only the handle's own `listening` flag tells us
// whether the socket was really acquired.
function hasListeningServer(): boolean {
  const { _getActiveHandles } = process as unknown as { _getActiveHandles(): unknown[] };
  return _getActiveHandles().some((handle) => handle instanceof Server && handle.listening);
}

export default definePlugin(() => {
  const port = resolvePort();

  // Deliberately not unref()'d: when the bind fails this timer is the only
  // handle left on the loop, so it is what keeps the process alive long enough
  // to report the failure instead of vanishing.
  setTimeout(() => {
    if (hasListeningServer()) return;

    console.error(
      [
        "",
        "[ascend] FATAL: the Ascend Node server did not bind a listening socket and is exiting.",
        "[ascend] Cause: server.listen() failed and srvx swallows that error, so this",
        `[ascend] process would otherwise exit 0 silently with nothing serving port ${port}.`,
        "[ascend] Most often another process already holds that port (a previous",
        "[ascend] `npm start`, `npm run dev`, or `npx vite preview`). Find it with:",
        `[ascend]   lsof -nP -iTCP:${port} -sTCP:LISTEN`,
        `[ascend] Or start Ascend on a free port:  PORT=3001 npm start`,
        "",
      ].join("\n"),
    );

    process.exit(1);
  }, STARTUP_CHECK_MS);
});
