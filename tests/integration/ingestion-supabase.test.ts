// F2-07: adapter Supabase dan file lewat use case sungguhan (Supabase lokal, golden dataset).
// Butuh `supabase start`, `supabase db reset`, dan `pnpm db:env`.
import { randomInt, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { ConfigurationError, ingestionDeps } from "@/lib/container";
import { commitImport } from "@/modules/ingestion/application/commit-import";
import { previewImport } from "@/modules/ingestion/application/preview-import";
import { SHEETS_DIR } from "../fixtures/golden/golden-sheets";
import {
  TEST_USERS,
  adminClient,
  ensureTestUser,
  localSupabaseEnv,
  signedInClient,
} from "../support/local-supabase";
import { buildXlsx } from "../support/xlsx";

const golden = readFileSync(`${SHEETS_DIR}golden-1.csv`);
let service: SupabaseClient;
let sourceId: string;
let trainingId: string;
let manager: { id: string; role: "training_manager" };
let managerClient: SupabaseClient;

async function upload(bytes: Uint8Array) {
  const uploadId = randomUUID();
  const { error } = await service.storage
    .from("imports")
    .upload(`${sourceId}/${uploadId}.csv`, bytes, { contentType: "text/csv" });
  if (error) throw error;
  return uploadId;
}

async function count(table: string, column: string, value: string) {
  const { count: n, error } = await service
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq(column, value);
  if (error) throw error;
  return n;
}

beforeAll(async () => {
  localSupabaseEnv();
  process.env.IMPORT_STAGING_TTL_MINUTES = "30";
  process.env.MANUAL_SYNC_MIN_INTERVAL_MINUTES = "10";
  service = adminClient();
  const adminId = await ensureTestUser(TEST_USERS.admin);
  manager = { id: await ensureTestUser(TEST_USERS.trainingManager), role: "training_manager" };
  await ensureTestUser(TEST_USERS.gtaManager);
  managerClient = await signedInClient(TEST_USERS.trainingManager);

  const { data: year } = await service
    .from("work_team_years")
    .select("id, work_teams!inner(code)")
    .eq("work_teams.code", "DTA")
    .eq("year", 2026)
    .single();
  trainingId = randomUUID();
  sourceId = randomUUID();
  const portal = String(randomInt(100000, 999999));
  const training = await service.from("trainings").insert({
    id: trainingId,
    work_team_year_id: year?.id,
    code: `DTA-${portal}`,
    name: "Pelatihan Sintetis Integrasi",
    portal_training_id: portal,
    id_confirmed_by: adminId,
    id_confirmed_at: new Date().toISOString(),
    start_date: "2026-09-23",
    end_date: "2026-09-30",
  });
  if (training.error) throw training.error;
  const source = await service
    .from("data_sources")
    .insert({ id: sourceId, training_id: trainingId, source_type: "csv" });
  if (source.error) throw source.error;
});

describe("impor CSV lewat Supabase lokal", () => {
  let batchId: string;

  it("pratinjau membaca file dari bucket privat lewat sesi pengguna tim DTA", async () => {
    const deps = await ingestionDeps(managerClient);
    const result = await previewImport(deps, { sourceId, uploadId: await upload(golden) }, manager);
    if (!result.ok) throw new Error(result.error.message);
    batchId = result.value.batchId;
    expect(result.value.summary).toMatchObject({ participants: 41, newRows: 41, ignoredRows: 25 });
    expect(await count("training_enrollments", "training_id", trainingId)).toBe(0);
  });

  it("commit menulis seluruh data dalam satu transaksi", async () => {
    const deps = await ingestionDeps(managerClient);
    const key = `it-${batchId}`;
    const result = await commitImport(deps, { batchId, idempotencyKey: key }, manager);
    expect(result).toMatchObject({ ok: true, value: { participants: 41, replayed: false } });

    expect(await count("training_enrollments", "training_id", trainingId)).toBe(41);
    expect(await count("participant_progress_snapshots", "import_batch_id", batchId)).toBe(41);
    expect(await count("participant_module_progress", "import_batch_id", batchId)).toBe(41 * 34);
    expect(await count("training_modules", "training_id", trainingId)).toBe(34);
    const { data: batch } = await service
      .from("import_batches")
      .select("status, idempotency_key, source_reference")
      .eq("id", batchId)
      .single();
    expect(batch).toMatchObject({ status: "committed", idempotency_key: key });
    const { data: hashes } = await service
      .from("participant_progress_snapshots")
      .select("row_hash")
      .eq("import_batch_id", batchId)
      .is("row_hash", null);
    expect(hashes).toHaveLength(0);

    const replay = await commitImport(deps, { batchId, idempotencyKey: key }, manager);
    expect(replay).toMatchObject({ ok: true, value: { replayed: true } });
  });

  it("audit log tercatat tanpa data peserta", async () => {
    const { data } = await service
      .from("audit_logs")
      .select("action, details")
      .eq("resource_id", batchId);
    expect(data?.map((r) => r.action).sort()).toEqual(["import.commit", "import.preview"]);
    expect(JSON.stringify(data)).not.toMatch(/Peserta Sintetis|SINT1-/);
  });

  it("unggahan ulang dengan isi sama: semua baris tidak berubah", async () => {
    const deps = await ingestionDeps(managerClient);
    const result = await previewImport(deps, { sourceId, uploadId: await upload(golden) }, manager);
    expect(result).toMatchObject({
      ok: true,
      value: { summary: { unchangedRows: 41, newRows: 0, catalog: "unchanged" } },
    });
  });

  it("pengguna tim lain tidak dapat melihat sumber maupun batch (BOLA)", async () => {
    const deps = await ingestionDeps(await signedInClient(TEST_USERS.gtaManager));
    const other = { id: randomUUID(), role: "training_manager" as const };
    expect(await previewImport(deps, { sourceId, uploadId: randomUUID() }, other)).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
    const commit = await commitImport(deps, { batchId, idempotencyKey: "it-bola-0001" }, other);
    expect(commit).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
  });

  it("file yang bukan CSV ditolak dengan alasan jelas", async () => {
    const deps = await ingestionDeps(managerClient);
    const zip = buildXlsx([{ name: "S", rows: [["a"]] }]);
    const result = await previewImport(deps, { sourceId, uploadId: await upload(zip) }, manager);
    expect(result).toMatchObject({
      ok: false,
      error: { code: "SOURCE_UNAVAILABLE", details: { reason: "INVALID_FILE" } },
    });
  });
});

describe("container", () => {
  it("menolak berjalan tanpa pengaturan impor", async () => {
    const saved = process.env.IMPORT_STAGING_TTL_MINUTES;
    delete process.env.IMPORT_STAGING_TTL_MINUTES;
    await expect(ingestionDeps(null)).rejects.toBeInstanceOf(ConfigurationError);
    process.env.IMPORT_STAGING_TTL_MINUTES = saved;
  });
});
