// Menyiapkan akun uji sintetis di Supabase lokal dan menyimpan sesi login untuk tes @smoke.
import { type FullConfig, chromium } from "@playwright/test";
import { TEST_PASSWORD, TEST_USERS, ensureTestUser } from "../support/local-supabase";

export const AUTH_STATE = "playwright/.auth/pengelola.json";

export default async function globalSetup(config: FullConfig) {
  for (const user of Object.values(TEST_USERS)) await ensureTestUser(user);

  const baseURL = config.projects[0]?.use.baseURL ?? "http://localhost:3000";
  const browser = await chromium.launch();
  const page = await browser.newPage({ baseURL });
  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_USERS.trainingManager.email);
  await page.getByLabel("Kata sandi").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL("**/dashboard");
  await page.context().storageState({ path: AUTH_STATE });
  await browser.close();
}
