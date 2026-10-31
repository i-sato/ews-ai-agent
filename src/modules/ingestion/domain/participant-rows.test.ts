import { describe, expect, it } from "vitest";
import { normalizeParticipants } from "./participant-rows";
import { type SheetLayout, detectLayout } from "./sheet-layout";

const HEADERS = [
  "NAMA",
  "NO REGISTRASI",
  "INSTANSI",
  "STATUS",
  "ONBOARDING",
  "PERSENTASE LMS",
  "OVERVIEW",
  "",
  "KUIS 1",
  "Cek Sync",
];

function layoutOf(headers: string[]): SheetLayout {
  const detected = detectLayout(headers);
  if (!detected.ok) throw new Error(detected.error.code);
  return detected.layout;
}

const LAYOUT = layoutOf(HEADERS);
const PASSED = "Lulus Pelatihan - Nilai";

function row(over: Partial<Record<string, string>> = {}): string[] {
  const base: Record<string, string> = {
    NAMA: "Peserta Uji",
    "NO REGISTRASI": "UJI-001",
    INSTANSI: "Instansi Uji",
    STATUS: PASSED,
    ONBOARDING: "Onboarding",
    "PERSENTASE LMS": "100",
    OVERVIEW: "Selesai",
    "": "Belum Mengerjakan",
    "KUIS 1": "Selesai",
    "Cek Sync": "OK",
  };
  return HEADERS.map((h) => over[h] ?? base[h] ?? "");
}

const normalize = (rows: string[][], tolerance = 1) =>
  normalizeParticipants(rows, LAYOUT, { lmsTolerancePp: tolerance });

describe("normalizeParticipants", () => {
  it("baris bersih tanpa bendera; slot tanpa judul diabaikan", () => {
    const [p] = normalize([row()]).participants;
    expect(p?.qualityFlags).toEqual([]);
    expect(p?.modules.map((m) => m.moduleCode)).toEqual(["M01", "M02"]);
    expect(p?.modules[0]).toEqual({
      sequence: 1,
      moduleCode: "M01",
      moduleName: "OVERVIEW",
      moduleType: "overview",
      status: "completed",
    });
  });

  it("nomor baris mulai dari baris 3 dan bisa diatur", () => {
    const rows = [row(), row({ "NO REGISTRASI": " " }), row({ "NO REGISTRASI": "UJI-002" })];
    expect(normalize(rows).ignoredRows).toEqual([4]);
    const custom = normalizeParticipants(rows, LAYOUT, { lmsTolerancePp: 1, firstDataRow: 10 });
    expect(custom.participants.map((p) => p.rowNumber)).toEqual([10, 12]);
  });

  it("identitas dirapikan dan nomor disimpan sebagai string", () => {
    const [p] = normalize([
      row({ NAMA: "  Peserta   Uji ", "NO REGISTRASI": " 007-01 " }),
    ]).participants;
    expect(p).toMatchObject({ participantName: "Peserta Uji", participantNumber: "007-01" });
  });

  it("LMS kosong menjadi null, bukan 0, dan tidak dianggap tidak konsisten", () => {
    const [p] = normalize([row({ "PERSENTASE LMS": "" })]).participants;
    expect(p?.completionPercentage).toBeNull();
    expect(p?.qualityFlags).toEqual([]);
  });

  it("galat formula di LMS, status, atau item", () => {
    const flags = (over: Partial<Record<string, string>>) =>
      normalize([row(over)]).participants[0]?.qualityFlags;
    expect(flags({ "PERSENTASE LMS": "#REF!" })).toEqual(["formula_error"]);
    expect(flags({ STATUS: "#N/A" })).toEqual(["formula_error", "unmapped_status"]);
    expect(flags({ "KUIS 1": "#VALUE!" })).toEqual(["formula_error", "unknown_item_status"]);
    expect(flags({ "Cek Sync": "#REF!" })).toEqual(["formula_error"]);
    expect(flags({ "Cek Sync": "Error Sync" })).toEqual(["error_sync"]);
  });

  it("LMS di luar 0–100 atau bukan angka", () => {
    const [p] = normalize([row({ "PERSENTASE LMS": "120" })]).participants;
    expect(p).toMatchObject({ completionPercentage: null, qualityFlags: ["lms_invalid"] });
  });

  it("toleransi konsistensi LMS dari konfigurasi", () => {
    const half = { OVERVIEW: "Selesai", "KUIS 1": "Belum Mengerjakan" };
    expect(
      normalize([row({ ...half, "PERSENTASE LMS": "51" })]).participants[0]?.qualityFlags,
    ).toEqual([]);
    expect(
      normalize([row({ ...half, "PERSENTASE LMS": "51,5" })]).participants[0]?.qualityFlags,
    ).toEqual(["lms_mismatch"]);
    expect(
      normalize([row({ ...half, "PERSENTASE LMS": "53" })], 5).participants[0]?.qualityFlags,
    ).toEqual([]);
  });

  it("status sumber tak dikenal dan status item tak dikenal", () => {
    const [p] = normalize([
      row({ STATUS: "Sedang Berjalan", "KUIS 1": "Dikerjakan" }),
    ]).participants;
    expect(p).toMatchObject({ sourceStatus: "Sedang Berjalan", enrollmentStatus: "unmapped" });
    expect(p?.modules[1]?.status).toBe("unknown");
    expect(p?.qualityFlags).toEqual(["unmapped_status", "unknown_item_status"]);
  });

  it("pemetaan status dari konfigurasi sumber", () => {
    const [p] = normalizeParticipants([row({ STATUS: "Sedang Berjalan" })], LAYOUT, {
      lmsTolerancePp: 1,
      statusMapping: { "sedang berjalan": "not_passed" },
    }).participants;
    expect(p?.enrollmentStatus).toBe("not_passed");
  });

  it("semua baris dengan nomor registrasi sama ditandai duplikat", () => {
    const rows = [row(), row({ "NO REGISTRASI": "UJI-002" }), row({ "NO REGISTRASI": " UJI-001" })];
    const flags = normalize(rows).participants.map((p) => p.qualityFlags);
    expect(flags).toEqual([["duplicate_participant"], [], ["duplicate_participant"]]);
  });

  it("baris lebih pendek dari header dibaca sebagai sel kosong", () => {
    const short = row().slice(0, 3);
    const [p] = normalize([short]).participants;
    expect(p).toMatchObject({
      sourceStatus: "",
      enrollmentStatus: "unmapped",
      completionPercentage: null,
    });
  });
});

describe("konsistensi LMS dengan item tak dikenal", () => {
  it("tidak dinilai karena rasio tidak dapat diverifikasi", () => {
    const [p] = normalize([row({ "KUIS 1": "Dikerjakan", "PERSENTASE LMS": "0" })]).participants;
    expect(p?.qualityFlags).toEqual(["unknown_item_status"]);
  });
});
