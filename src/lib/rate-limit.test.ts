import { describe, expect, it } from "bun:test";
import { credentialBucketKey, resolveRateLimitKey } from "./rate-limit";

// Realistic-looking JWTs that share the constant HS256 header segment — the
// exact collision the old `authHeader.slice(0, 32)` key produced.
const TOKEN_A =
  "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLWEiLCJlbWFpbCI6ImFAdGVzdC5pbyJ9.sigA";
const TOKEN_B =
  "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLWIiLCJlbWFpbCI6ImJAdGVzdC5pbyJ9.sigB";

describe("credentialBucketKey", () => {
  it("produces different keys for different tokens", async () => {
    const keyA = await credentialBucketKey(TOKEN_A);
    const keyB = await credentialBucketKey(TOKEN_B);
    expect(keyA).not.toBe(keyB);
  });

  it("produces different keys even for tokens sharing the same JWT header segment", async () => {
    // Both tokens share the first 32 characters — the old key would have
    // collided here.
    expect(TOKEN_A.slice(0, 32)).toBe(TOKEN_B.slice(0, 32));
    const keyA = await credentialBucketKey(TOKEN_A);
    const keyB = await credentialBucketKey(TOKEN_B);
    expect(keyA).not.toBe(keyB);
  });

  it("produces a stable key for the same token", async () => {
    const keyA1 = await credentialBucketKey(TOKEN_A);
    const keyA2 = await credentialBucketKey(TOKEN_A);
    expect(keyA1).toBe(keyA2);
  });

  it("never exposes the raw token in the key", async () => {
    const key = await credentialBucketKey(TOKEN_A);
    expect(key).not.toContain(TOKEN_A);
    expect(key).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
    expect(key).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe("resolveRateLimitKey", () => {
  it("keys authenticated requests on the hashed credential", async () => {
    const key = await resolveRateLimitKey(TOKEN_A, "1.2.3.4");
    expect(key).toBe(`user:${await credentialBucketKey(TOKEN_A)}`);
  });

  it("keeps the IP fallback for requests without an Authorization header", async () => {
    const key = await resolveRateLimitKey(null, "1.2.3.4");
    expect(key).toBe("ip:1.2.3.4");
  });

  it("keeps the IP fallback for an empty Authorization header", async () => {
    const key = await resolveRateLimitKey("", "5.6.7.8");
    expect(key).toBe("ip:5.6.7.8");
  });

  it("isolates buckets across users", async () => {
    const keyA = await resolveRateLimitKey(TOKEN_A, "1.2.3.4");
    const keyB = await resolveRateLimitKey(TOKEN_B, "1.2.3.4");
    expect(keyA).not.toBe(keyB);
  });
});
