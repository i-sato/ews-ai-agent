// F2-06: SyncSheet (spesifikasi §3.5) dengan fake port dan golden dataset.
import { describe, expect, it } from "vitest";
import { syncSheetOutput } from "@/modules/ingestion/application/schemas";
import { syncSheet } from "@/modules/ingestion/application/sync-sheet";
import { MANAGER, SOURCE_ID, VIEWER, goldenRows, importDeps } from "../support/ingestion-fakes";

const scheduled = { sourceId: SOURCE_ID, trigger: "scheduled" };
const manual = { sourceId: SOURCE_ID, trigger: "manual" };

describe("SyncSheet", () => {
  it("sinkron pertama: commit otomatis, tiga waktu tercatat", async () => {
    const deps = importDeps();
    deps.imports.sources.get(SOURCE_ID)!.driveFileId = "drive-file";
    deps.drive.times.set("drive-file", "2026-10-13T04:43:00.000Z");
    const result = await syncSheet(deps, scheduled, null);
    if (!result.ok) throw new Error(result.error.message);
    expect(syncSheetOutput.parse(result.value)).toEqual(result.value);
    expect(result.value).toMatchObject({ status: "committed", warnings: [] });
    expect(result.value.freshness).toMatchObject({
      fetchedAt: "2026-10-13T05:00:00.000Z",
      contentChangedAt: "2026-10-13T05:00:00.000Z",
      sourceUpdatedAt: "2026-10-13T04:43:00.000Z",
    });
    expect(deps.imports.commits).toHaveLength(1);
    expect(deps.imports.commits[0]?.idempotencyKey).toMatch(
      new RegExp(`^sync:${SOURCE_ID}:[0-9a-f]{64}$`),
    );
    expect(deps.imports.fetches).toEqual([
      {
        sourceId: SOURCE_ID,
        fetchedAt: "2026-10-13T05:00:00.000Z",
        sourceModifiedAt: "2026-10-13T04:43:00.000Z",
      },
    ]);
    expect(deps.imports.runs.get(result.value.runId)).toMatchObject({
      status: "succeeded",
      trigger: "scheduled",
    });
  });

  it("isi sama: hanya fetched_at yang diperbarui, tanpa snapshot baru", async () => {
    const deps = importDeps();
    await syncSheet(deps, scheduled, null);
    deps.clock.advanceMinutes(60);
    const result = await syncSheet(deps, scheduled, null);
    expect(result).toMatchObject({ ok: true, value: { status: "unchanged", batchId: null } });
    if (!result.ok) return;
    expect(result.value.freshness).toMatchObject({
      fetchedAt: "2026-10-13T06:00:00.000Z",
      contentChangedAt: "2026-10-13T05:00:00.000Z",
    });
    expect(deps.imports.commits).toHaveLength(1);
    expect(deps.imports.fetches.map((f) => f.fetchedAt)).toEqual([
      "2026-10-13T05:00:00.000Z",
      "2026-10-13T06:00:00.000Z",
    ]);
    expect(deps.imports.runs.get(result.value.runId)?.status).toBe("unchanged");
    expect(deps.audit.entries.map((e) => e.action)).toEqual([
      "import.commit",
      "sync.succeeded",
      "sync.unchanged",
    ]);
  });

  it("isi berubah tetapi UPDATE TERAKHIR tetap: peringatan ringan", async () => {
    const deps = importDeps();
    await syncSheet(deps, scheduled, null);
    const rows = goldenRows("golden-1");
    (rows[3] as string[])[9] = "Belum Mengerjakan";
    deps.sheets.setRows(rows);
    const result = await syncSheet(deps, scheduled, null);
    expect(result).toMatchObject({ ok: true, value: { status: "committed" } });
    if (result.ok) {
      expect(result.value.warnings).toContain(
        "Label pembaruan di sheet tidak diperbarui walaupun isinya berubah.",
      );
    }
  });

  it("izin dicabut: run gagal, snapshot valid terakhir dipertahankan", async () => {
    const deps = importDeps();
    await syncSheet(deps, scheduled, null);
    const before = deps.imports.states.get(SOURCE_ID);
    deps.sheets.readError = "PERMISSION_DENIED";
    const result = await syncSheet(deps, scheduled, null);
    expect(result).toMatchObject({ ok: false, error: { code: "SOURCE_UNAVAILABLE" } });
    expect(deps.imports.states.get(SOURCE_ID)).toBe(before);
    const failed = [...deps.imports.runs.values()].at(-1);
    expect(failed).toMatchObject({ status: "failed" });
    expect(failed?.errorSummary).toContain("akses untuk service account");
  });

  it("ada penahan: batch tetap staged dan run perlu tinjauan", async () => {
    const deps = importDeps();
    const rows = goldenRows("golden-1");
    (rows[3] as string[])[1] = (rows[2] as string[])[1] as string;
    deps.sheets.setRows(rows);
    const result = await syncSheet(deps, scheduled, null);
    expect(result).toMatchObject({ ok: true, value: { status: "needs_review" } });
    if (!result.ok) return;
    expect(deps.imports.commits).toHaveLength(0);
    expect(deps.imports.batches.get(result.value.batchId ?? "")?.status).toBe("staged");
    expect(deps.imports.runs.get(result.value.runId)?.errorSummary).toMatch(/^Perlu tinjauan: /);
  });

  it("sinkron manual: hanya pengelola/admin, dengan batas frekuensi", async () => {
    const deps = importDeps();
    expect(await syncSheet(deps, manual, VIEWER)).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
    expect(await syncSheet(deps, manual, null)).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
    expect(await syncSheet(deps, manual, MANAGER)).toMatchObject({ ok: true });
    deps.clock.advanceMinutes(4);
    expect(await syncSheet(deps, manual, MANAGER)).toMatchObject({
      ok: false,
      error: { code: "RATE_LIMITED", details: { retryAfterSeconds: 360 } },
    });
    deps.clock.advanceMinutes(6);
    expect(await syncSheet(deps, manual, MANAGER)).toMatchObject({
      ok: true,
      value: { status: "unchanged" },
    });
  });

  it("sumber tidak ada dan input tidak valid", async () => {
    const deps = importDeps();
    const missing = { sourceId: "00000000-0000-4000-8000-000000000777", trigger: "scheduled" };
    expect(await syncSheet(deps, missing, null)).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND" },
    });
    expect(await syncSheet(deps, { ...scheduled, trigger: "hourly" }, null)).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR" },
    });
    expect(deps.imports.runs.size).toBe(0);
  });
});
