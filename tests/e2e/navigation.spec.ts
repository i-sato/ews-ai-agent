import { expect, test } from "@playwright/test";

const MENU = [
  ["Dashboard", "/dashboard"],
  ["Pelatihan", "/trainings"],
  ["Peserta", "/participants"],
  ["Pemantauan Risiko", "/risk-monitoring"],
  ["Indikator PK", "/pk-indicators"],
  ["Laporan", "/reports"],
  ["Pengaturan", "/settings"],
] as const;

test.describe("navigasi web", () => {
  test.skip(({ isMobile }) => isMobile, "khusus layar lebar");

  test("sidebar berisi tujuh menu sesuai desain", { tag: ["@smoke"] }, async ({ page }) => {
    await page.goto("/dashboard");
    const nav = page.getByRole("navigation", { name: "Menu utama" });
    await expect(nav.getByRole("link")).toHaveText(MENU.map(([label]) => label));
  });

  test("setiap menu membuka halamannya", { tag: ["@smoke"] }, async ({ page }) => {
    await page.goto("/dashboard");
    const nav = page.getByRole("navigation", { name: "Menu utama" });
    for (const [label, href] of MENU) {
      await nav.getByRole("link", { name: label, exact: true }).click();
      await expect(page).toHaveURL(href);
      await expect(page.getByRole("heading", { level: 1, name: label })).toBeVisible();
      await expect(page.getByRole("status")).toHaveText("Belum diimplementasi");
      await expect(nav.locator('[aria-current="page"]')).toHaveText(label);
    }
  });

  test("layar Lainnya dialihkan ke dashboard", { tag: ["@smoke"] }, async ({ page }) => {
    await page.goto("/more");
    await expect(page).toHaveURL("/dashboard");
  });
});

test.describe("navigasi mobile", () => {
  test.skip(({ isMobile }) => !isMobile, "khusus layar sempit");

  test("tab bawah berisi lima item", { tag: ["@smoke"] }, async ({ page }) => {
    await page.goto("/dashboard");
    const tabs = page.getByRole("navigation", { name: "Menu utama" });
    await expect(tabs.getByRole("link")).toHaveText([
      "Dashboard",
      "Pelatihan",
      "Risiko",
      "Laporan",
      "Lainnya",
    ]);
    await expect(tabs.locator('[aria-current="page"]')).toHaveText("Dashboard");
  });

  test("layar Lainnya membuka menu sisanya", { tag: ["@smoke"] }, async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("link", { name: "Lainnya" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Lainnya" })).toBeVisible();
    const more = page.getByRole("navigation", { name: "Menu lainnya" });
    await more.getByRole("link", { name: /Peserta/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Peserta" })).toBeVisible();
    const tabs = page.getByRole("navigation", { name: "Menu utama" });
    await expect(tabs.locator('[aria-current="page"]')).toHaveText("Lainnya");
  });

  test("target sentuh tab minimal 44px", { tag: ["@smoke"] }, async ({ page }) => {
    await page.goto("/dashboard");
    const links = page.getByRole("navigation", { name: "Menu utama" }).getByRole("link");
    for (const box of await links.evaluateAll((els) => els.map((e) => e.getBoundingClientRect())))
      expect(box.height).toBeGreaterThanOrEqual(44);
  });
});

test("halaman awal dialihkan ke dashboard", { tag: ["@smoke"] }, async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL("/dashboard");
});
