// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Runs at startup in the built Node server. srvx swallows a failed
// server.listen(), which makes `npm start` exit 0 silently with nothing
// listening; this turns that into a loud, non-zero failure. `plugins` is a
// valid Nitro option that this wrapper's (deliberately narrow) type omits, so it
// is spread from a variable rather than added to the object literal.
const nitroLifecycle = {
  plugins: ["./src/lib/server-lifecycle.ts"],
};

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  nitro: {
    // Default keeps the existing Vercel build (used for preview/dev only).
    // `npm run build:private` sets ASCEND_NITRO_PRESET=node-server so the private
    // host gets a standalone Node server in .output/server.
    preset: process.env.ASCEND_NITRO_PRESET === "node-server" ? "node-server" : "vercel",
    ...nitroLifecycle,
  },
});
