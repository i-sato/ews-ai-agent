// Spesifikasi §11.3: halaman pernyataan kepatuhan dan tautannya di bagian bawah setiap halaman.
import { expect, test } from "@playwright/test";

const PAGES = ["/dashboard", "/trainings", "/reports"];

test.describe("tanpa sesi", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("halaman kepatuhan dapat dibuka tanpa login", { tag: ["@smoke"] }, async ({ page }) => {
    await page.goto("/compliance");
    await expect(page).toHaveURL("/compliance");
    await expect(
      page.getByRole("heading", { level: 1, name: "Pernyataan kepatuhan" }),
    ).toBeVisible();
    await expect(page.getByText(/^Versi \d+\.\d+ · berlaku \d{1,2} \w+ \d{4}$/)).toBeVisible();
    await expect(page.getByText(/Draf: teks ini menunggu tinjauan/)).toBeVisible();
    await expect(page.getByText(/UU No\. 27 Tahun 2022/)).toBeVisible();
  });
});

test.describe("web", () => {
  test.skip(({ isMobile }) => isMobile, "khusus layar lebar");

  test(
    "tautan kepatuhan di bawah sidebar setiap halaman",
    { tag: ["@smoke"] },
    async ({ page }) => {
      for (const path of PAGES) {
        await page.goto(path);
        await expect(page.getByRole("link", { name: "Pernyataan kepatuhan" })).toBeVisible();
      }
      await page.getByRole("link", { name: "Pernyataan kepatuhan" }).click();
      await expect(page).toHaveURL("/compliance");
    },
  );
});

test.describe("mobile", () => {
  test.skip(({ isMobile }) => !isMobile, "khusus layar sempit");

  test("tautan kepatuhan di akhir konten setiap halaman", { tag: ["@smoke"] }, async ({ page }) => {
    for (const path of [...PAGES, "/more"]) {
      await page.goto(path);
      const link = page.getByRole("link", { name: "Pernyataan kepatuhan" });
      await link.scrollIntoViewIfNeeded();
      await expect(link).toBeVisible();
      expect((await link.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
  });
});
