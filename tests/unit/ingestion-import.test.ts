// F2-06: PreviewImport dan CommitImport dengan fake port dan golden dataset (tanpa Supabase/Google).
import { describe, expect, it } from "vitest";
import { commitImport } from "@/modules/ingestion/application/commit-import";
import { previewImport } from "@/modules/ingestion/application/preview-import";
import { commitImportOutput, previewImportOutput } from "@/modules/ingestion/application/schemas";
import {
  MANAGER,
  SOURCE_ID,
  VIEWER,
  goldenRows,
  importDeps,
  sourceConfig,
} from "../support/ingestion-fakes";

const KEY = "commit-key-0001";

async function preview(deps = importDeps()) {
  const result = await previewImport(deps, { sourceId: SOURCE_ID }, MANAGER);
  if (!result.ok) throw new Error(result.error.message);
  return { deps, out: result.value };
}

describe("PreviewImport", () => {
  it("ringkasan golden-1 tanpa menulis tabel operasional", async () => {
    const { deps, out } = await preview();
    expect(previewImportOutput.parse(out)).toEqual(out);
    expect(out.summary).toMatchObject({
      participants: 41,
      newRows: 41,
      changedRows: 0,
      unchangedRows: 0,
      duplicateRows: 0,
      flaggedRows: 1,
      ignoredRows: 25,
      items: 34,
      emptySlots: 8,
      itemRange: { from: "J", to: "AY" },
      qualityFlags: { formula_error: 1 },
      catalog: "new",
      blockers: [],
    });
    expect(deps.imports.commits).toHaveLength(0);
    const batch = deps.imports.batches.get(out.batchId);
    expect(batch).toMatchObject({ status: "staged", createdBy: MANAGER.id, idempotencyKey: null });
    expect(out.expiresAt).toBe("2026-10-13T05:30:00.000Z");
    expect(deps.audit.entries.map((e) => e.action)).toEqual(["import.preview"]);
    // TOTAL DITERIMA tidak direkonsiliasi dan tidak menjadi peringatan (keputusan F2-04).
    expect(out.warnings).toEqual([]);
  });

  it("selisih total yang tidak terjelaskan menjadi peringatan", async () => {
    const deps = importDeps();
    const rows = goldenRows("golden-1");
    (rows[0] as string[])[8] = "30";
    deps.sheets.setRows(rows);
    const { out } = await preview(deps);
    expect(out.warnings).toEqual([
      "TOTAL SELESAI di baris 1 (30) berbeda dengan hitung ulang (33).",
    ]);
    expect(out.summary.reconciliationMismatches).toBe(1);
  });

  it("keluaran tanpa nama atau nomor peserta", async () => {
    const { deps, out } = await preview();
    const stored = JSON.stringify([out, [...deps.imports.batches.values()], deps.audit.entries]);
    expect(stored).not.toMatch(/Peserta Sintetis|SINT1-/);
  });

  it("tiga waktu: UPDATE TERAKHIR sebagai cadangan, tahun dari periode pelatihan", async () => {
    const { out } = await preview();
    expect(out.freshness).toEqual({
      fetchedAt: "2026-10-13T05:00:00.000Z",
      contentChangedAt: null,
      sourceUpdatedAt: "2026-10-13T11:43:00+07:00",
      sourceUpdatedAtUncertain: false,
      labelUpdatedAt: "2026-10-13T11:43:00+07:00",
    });
  });

  it("modifiedTime Drive diutamakan", async () => {
    const deps = importDeps();
    deps.imports.sources.get(SOURCE_ID)!.driveFileId = "drive-file";
    deps.drive.times.set("drive-file", "2026-10-13T04:00:00.000Z");
    const { out } = await preview(deps);
    expect(out.freshness.sourceUpdatedAt).toBe("2026-10-13T04:00:00.000Z");
  });

  it("golden-2: selisih TOTAL PENDAFTAR dijelaskan sebagai peringatan", async () => {
    const { out } = await preview(importDeps("golden-2"));
    expect(out.summary).toMatchObject({ participants: 51, items: 28, emptySlots: 14 });
    expect(out.warnings).toContain("Selisih 1 karena 1 baris Pembatalan.");
  });

  it("input strict dan role", async () => {
    const deps = importDeps();
    const extra = await previewImport(deps, { sourceId: SOURCE_ID, force: true }, MANAGER);
    expect(extra).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
    const viewer = await previewImport(deps, { sourceId: SOURCE_ID }, VIEWER);
    expect(viewer).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
  });

  it("sheet tidak terbaca dan tata letak rusak dilaporkan tanpa menebak", async () => {
    const deps = importDeps();
    deps.sheets.readError = "PERMISSION_DENIED";
    expect(await previewImport(deps, { sourceId: SOURCE_ID }, MANAGER)).toMatchObject({
      ok: false,
      error: { code: "SOURCE_UNAVAILABLE", details: { reason: "PERMISSION_DENIED" } },
    });
    const broken = importDeps();
    const rows = goldenRows("golden-1");
    rows[1] = (rows[1] ?? []).map((h) => (h === "Cek Sync" ? "Catatan" : h));
    broken.sheets.setRows(rows);
    expect(await previewImport(broken, { sourceId: SOURCE_ID }, MANAGER)).toMatchObject({
      ok: false,
      error: { code: "BLOCKED", details: { layoutError: "CEK_SYNC_MISSING" } },
    });
  });

  it("status_mapping kosong tetap memakai pemetaan bawaan", async () => {
    const { deps, out } = await preview();
    await commitImport(deps, { batchId: out.batchId, idempotencyKey: KEY }, MANAGER);
    const statuses = deps.imports.commits[0]?.participants.map((p) => p.enrollmentStatus);
    expect(statuses?.filter((s) => s === "passed")).toHaveLength(33);
    expect(statuses).not.toContain("unmapped");
  });
});

