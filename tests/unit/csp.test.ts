import { describe, expect, it } from "vitest";
import { buildCsp, createNonce } from "@/lib/security/csp";

function directives(csp: string) {
  return Object.fromEntries(
    csp.split("; ").map((d) => {
      const [name = "", ...values] = d.split(" ");
      return [name, values.join(" ")];
    }),
  );
}

describe("createNonce", () => {
  it("128 bit base64 dan berbeda setiap panggilan", () => {
    const nonces = new Set(Array.from({ length: 50 }, createNonce));
    expect(nonces.size).toBe(50);
    for (const n of nonces) expect(n).toMatch(/^[A-Za-z0-9+/]{22}==$/);
  });
});

describe("buildCsp produksi (SH-HDR-01)", () => {
  const csp = directives(buildCsp({ nonce: "abc", dev: false }));

  it("skrip hanya dari nonce, tanpa unsafe-inline atau unsafe-eval", () => {
    expect(csp["script-src"]).toBe("'self' 'nonce-abc' 'strict-dynamic'");
    expect(csp["style-src"]).toBe("'self' 'nonce-abc'");
  });

  it("memuat direktif wajib", () => {
    expect(csp).toMatchObject({
      "default-src": "'self'",
      "object-src": "'none'",
      "base-uri": "'self'",
      "form-action": "'self'",
      "frame-ancestors": "'none'",
      "connect-src": "'self'",
    });
    expect(csp).toHaveProperty("upgrade-insecure-requests");
  });

  it("tidak ada unsafe-* di mana pun", () => {
    expect(buildCsp({ nonce: "abc", dev: false })).not.toContain("unsafe");
  });
});

describe("buildCsp dev", () => {
  const csp = directives(buildCsp({ nonce: "abc", dev: true }));

  it("unsafe-eval dan style inline hanya untuk alat dev Next.js", () => {
    expect(csp["script-src"]).toBe("'self' 'nonce-abc' 'strict-dynamic' 'unsafe-eval'");
    expect(csp["style-src"]).toBe("'self' 'unsafe-inline'");
    expect(csp["script-src"]).not.toContain("unsafe-inline");
  });

  it("tanpa upgrade-insecure-requests di localhost", () => {
    expect(csp).not.toHaveProperty("upgrade-insecure-requests");
  });
});
