import { defineConfig, devices } from "@playwright/test";

// Tes diberi tag fitur (mis. @laporan) yang terdaftar di tests/e2e/scope-map.json.
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["html", { open: "never" }], ["github"]] : "list",
  // Akun uji sintetis dan sesi login di Supabase lokal (tests/e2e/global-setup.ts).
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    storageState: "playwright/.auth/pengelola.json",
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    locale: "id-ID",
    timezoneId: "Asia/Jakarta",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  // CI memakai build produksi agar CSP produksi (tanpa unsafe-*) ikut diuji (SH-HDR-01).
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: process.env.CI ? "pnpm build && pnpm start" : "pnpm dev",
        url: "http://localhost:3000/api/health",
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