describe("CommitImport", () => {
  it("menyimpan sekali dengan katalog v1 draf, lalu idempoten", async () => {
    const { deps, out } = await preview();
    const first = await commitImport(deps, { batchId: out.batchId, idempotencyKey: KEY }, MANAGER);
    expect(first).toEqual({
      ok: true,
      value: { batchId: out.batchId, status: "committed", replayed: false, participants: 41 },
    });
    if (first.ok) expect(commitImportOutput.parse(first.value)).toEqual(first.value);
    const payload = deps.imports.commits[0];
    expect(payload?.catalog).toMatchObject({ action: "create", version: 1 });
    expect(payload?.batch).toMatchObject({ status: "committed", idempotencyKey: KEY });
    expect(payload?.batch.freshness.contentChangedAt).toBe(payload?.batch.freshness.fetchedAt);
    expect(deps.imports.catalogs.get(payload?.batch.trainingId ?? "")?.status).toBe("draft");

    const replay = await commitImport(deps, { batchId: out.batchId, idempotencyKey: KEY }, MANAGER);
    expect(replay).toMatchObject({ ok: true, value: { replayed: true, participants: 41 } });
    expect(deps.imports.commits).toHaveLength(1);
  });

  it("idempotency_key yang sama untuk batch lain ditolak", async () => {
    const { deps, out } = await preview();
    await commitImport(deps, { batchId: out.batchId, idempotencyKey: KEY }, MANAGER);
    const other = await commitImport(
      deps,
      { batchId: "00000000-0000-4000-8000-000000000999", idempotencyKey: KEY },
      MANAGER,
    );
    expect(other).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });

  it("pratinjau kedaluwarsa ditolak", async () => {
    const { deps, out } = await preview();
    deps.clock.advanceMinutes(31);
    const result = await commitImport(deps, { batchId: out.batchId, idempotencyKey: KEY }, MANAGER);
    expect(result).toMatchObject({
      ok: false,
      error: { code: "CONFLICT", details: { status: "expired" } },
    });
    expect(deps.imports.batches.get(out.batchId)?.status).toBe("expired");
  });

  it("sumber berubah sejak pratinjau: validasi ulang menolak", async () => {
    const { deps, out } = await preview();
    const rows = goldenRows("golden-1");
    (rows[3] as string[])[9] = "Belum Mengerjakan";
    deps.sheets.setRows(rows);
    const result = await commitImport(deps, { batchId: out.batchId, idempotencyKey: KEY }, MANAGER);
    expect(result).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(deps.imports.batches.get(out.batchId)?.status).toBe("rejected");
    expect(deps.imports.commits).toHaveLength(0);
  });

  it("nomor registrasi ganda menahan commit", async () => {
    const deps = importDeps();
    const rows = goldenRows("golden-1");
    (rows[3] as string[])[1] = (rows[2] as string[])[1] as string;
    deps.sheets.setRows(rows);
    const { out } = await preview(deps);
    expect(out.summary).toMatchObject({ duplicateRows: 2, blockers: ["DUPLICATE_PARTICIPANTS"] });
    const result = await commitImport(deps, { batchId: out.batchId, idempotencyKey: KEY }, MANAGER);
    expect(result).toMatchObject({
      ok: false,
      error: { code: "BLOCKED", details: { blockers: ["DUPLICATE_PARTICIPANTS"] } },
    });
  });

  it("impor berikutnya: baris berubah dihitung, katalog berubah ditahan", async () => {
    const { deps, out } = await preview();
    await commitImport(deps, { batchId: out.batchId, idempotencyKey: KEY }, MANAGER);

    const same = await preview(deps);
    expect(same.out.summary).toMatchObject({ unchangedRows: 41, catalog: "unchanged" });
    const noop = await commitImport(
      deps,
      { batchId: same.out.batchId, idempotencyKey: "commit-key-0002" },
      MANAGER,
    );
    expect(noop).toMatchObject({ ok: false, error: { details: { status: "unchanged" } } });

    const rows = goldenRows("golden-1");
    (rows[3] as string[])[9] = "Belum Mengerjakan";
    deps.sheets.setRows(rows);
    expect((await preview(deps)).out.summary).toMatchObject({ changedRows: 1, unchangedRows: 40 });

    (rows[1] as string[])[10] = "MATERI 1: PENGANTAR WEB (REVISI)";
    deps.sheets.setRows(rows);
    const renamed = await preview(deps);
    expect(renamed.out.summary).toMatchObject({
      catalog: "changed",
      blockers: ["CATALOG_CHANGED"],
    });
    const blocked = await commitImport(
      deps,
      { batchId: renamed.out.batchId, idempotencyKey: "commit-key-0003" },
      MANAGER,
    );
    expect(blocked).toMatchObject({ ok: false, error: { code: "BLOCKED" } });
  });

  it("validasi input dan role", async () => {
    const deps = importDeps();
    expect(
      await commitImport(deps, { batchId: "bukan-uuid", idempotencyKey: KEY }, MANAGER),
    ).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR" },
    });
    expect(
      await commitImport(deps, { batchId: SOURCE_ID, idempotencyKey: KEY }, VIEWER),
    ).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(
      await commitImport(deps, { batchId: SOURCE_ID, idempotencyKey: KEY }, MANAGER),
    ).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
  });
});

