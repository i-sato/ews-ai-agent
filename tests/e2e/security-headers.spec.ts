// SH-HDR-01..05: header keamanan pada halaman, redirect, dan API; CSRF Server Action.
import { type Page, expect, test } from "@playwright/test";
import { TEST_PASSWORD, TEST_USERS } from "../support/local-supabase";

const nonceOf = (csp: string) => /'nonce-([^']+)'/.exec(csp)?.[1];

function collectCspViolations(page: Page) {
  const violations: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && /Content Security Policy/i.test(m.text()))
      violations.push(m.text());
  });
  return violations;
}

test("CSP bernonce baru setiap request", { tag: ["@smoke"] }, async ({ request }) => {
  const first = (await request.get("/dashboard")).headers()["content-security-policy"] ?? "";
  const second = (await request.get("/dashboard")).headers()["content-security-policy"] ?? "";
  expect(first).toContain("frame-ancestors 'none'");
  expect(first).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
  expect(first).not.toMatch(/script-src[^;]*unsafe-inline/);
  expect(nonceOf(first)).toBeTruthy();
  expect(nonceOf(first)).not.toBe(nonceOf(second));
});

// Setiap <script> dari server membawa nonce header; skrip yang dimuat setelahnya diizinkan oleh
// 'strict-dynamic' (mis. klien HMR di dev), jadi yang diperiksa adalah HTML mentah.
test("skrip dari server memakai nonce dari header", { tag: ["@smoke"] }, async ({ request }) => {
  const res = await request.get("/dashboard");
  const nonce = nonceOf(res.headers()["content-security-policy"] ?? "");
  const tags = (await res.text()).match(/<script\b[^>]*>/gi) ?? [];
  expect(tags.length).toBeGreaterThan(0);
  for (const tag of tags) expect(tag).toContain(`nonce="${nonce}"`);
});

// Pelanggaran hanya terlihat pada build produksi (dev mengizinkan style inline untuk alat Next.js).
test("tanpa pelanggaran CSP di halaman utama", { tag: ["@smoke"] }, async ({ page }) => {
  const violations = collectCspViolations(page);
  for (const path of ["/dashboard", "/trainings", "/compliance", "/halaman-tidak-ada"])
    await page.goto(path);
  await expect(page.getByRole("heading", { name: "Halaman tidak ditemukan" })).toBeVisible();
  expect(violations).toEqual([]);
});

test.describe("tanpa sesi", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("login tanpa pelanggaran CSP", { tag: ["@login"] }, async ({ page }) => {
    const violations = collectCspViolations(page);
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "Masuk" })).toBeEnabled();
    expect(violations).toEqual([]);
  });

  test("redirect ke login juga membawa CSP", { tag: ["@smoke"] }, async ({ request }) => {
    const res = await request.get("/dashboard", { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    expect(res.headers()["content-security-policy"]).toContain("default-src 'self'");
  });
});

test("header keamanan lain (SH-HDR-02, -03)", { tag: ["@smoke"] }, async ({ request }) => {
  const headers = (await request.get("/dashboard")).headers();
  expect(headers["strict-transport-security"]).toBe("max-age=31536000; includeSubDomains");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["permissions-policy"]).toContain("camera=()");
  expect(headers["x-powered-by"]).toBeUndefined();
});

test("CORS: origin asing tidak diizinkan (SH-HDR-04)", { tag: ["@smoke"] }, async ({ request }) => {
  const res = await request.get("/api/health", { headers: { Origin: "https://contoh.invalid" } });
  expect(res.headers()["access-control-allow-origin"]).toBeUndefined();
  expect(res.headers()["access-control-allow-credentials"]).toBeUndefined();
  const preflight = await request.fetch("/api/health", {
    method: "OPTIONS",
    headers: { Origin: "https://contoh.invalid", "Access-Control-Request-Method": "POST" },
  });
  expect(preflight.headers()["access-control-allow-origin"]).toBeUndefined();
});

test.describe("CSRF Server Action (SH-HDR-05)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("logout dari origin asing ditolak", { tag: ["@login"] }, async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(TEST_USERS.trainingManager.email);
    await page.getByLabel("Kata sandi").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Masuk" }).click();
    await expect(page).toHaveURL("/dashboard");

    const html = await (await page.request.get("/dashboard")).text();
    const actionId = /name="\$ACTION_ID_([0-9a-f]+)"/.exec(html)?.[1];
    expect(actionId).toBeTruthy();
    const forged = await page.request.post("/dashboard", {
      multipart: { [`$ACTION_ID_${actionId}`]: "" },
      headers: { Origin: "https://contoh.invalid" },
      maxRedirects: 0,
    });
    expect(forged.status()).toBeGreaterThanOrEqual(400);

    await page.goto("/dashboard");
    await expect(page).toHaveURL("/dashboard");
  });
});
