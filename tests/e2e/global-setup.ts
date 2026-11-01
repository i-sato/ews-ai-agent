// Menyiapkan akun uji sintetis di Supabase lokal dan menyimpan sesi login per role.
import { type FullConfig, chromium } from "@playwright/test";
import {
  TEST_PASSWORD,
  TEST_USERS,
  type TestUser,
  ensureTestUser,
} from "../support/local-supabase";

export const AUTH_STATES = {
  trainingManager: "playwright/.auth/pengelola.json",
  admin: "playwright/.auth/admin.json",
  viewer: "playwright/.auth/viewer.json",
  gtaManager: "playwright/.auth/pengelola-gta.json",
} as const;

async function saveSession(baseURL: string, user: TestUser, path: string) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ baseURL });
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Kata sandi").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL("**/dashboard");
  await page.context().storageState({ path });
  await browser.close();
}

export default async function globalSetup(config: FullConfig) {
  for (const user of Object.values(TEST_USERS)) await ensureTestUser(user);
  const baseURL = config.projects[0]?.use.baseURL ?? "http://localhost:3000";
  for (const [key, path] of Object.entries(AUTH_STATES)) {
    await saveSession(baseURL, TEST_USERS[key as keyof typeof AUTH_STATES], path);
  }
}
