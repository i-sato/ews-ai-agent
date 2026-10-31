import { expect, test } from "@playwright/test";

test("health endpoint merespons", { tag: ["@smoke"] }, async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBe(true);
  expect(await res.json()).toEqual({ status: "ok" });
});

test("halaman dashboard tampil dengan header keamanan", { tag: ["@smoke"] }, async ({ page }) => {
  const res = await page.goto("/dashboard");
  expect(res?.headers()["x-content-type-options"]).toBe("nosniff");
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
});
