// F2-09a: daftar dan detail pelatihan (Web-Pelatihan, Web-PelatihanDetail, M-*). Data sintetis
// golden-1.csv. Matriks peserta hanya untuk role berwenang (§8.6); tim lain mendapat 404 (RLS).
import { readFileSync } from "node:fs";
import { type Browser, expect, test } from "@playwright/test";
import { SHEETS_DIR } from "../fixtures/golden/golden-sheets";
import {
  TEST_USERS,
  adminClient,
  createCsvTraining,
  existingUserId,
  localSupabaseEnv,
} from "../support/local-supabase";
import { AUTH_STATES } from "./global-setup";

const csv = readFileSync(`${SHEETS_DIR}golden-1.csv`);
type Seeded = { id: string; code: string };
let dta: Seeded;
let gta: Seeded;

async function seed(browser: Browser, team: string, state: string, adminId: string) {
  const { trainingId, sourceId } = await createCsvTraining(team, adminId);
  const context = await browser.newContext({ storageState: state });
  const api = context.request;
  const file = { name: "peserta.csv", mimeType: "text/csv", buffer: csv };
  const preview = await api.post("/api/v1/imports/preview", { multipart: { sourceId, file } });
  expect(preview.status()).toBe(200);
  const { batchId } = await preview.json();
  const data = { batchId, idempotencyKey: `e2e-${batchId}` };
  expect((await api.post("/api/v1/imports/commit", { data })).status()).toBe(200);
  await context.close();
  const row = await adminClient().from("trainings").select("code").eq("id", trainingId).single();
  return { id: trainingId, code: String(row.data?.code) };
}

test.beforeAll(async ({ browser }) => {
  localSupabaseEnv();
  const adminId = await existingUserId(TEST_USERS.admin);
  dta = await seed(browser, "DTA", AUTH_STATES.trainingManager, adminId);
  gta = await seed(browser, "GTA", AUTH_STATES.gtaManager, adminId);
});

test.describe("pengelola tim DTA", () => {
  test.use({ storageState: AUTH_STATES.trainingManager });

  test("daftar memuat pelatihan tim sendiri", { tag: ["@pelatihan"] }, async ({ page }) => {
    await page.goto(`/trainings?q=${dta.code}`);
    await expect(page.getByRole("heading", { level: 1, name: "Pelatihan" })).toBeVisible();
    await expect(page.getByText(dta.code).filter({ visible: true }).first()).toBeVisible();
    await page.goto(`/trainings?q=${gta.code}`);
    await expect(page.getByText("Belum ada pelatihan yang sesuai filter.")).toBeVisible();
  });

  test("detail: funnel, modul, dan matriks peserta", { tag: ["@pelatihan"] }, async ({ page }) => {
    await page.goto(`/trainings/${dta.id}`);
    await expect(page.getByLabel("Funnel peserta")).toContainText("Pendaftar");
    await expect(page.getByText(/Dicek .* · isi berubah/)).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Berhenti di sini" })).toBeVisible();
    await page.getByRole("link", { name: /^Peserta · / }).click();
    await expect(page.getByRole("columnheader", { name: "No. peserta" })).toBeVisible();
    await expect(page.getByRole("img", { name: /item selesai$/ }).first()).toBeVisible();
    await page.getByRole("link", { name: "Tuntas", exact: true }).click();
    await expect(page).toHaveURL(/category=completed/);
  });

  test("ubah dan verifikasi jadwal", { tag: ["@pelatihan"] }, async ({ page }) => {
    await page.goto(`/trainings/${dta.id}`);
    await page.getByText("Ubah jadwal", { exact: true }).click();
    const form = page.getByRole("form", { name: "Ubah jadwal" });
    await form.getByLabel("Awal pendaftaran").fill("2026-09-01");
    await form.getByLabel("Akhir pendaftaran").fill("2026-09-20");
    await form.getByRole("checkbox").check();
    await form.getByRole("button", { name: "Simpan jadwal" }).click();
    await expect(page.getByText(/^Diverifikasi /)).toBeVisible();
    await expect(page.getByText("Pendaftaran ditutup sebelum pelaksanaan dimulai.")).toBeVisible();
  });
});

test.describe("viewer tim GTA", () => {
  test.use({ storageState: AUTH_STATES.viewer });

  test("hanya agregat, tanpa daftar peserta", { tag: ["@pelatihan"] }, async ({ page }) => {
    await page.goto(`/trainings/${gta.id}?tab=peserta`);
    await expect(page.getByLabel("Funnel peserta")).toBeVisible();
    await expect(page.getByText(/Daftar peserta hanya untuk pengelola/)).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "No. peserta" })).toHaveCount(0);
    await expect(page.getByText("Ubah jadwal", { exact: true })).toHaveCount(0);
  });
});

test.describe("pengelola tim GTA", () => {
  test.use({ storageState: AUTH_STATES.gtaManager });

  test("detail pelatihan tim lain tidak ditemukan", { tag: ["@pelatihan"] }, async ({ page }) => {
    await page.goto(`/trainings/${dta.id}`);
    await expect(page.getByRole("heading", { name: "Halaman tidak ditemukan" })).toBeVisible();
  });
});
