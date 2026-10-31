// SH-AUTHZ-01: role dari server menentukan menu dan akses halaman Pengaturan.
import { expect, test } from "@playwright/test";
import { TEST_PASSWORD, TEST_USERS } from "../support/local-supabase";
import { AUTH_STATES } from "./global-setup";

test.describe("pengelola pelatihan", () => {
  test.use({ storageState: AUTH_STATES.trainingManager });

  test("menu Pengaturan tidak tampil", { tag: ["@smoke"] }, async ({ page, isMobile }) => {
    await page.goto(isMobile ? "/more" : "/dashboard");
    const name = isMobile ? "Menu lainnya" : "Menu utama";
    const nav = page.getByRole("navigation", { name });
    await expect(nav.getByRole("link", { name: /Peserta/ })).toBeVisible();
    await expect(nav.getByRole("link", { name: /Pengaturan/ })).toHaveCount(0);
  });
});

test.describe("viewer", () => {
  test.use({ storageState: AUTH_STATES.viewer });

  test("membuka Pengaturan langsung ditolak", { tag: ["@pengaturan"] }, async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { level: 1, name: "Akses ditolak" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pengaturan" })).toHaveCount(0);
  });
});

test.describe("admin", () => {
  test.use({ storageState: AUTH_STATES.admin });

  test("dapat membuka Pengaturan", { tag: ["@pengaturan"] }, async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { level: 1, name: "Pengaturan" })).toBeVisible();
  });
});

test.describe("akun nonaktif", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("tidak dapat masuk", { tag: ["@login"] }, async ({ page, context }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(TEST_USERS.inactive.email);
    await page.getByLabel("Kata sandi").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Masuk" }).click();
    const form = page.locator("form").filter({ has: page.getByLabel("Email") });
    await expect(form.getByRole("alert")).toHaveText(
      "Akun Anda belum aktif atau belum memiliki role. Hubungi Admin.",
    );
    const session = (await context.cookies()).filter((c) => c.name.startsWith("sb-"));
    expect(session).toHaveLength(0);
  });
});
