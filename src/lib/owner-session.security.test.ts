import { describe, expect, it } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Repository `src/` root (this test file lives in src/lib/).
const SRC = fileURLToPath(new URL("../../src/", import.meta.url));

async function collect(dir: string, out: string[] = []): Promise<string[]> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      await collect(path, out);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      out.push(path);
    }
  }
  return out;
}

describe("owner session credential separation", () => {
  it("never reads the owner refresh token from a client module", async () => {
    const files = await collect(SRC);
    const clientModules = files.filter(
      (f) =>
        !f.endsWith("owner-session.server.ts") &&
        !f.endsWith("client.server.ts") &&
        !f.endsWith("auth-middleware.ts"),
    );

    const offenders: string[] = [];
    for (const file of clientModules) {
      const source = await readFile(file, "utf8");
      if (/process\.env\.OWNER_REFRESH_TOKEN|import\.meta\.env\.[A-Z_]*OWNER/.test(source)) {
        offenders.push(file);
      }
    }

    expect(offenders).toEqual([]);
  });

  it("never exposes the refresh token to the browser owner-session store", async () => {
    const source = await readFile(join(SRC, "lib/owner-session.ts"), "utf8");

    // The browser store may hold an access token. It must never name a refresh
    // token as something it stores or returns.
    expect(source).not.toMatch(/refresh_token\s*[:=]/);
    expect(source).not.toContain("refreshSession(");
    expect(source).not.toContain("OWNER_REFRESH_TOKEN");
  });

  it("keeps the service-role key out of every VITE_ variable", async () => {
    const files = await collect(SRC);
    const offenders: string[] = [];
    for (const file of files) {
      const source = await readFile(file, "utf8");
      // Any VITE_-prefixed variable referencing a privileged credential.
      if (/VITE_[A-Z0-9_]*(SERVICE_ROLE|SECRET)[A-Z0-9_]*/.test(source)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("keeps browser session persistence disabled so no token lands in localStorage", async () => {
    const source = await readFile(join(SRC, "integrations/supabase/client.ts"), "utf8");
    expect(source).toContain("persistSession: false");
    expect(source).toContain("autoRefreshToken: false");
    expect(source).not.toContain("localStorage");
  });

  it("still attaches a bearer token to server functions", async () => {
    const source = await readFile(join(SRC, "integrations/supabase/auth-attacher.ts"), "utf8");
    expect(source).toContain("Authorization: `Bearer ${token}`");
  });

  it("still requires supabase auth on the server middleware", async () => {
    const source = await readFile(join(SRC, "integrations/supabase/auth-middleware.ts"), "utf8");
    expect(source).toContain("requireSupabaseAuth");
    expect(source).toContain("supabase.auth.getUser(token)");
  });

  it("no longer ships a login route or an email/password call", async () => {
    const routes = await collect(join(SRC, "routes"));
    for (const file of routes) {
      const source = await readFile(file, "utf8");
      expect(source).not.toContain("signInWithPassword");
      expect(source).not.toContain("signUp(");
      expect(source).not.toContain("resetPasswordForEmail");
    }
  });
});
