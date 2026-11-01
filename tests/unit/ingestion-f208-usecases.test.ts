// F2-08: use case jadwal, status sinkron, sinkron terjadwal, dan unggah + pratinjau (fake port).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { previewUpload } from "@/modules/ingestion/application/preview-upload";
import { getSyncRun, syncAllSources } from "@/modules/ingestion/application/sync-runs";
import { syncSheet } from "@/modules/ingestion/application/sync-sheet";
import { updateSchedule } from "@/modules/ingestion/application/update-schedule";
import { SHEETS_DIR } from "../fixtures/golden/golden-sheets";
import {
  FakeAudit,
  FakeClock,
  FakeTrainings,
  MANAGER,
  SOURCE_ID,
  TRAINING_ID,
  VIEWER,
  goldenRows,
  importDeps,
  sourceConfig,
  uuid,
} from "../support/ingestion-fakes";

const schedule = {
  trainingId: TRAINING_ID,
  registrationStart: "2026-09-01",
  registrationEnd: "2026-09-20",
  startDate: "2026-09-23",
  endDate: "2026-09-30",
  verified: true,
};

function scheduleDeps() {
  const trainings = new FakeTrainings();
  trainings.visible.set(TRAINING_ID, { id: TRAINING_ID, code: "DTA-90109" });
  return { trainings, audit: new FakeAudit(), clock: new FakeClock() };
}

describe("updateSchedule (§3.6)", () => {
  it("menyimpan jadwal manual; verifikasi dari aktor dan jam server", async () => {
    const deps = scheduleDeps();
    const result = await updateSchedule(deps, schedule, MANAGER);
    expect(result).toEqual({
      ok: true,
      value: { trainingId: TRAINING_ID, verified: true, verifiedAt: "2026-10-13T05:00:00.000Z" },
    });
    expect(deps.trainings.schedules.get(TRAINING_ID)).toMatchObject({
      scheduleSource: "manual",
      verifiedBy: MANAGER.id,
    });
    expect(deps.audit.entries).toMatchObject([{ action: "training.schedule" }]);
  });

  it("tanpa centang verifikasi dikosongkan", async () => {
    const deps = scheduleDeps();
    await updateSchedule(deps, { ...schedule, verified: false }, MANAGER);
    expect(deps.trainings.schedules.get(TRAINING_ID)).toMatchObject({
      verifiedBy: null,
      verifiedAt: null,
    });
  });

  it.each([
    ["pendaftaran terbalik", { registrationStart: "2026-09-21" }],
    ["batas pendaftaran melewati mulai", { registrationEnd: "2026-09-24" }],
    ["selesai sebelum mulai", { endDate: "2026-09-22" }],
    ["tanpa tahun", { startDate: "09-23" }],
    ["verifikasi dari klien", { verifiedBy: MANAGER.id }],
  ])("menolak %s", async (_, over) => {
    const result = await updateSchedule(scheduleDeps(), { ...schedule, ...over }, MANAGER);
    expect(result).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
  });

  it("viewer ditolak; pelatihan tim lain tidak ditemukan", async () => {
    expect(await updateSchedule(scheduleDeps(), schedule, VIEWER)).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
    const other = { ...schedule, trainingId: uuid(777) };
    expect(await updateSchedule(scheduleDeps(), other, MANAGER)).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
  });
});

describe("getSyncRun dan syncAllSources", () => {
  it("status run; run yang tidak terlihat dilaporkan tidak ditemukan", async () => {
    const deps = importDeps();
    const synced = await syncSheet(deps, { sourceId: SOURCE_ID, trigger: "scheduled" }, null);
    if (!synced.ok) throw new Error(synced.error.message);
    expect(await getSyncRun(deps, { runId: synced.value.runId })).toMatchObject({
      ok: true,
      value: { id: synced.value.runId, status: "succeeded", trigger: "scheduled" },
    });
    expect(await getSyncRun(deps, { runId: uuid(999) })).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
    expect(await getSyncRun(deps, { runId: "bukan-uuid" })).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR" },
    });
  });

  it("cron menyinkronkan semua sumber Google; satu gagal tidak menghentikan lainnya", async () => {
    const deps = importDeps();
    const broken = uuid(902_1);
    deps.imports.sources.set(
      broken,
      sourceConfig({ id: broken, reference: { spreadsheetId: "hilang", gid: null } }),
    );
    deps.imports.sources.set(
      uuid(903),
      sourceConfig({ id: uuid(903), sourceType: "csv", reference: null }),
    );
    const results = await syncAllSources(deps);
    expect(results).toEqual([
      { sourceId: SOURCE_ID, status: "committed", error: null },
      { sourceId: broken, status: "failed", error: "SOURCE_UNAVAILABLE" },
    ]);
  });
});

describe("previewUpload (SH-UPLOAD-01/02)", () => {
  const csv = new Uint8Array(readFileSync(`${SHEETS_DIR}golden-1.csv`));
  const file = (
    over: Partial<{ fileName: string; contentType: string; bytes: Uint8Array }> = {},
  ) => ({
    fileName: "peserta.csv",
    contentType: "text/csv",
    bytes: csv,
    ...over,
  });

  function csvDeps() {
    const deps = importDeps();
    deps.imports.sources.set(SOURCE_ID, sourceConfig({ sourceType: "csv", reference: null }));
    // ID pertama dari SeqIds menjadi uploadId; FakeSheets membaca file dengan path yang sama.
    deps.sheets.rows.set(`${SOURCE_ID}/${uuid(1)}.csv`, { ok: true, rows: goldenRows("golden-1") });
    return deps;
  }

  it("menyimpan file dengan path dari server lalu memratinjau", async () => {
    const deps = csvDeps();
    const result = await previewUpload(deps, { sourceId: SOURCE_ID, file: file() }, MANAGER);
    expect(result).toMatchObject({ ok: true, value: { summary: { participants: 41 } } });
    expect([...deps.uploads.saved.keys()]).toEqual([`${SOURCE_ID}/${uuid(1)}.csv`]);
  });

  it.each([
    ["ekstensi salah", { fileName: "peserta.xlsx" }],
    ["MIME salah", { contentType: "application/zip" }],
    ["nama file kosong", { fileName: "" }],
  ])("menolak %s", async (_, over) => {
    const deps = csvDeps();
    const result = await previewUpload(deps, { sourceId: SOURCE_ID, file: file(over) }, MANAGER);
    expect(result).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
    expect(deps.uploads.saved.size).toBe(0);
  });

  it("terlalu besar, sumber Google, sumber tidak ada, dan role", async () => {
    const deps = csvDeps();
    const big = file({ bytes: new Uint8Array(deps.settings.maxUploadBytes + 1) });
    expect(await previewUpload(deps, { sourceId: SOURCE_ID, file: big }, MANAGER)).toMatchObject({
      ok: false,
      error: { code: "TOO_LARGE" },
    });
    const google = importDeps();
    expect(
      await previewUpload(google, { sourceId: SOURCE_ID, file: file() }, MANAGER),
    ).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR" },
    });
    expect(await previewUpload(deps, { sourceId: uuid(555), file: file() }, MANAGER)).toMatchObject(
      {
        ok: false,
        error: { code: "NOT_FOUND" },
      },
    );
    expect(await previewUpload(deps, { sourceId: SOURCE_ID, file: file() }, VIEWER)).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
    expect(deps.uploads.saved.size).toBe(0);
  });
});
