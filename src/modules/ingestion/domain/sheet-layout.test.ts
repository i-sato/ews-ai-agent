import { describe, expect, it } from "vitest";
import { detectLayout } from "./sheet-layout";

const IDENTITY = [
  "NAMA",
  "NO REGISTRASI",
  "INSTANSI",
  "JENIS KELAMIN",
  "USIA",
  "ADA DI USULAN MITRA",
  "STATUS",
  "ONBOARDING",
  "PERSENTASE LMS",
];

const header = (items: string[], closing = "Cek Sync", trailing: string[] = []) => [
  ...IDENTITY,
  ...items,
  closing,
  ...trailing,
];

describe("detectLayout", () => {
  it("mendeteksi item sampai Cek Sync dan mengabaikan slot kosong", () => {
    const r = detectLayout(
      header(["OVERVIEW", "VIDEO: README", "", "KUIS 1", "", "FINAL ASSESSMENT"]),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.layout.items.map((i) => i.code)).toEqual(["M01", "M02", "M03", "M04"]);
    expect(r.layout.items.map((i) => i.type)).toEqual([
      "overview",
      "video",
      "quiz",
      "final_assessment",
    ]);
    expect(r.layout.emptySlots).toBe(2);
    expect(r.layout.range).toEqual({ from: "J", to: "O" });
  });

  it("menerima Cek Sync dengan huruf dan spasi berbeda serta jumlah item > 42", () => {
    const items = Array.from({ length: 50 }, (_, i) => `Materi ${i + 1}`);
    const r = detectLayout(header(items, "  CEK   sync "));
    expect(r.ok && r.layout.items.length).toBe(50);
  });

  it("mengenali kolom identitas dari nama header, bukan posisi", () => {
    const shuffled = ["NO REGISTRASI", ...IDENTITY.filter((h) => h !== "NO REGISTRASI")];
    const r = detectLayout([...shuffled, "Materi A", "Cek Sync"]);
    expect(r.ok && r.layout.identity.participantNumber).toBe(0);
  });

  it("memakai alias header yang dikonfigurasi", () => {
    const renamed = IDENTITY.map((h) => (h === "INSTANSI" ? "Asal Instansi" : h));
    const r = detectLayout([...renamed, "Materi A", "Cek Sync"], {
      organization: ["asal instansi"],
    });
    expect(r.ok).toBe(true);
  });

  it("menandai judul ganda dan mendekode entitas HTML", () => {
    const r = detectLayout(header(["Desain &AMP; Kode", "Latihan", "latihan"]));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.layout.items[0]?.title).toBe("Desain & Kode");
    expect(r.layout.items[0]?.sourceTitle).toBe("Desain &AMP; Kode");
    expect(r.layout.items.filter((i) => i.duplicateTitle)).toHaveLength(2);
  });

  it("melaporkan kolom setelah Cek Sync", () => {
    const r = detectLayout(header(["Materi A"], "Cek Sync", ["Catatan"]));
    expect(r.ok && r.layout.trailingColumns).toBe(1);
  });

  it.each([
    ["CEK_SYNC_MISSING", [...IDENTITY, "Materi A"]],
    ["CEK_SYNC_DUPLICATE", header(["Materi A", "Cek Sync", "Materi B"])],
    ["CEK_SYNC_BEFORE_LMS", ["Cek Sync", ...IDENTITY, "Materi A"]],
    ["ITEM_RANGE_EMPTY", header(["", " "])],
    ["MISSING_COLUMN", header(["Materi A"]).filter((h) => h !== "STATUS")],
  ])("berhenti tanpa menebak: %s", (code, headers) => {
    const r = detectLayout(headers);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe(code);
  });
});
