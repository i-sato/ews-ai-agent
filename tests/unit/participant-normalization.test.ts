// F2-04 dengan golden dataset F2-05: format lebar → panjang, baris tanpa identitas, galat formula,
// konsistensi PERSENTASE LMS, dan rekonsiliasi baris 1 (spesifikasi §3.3, §3.4).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeParticipants } from "@/modules/ingestion/domain/participant-rows";
import { reconcileRow1 } from "@/modules/ingestion/domain/row1-reconciliation";
import { type SheetLayout, detectLayout } from "@/modules/ingestion/domain/sheet-layout";
import { SHEETS_DIR } from "../fixtures/golden/golden-sheets";
import { parseCsv } from "../support/csv";

const OPTIONS = { lmsTolerancePp: 1 };

function load(key: string) {
  const [meta = [], headers = [], ...data] = parseCsv(
    readFileSync(`${SHEETS_DIR}${key}.csv`, "utf8"),
  );
  const detected = detectLayout(headers);
  if (!detected.ok) throw new Error(detected.error.code);
  const layout: SheetLayout = detected.layout;
  const result = normalizeParticipants(data, layout, OPTIONS);
  return { meta, layout, result };
}

const byNumber = <T extends { participantNumber: string }>(participants: T[], n: string) =>
  participants.find((p) => p.participantNumber === n);

describe("golden-1", () => {
  const { meta, layout, result } = load("golden-1");
  const { participants, ignoredRows } = result;

  it("hanya baris ber-NO REGISTRASI yang menjadi peserta", () => {
    expect(participants).toHaveLength(41);
    expect(participants[0]?.rowNumber).toBe(3);
    expect(ignoredRows).toEqual(Array.from({ length: 25 }, (_, i) => 44 + i));
  });

  it("format panjang: satu baris per peserta per item berjudul", () => {
    for (const p of participants) {
      expect(p.totalItems).toBe(34);
      expect(p.modules.map((m) => m.sequence)).toEqual(Array.from({ length: 34 }, (_, i) => i + 1));
    }
    expect(participants.flatMap((p) => p.modules)).toHaveLength(41 * 34);
    const first = participants[0]?.modules;
    expect(first?.[14]).toMatchObject({
      moduleCode: "M15",
      moduleName: "KUIS 1",
      moduleType: "quiz",
    });
    expect(first?.[4]?.moduleName).toBe("MATERI 3: HTML & CSS DASAR");
  });

  it("status, onboarding, persentase, dan jumlah item selesai", () => {
    const stopped = byNumber(participants, "SINT1-013");
    expect(stopped).toMatchObject({
      participantName: "Peserta Sintetis 1-013",
      organization: "SMK Sintetis Nusantara Satu",
      sourceStatus: "Tidak Lulus Pelatihan - Nilai",
      enrollmentStatus: "not_passed",
      onboardingStatus: false,
      completionPercentage: 41,
      completedItems: 14,
    });
    expect(stopped?.modules[13]?.status).toBe("completed");
    expect(stopped?.modules[14]?.status).toBe("not_started");
    expect(byNumber(participants, "SINT1-001")).toMatchObject({
      enrollmentStatus: "passed",
      onboardingStatus: true,
      completionPercentage: 100,
      completedItems: 34,
    });
  });

  it("kolom yang tidak diimpor tidak ikut ke hasil", () => {
    const json = JSON.stringify(participants);
    for (const value of ["Laki-laki", "Perempuan", "16Tahun", "17Tahun"]) {
      expect(json).not.toContain(value);
    }
  });

  it("#REF! di Cek Sync menjadi bendera formula_error, bukan angka", () => {
    const flagged = participants.filter((p) => p.qualityFlags.length > 0);
    expect(flagged.map((p) => [p.participantNumber, p.qualityFlags])).toEqual([
      ["SINT1-021", ["formula_error"]],
    ]);
  });

  it("PERSENTASE LMS konsisten untuk semua peserta", () => {
    expect(participants.some((p) => p.qualityFlags.includes("lms_mismatch"))).toBe(false);
  });

  it("baris 1 cocok dengan hitung ulang; TOTAL DITERIMA tidak direkonsiliasi", () => {
    const rec = reconcileRow1(meta, layout, participants);
    expect(rec.totals).toEqual([
      { label: "TOTAL PENDAFTAR", reported: 41, recounted: 41, status: "match" },
      {
        label: "TOTAL DITERIMA",
        reported: 41,
        recounted: null,
        status: "not_reconciled",
        note: "Arti TOTAL DITERIMA belum dikonfirmasi; angka ditampilkan apa adanya.",
      },
      { label: "TOTAL ONBOARDING", reported: 33, recounted: 33, status: "match" },
      { label: "TOTAL SELESAI", reported: 33, recounted: 33, status: "match" },
    ]);
    expect(rec.items).toHaveLength(34);
    expect(rec.items.every((i) => i.status === "match")).toBe(true);
    // KUIS 1: 33 lulus + 1 peserta yang berhenti di item ke-17.
    expect(rec.items[14]).toEqual({
      sequence: 15,
      moduleCode: "M15",
      reported: 34,
      recounted: 34,
      status: "match",
    });
    expect(rec.mismatches).toBe(0);
  });

  it("selisih jumlah per item dan label yang hilang dilaporkan", () => {
    const changed = [...meta];
    changed[layout.items[0]?.columnIndex ?? 0] = "40";
    changed[1] = "TOTAL PESERTA";
    const rec = reconcileRow1(changed, layout, participants);
    expect(rec.totals[0]).toEqual({
      label: "TOTAL PENDAFTAR",
      reported: null,
      recounted: 41,
      status: "missing",
      note: "Label TOTAL PENDAFTAR tidak ditemukan di baris 1.",
    });
    // Item pertama: 33 lulus + 2 peserta yang berhenti di tengah.
    expect(rec.items[0]).toMatchObject({ reported: 40, recounted: 35, status: "mismatch" });
    expect(rec.mismatches).toBe(2);
  });
});

