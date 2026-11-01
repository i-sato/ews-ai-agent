// F2-08: route /api/v1 lewat HTTP dengan sesi asli. BOLA (SH-AUTHZ-03): pengelola tim GTA tidak dapat
// mengakses pelatihan, sumber, batch, atau run milik tim DTA. BFLA (SH-AUTHZ-04), 401, cron.
import { readFileSync } from "node:fs";
import { type APIRequestContext, expect, test } from "@playwright/test";
import { SHEETS_DIR } from "../fixtures/golden/golden-sheets";
import {
  TEST_USERS,
  adminClient,
  createCsvTraining,
  existingUserId,
  localSupabaseEnv,
} from "../support/local-supabase";
import { AUTH_STATES } from "./global-setup";

test.skip(({ isMobile }) => isMobile, "uji API cukup sekali");

const csv = readFileSync(`${SHEETS_DIR}golden-1.csv`);
let dta: { trainingId: string; sourceId: string };
let batchId: string;
let runId: string;

const upload = (api: APIRequestContext, sourceId: string) =>
  api.post("/api/v1/imports/preview", {
    multipart: { sourceId, file: { name: "peserta.csv", mimeType: "text/csv", buffer: csv } },
  });

test.beforeAll(async ({ playwright, baseURL }) => {
  localSupabaseEnv();
  // Akun disiapkan global setup; jangan ensureTestUser di sini karena mencabut sesi tersimpan.
  const adminId = await existingUserId(TEST_USERS.admin);
  dta = await createCsvTraining("DTA", adminId);
  const api = await playwright.request.newContext({
    baseURL,
    storageState: AUTH_STATES.trainingManager,
  });
  const preview = await upload(api, dta.sourceId);
  expect(preview.status()).toBe(200);
  batchId = (await preview.json()).batchId;
  runId = crypto.randomUUID();
  const run = await adminClient()
    .from("sync_runs")
    .insert({ id: runId, source_id: dta.sourceId, trigger: "manual", status: "failed" });
  expect(run.error).toBeNull();
  await api.dispose();
});

test.describe("pengelola tim DTA (pemilik data)", () => {
  test.use({ storageState: AUTH_STATES.trainingManager });

  test("pratinjau, commit, jadwal, dan status run", { tag: ["@impor"] }, async ({ request }) => {
    const commit = await request.post("/api/v1/imports/commit", {
      data: { batchId, idempotencyKey: `e2e-${batchId}` },
    });
    expect(commit.status()).toBe(200);
    expect(await commit.json()).toMatchObject({ status: "committed", participants: 41 });
    const schedule = await request.put(`/api/v1/trainings/${dta.trainingId}/schedule`, {
      data: {
        registrationStart: "2026-09-01",
        registrationEnd: "2026-09-20",
        startDate: "2026-09-23",
        endDate: "2026-09-30",
        verified: true,
      },
    });
    expect(schedule.status()).toBe(200);
    expect((await request.get(`/api/v1/sync/runs/${runId}`)).status()).toBe(200);
  });

  test("galat §7.3 dengan request_id", { tag: ["@impor"] }, async ({ request }) => {
    const res = await request.post("/api/v1/imports/commit", { data: { batchId: "x", extra: 1 } });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatchObject({ code: "VALIDATION_ERROR", request_id: expect.any(String) });
    expect(Array.isArray(body.error.details)).toBe(true);
    expect(JSON.stringify(body)).not.toMatch(/at \w+ \(|node_modules|stack/i);
  });

  test("endpoint khusus Admin ditolak (BFLA)", { tag: ["@pelatihan"] }, async ({ request }) => {
    const register = await request.post("/api/v1/trainings", { data: {} });
    expect(register.status()).toBe(403);
    const parse = await request.post("/api/v1/trainings/parse-source", { data: {} });
    expect(parse.status()).toBe(403);
  });
});

test.describe("pengelola tim GTA (tim lain, BOLA)", () => {
  test.use({ storageState: AUTH_STATES.gtaManager });

  test("sumber dan batch DTA tidak ditemukan", { tag: ["@impor"] }, async ({ request }) => {
    expect((await upload(request, dta.sourceId)).status()).toBe(404);
    const commit = await request.post("/api/v1/imports/commit", {
      data: { batchId, idempotencyKey: "e2e-bola-commit" },
    });
    expect(commit.status()).toBe(404);
    const sync = await request.post("/api/v1/sync/google-sheets", {
      data: { sourceId: dta.sourceId },
    });
    expect(sync.status()).toBe(404);
    expect((await request.get(`/api/v1/sync/runs/${runId}`)).status()).toBe(404);
  });

  test("jadwal pelatihan DTA tidak dapat diubah", { tag: ["@pelatihan"] }, async ({ request }) => {
    const res = await request.put(`/api/v1/trainings/${dta.trainingId}/schedule`, {
      data: {
        registrationStart: "2026-09-01",
        registrationEnd: "2026-09-20",
        startDate: "2026-09-23",
        endDate: "2026-09-30",
        verified: true,
      },
    });
    expect(res.status()).toBe(404);
  });
});

test.describe("tanpa sesi dan cron", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("tanpa sesi: 401 dengan request_id", { tag: ["@impor"] }, async ({ request }) => {
    const res = await request.post("/api/v1/imports/commit", { data: {} });
    expect(res.status()).toBe(401);
    expect((await res.json()).error).toMatchObject({
      code: "UNAUTHENTICATED",
      request_id: expect.any(String),
    });
  });

  test("cron hanya dengan CRON_SECRET yang benar", { tag: ["@impor"] }, async ({ request }) => {
    expect((await request.get("/api/v1/sync/google-sheets")).status()).toBe(401);
    const wrong = { Authorization: "Bearer salah-salah-salah-salah" };
    expect((await request.get("/api/v1/sync/google-sheets", { headers: wrong })).status()).toBe(
      401,
    );
    const right = { Authorization: `Bearer ${process.env.CRON_SECRET}` };
    const res = await request.get("/api/v1/sync/google-sheets", { headers: right });
    expect(res.status()).toBe(200);
    expect(Array.isArray((await res.json()).results)).toBe(true);
  });
});
