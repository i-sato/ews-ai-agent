import { expect, test } from "@playwright/test";

test("health endpoint merespons", { tag: ["@smoke"] }, async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBe(true);
  expect(await res.json()).toEqual({ status: "ok" });
});

test("halaman awal tampil dengan header keamanan", { tag: ["@smoke"] }, async ({ page }) => {
  const res = await page.goto("/");
  expect(res?.headers()["x-content-type-options"]).toBe("nosniff");
  await expect(page.getByRole("heading", { name: "EWS AI Agent" })).toBeVisible();
});