describe("golden-2", () => {
  const { meta, layout, result } = load("golden-2");
  const { participants, ignoredRows } = result;

  it("51 peserta termasuk Pembatalan, 25 baris diabaikan", () => {
    expect(participants).toHaveLength(51);
    expect(ignoredRows).toHaveLength(25);
    expect(participants.flatMap((p) => p.modules)).toHaveLength(51 * 28);
  });

  it("judul ganda tetap menjadi dua item terpisah", () => {
    const [m22, m23] = participants[0]?.modules.slice(21, 23) ?? [];
    expect(m22).toMatchObject({
      moduleCode: "M22",
      moduleName: "MATERI 20: STUDI KASUS INSTALASI",
    });
    expect(m23).toMatchObject({
      moduleCode: "M23",
      moduleName: "MATERI 20: STUDI KASUS INSTALASI",
    });
  });

  it("baris Pembatalan: onboarding kosong, LMS 100 dengan 0 item, Error Sync", () => {
    const cancelled = byNumber(participants, "SINT2-051");
    expect(cancelled).toMatchObject({
      enrollmentStatus: "cancelled",
      onboardingStatus: null,
      completionPercentage: 100,
      completedItems: 0,
    });
    expect(cancelled?.qualityFlags).toEqual(["error_sync", "lms_mismatch"]);
    const others = participants.filter((p) => p !== cancelled);
    expect(others.every((p) => p.qualityFlags.length === 0)).toBe(true);
  });

  it("TOTAL PENDAFTAR 50 vs 51 baris dijelaskan oleh satu Pembatalan", () => {
    const rec = reconcileRow1(meta, layout, participants);
    expect(rec.totals[0]).toEqual({
      label: "TOTAL PENDAFTAR",
      reported: 50,
      recounted: 51,
      status: "explained",
      note: "Selisih 1 karena 1 baris Pembatalan.",
    });
    expect(rec.totals.slice(2).map((t) => t.status)).toEqual(["match", "match"]);
    expect(rec.mismatches).toBe(0);
  });
});