describe("sumber CSV/XLSX (F2-07)", () => {
  const UPLOAD = "00000000-0000-4000-8000-000000000321";

  function csvDeps() {
    const deps = importDeps();
    deps.imports.sources.set(SOURCE_ID, sourceConfig({ sourceType: "csv", reference: null }));
    deps.sheets.rows.set(`${SOURCE_ID}/${UPLOAD}.csv`, { ok: true, rows: goldenRows("golden-1") });
    return deps;
  }

  it("pratinjau wajib menyebut unggahan; path file disusun server dari ID", async () => {
    const deps = csvDeps();
    expect(await previewImport(deps, { sourceId: SOURCE_ID }, MANAGER)).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR" },
    });
    const traversal = { sourceId: SOURCE_ID, uploadId: "../../rahasia" };
    expect(await previewImport(deps, traversal, MANAGER)).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR" },
    });
    const result = await previewImport(deps, { sourceId: SOURCE_ID, uploadId: UPLOAD }, MANAGER);
    expect(result).toMatchObject({ ok: true, value: { summary: { participants: 41 } } });
  });

  it("batch menyimpan unggahan sehingga commit membaca ulang file yang sama", async () => {
    const deps = csvDeps();
    const preview = await previewImport(deps, { sourceId: SOURCE_ID, uploadId: UPLOAD }, MANAGER);
    if (!preview.ok) throw new Error(preview.error.message);
    expect(deps.imports.batches.get(preview.value.batchId)).toMatchObject({
      uploadId: UPLOAD,
      sourceType: "csv",
    });
    const result = await commitImport(
      deps,
      { batchId: preview.value.batchId, idempotencyKey: KEY },
      MANAGER,
    );
    expect(result).toMatchObject({ ok: true, value: { participants: 41 } });
  });
});
