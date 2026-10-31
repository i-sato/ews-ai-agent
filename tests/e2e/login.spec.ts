import { type Page, expect, test } from "@playwright/test";
import { TEST_PASSWORD, TEST_USERS } from "../support/local-supabase";

test.use({ storageState: { cookies: [], origins: [] } });

const user = TEST_USERS.trainingManager;

async function signIn(page: Page, password = TEST_PASSWORD) {
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Kata sandi").fill(password);
  await page.getByRole("button", { name: "Masuk" }).click();
}

test("halaman login sesuai desain tanpa tautan daftar", { tag: ["@login"] }, async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Masuk" })).toBeVisible();
  await expect(page.getByText("Akses diberikan oleh Admin sesuai role.")).toBeVisible();
  await expect(page.getByRole("link", { name: /daftar/i })).toHaveCount(0);
  await expect(page.getByText(/UU No\. 27 Tahun 2022/).first()).toBeAttached();
});

test("pernyataan kepatuhan §11.3 terbaca", { tag: ["@login"] }, async ({ page, isMobile }) => {
  await page.goto("/login");
  if (isMobile) await page.getByText("Pernyataan kepatuhan").locator("visible=true").click();
  await expect(
    page
      .getByText(/tidak dikirim ke penyedia AI dalam bentuk yang mengidentifikasi peserta/)
      .locator("visible=true"),
  ).toBeVisible();
});

test("kredensial salah mendapat pesan generik", { tag: ["@login"] }, async ({ page }) => {
  await page.goto("/login");
  await signIn(page, "Salah-Sandi-2026");
  // Dibatasi ke form: Next.js juga memiliki elemen role="alert" (route announcer).
  const form = page.locator("form").filter({ has: page.getByLabel("Email") });
  await expect(form.getByRole("alert")).toHaveText("Email atau kata sandi salah.");
  await expect(page).toHaveURL(/\/login/);
});

test(
  "halaman terlindungi dialihkan ke login lalu kembali",
  { tag: ["@login"] },
  async ({ page }) => {
    await page.goto("/reports?year=2026");
    await expect(page).toHaveURL("/login?next=%2Freports%3Fyear%3D2026");
    await signIn(page);
    await expect(page).toHaveURL("/reports?year=2026");
  },
);

test("parameter next eksternal diabaikan", { tag: ["@login"] }, async ({ page }) => {
  await page.goto("/login?next=https://contoh.invalid/phish");
  await signIn(page);
  await expect(page).toHaveURL("/dashboard");
});

test("cookie sesi HttpOnly dan SameSite=Lax", { tag: ["@login"] }, async ({ page, context }) => {
  await page.goto("/login");
  await signIn(page);
  await expect(page).toHaveURL("/dashboard");
  const session = (await context.cookies()).filter((c) => c.name.startsWith("sb-"));
  expect(session.length).toBeGreaterThan(0);
  for (const c of session) {
    expect(c.httpOnly).toBe(true);
    expect(c.sameSite).toBe("Lax");
  }
  const fromScript = await page.evaluate(() => document.cookie);
  expect(fromScript).not.toContain("sb-");
});

test("logout mencabut sesi", { tag: ["@login"] }, async ({ page, context, isMobile }) => {
  await page.goto("/login");
  await signIn(page);
  await expect(page).toHaveURL("/dashboard");
  const stolen = await context.cookies();

  if (isMobile) await page.goto("/more");
  await page.getByRole("button", { name: "Keluar" }).click();
  await expect(page).toHaveURL("/login");

  await context.addCookies(stolen);
  await page.goto("/dashboard");
  await expect(page).toHaveURL("/login");
});
