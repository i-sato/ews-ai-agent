// Golden dataset SINTETIS (F2-05): meniru struktur dua sheet contoh di spesifikasi §3.2.3.
// Semua nama, nomor registrasi, instansi, dan judul fiktif. Nomor registrasi sengaja TIDAK
// berpola 12 digit-1/2 digit. Tulis ulang file: `pnpm fixtures:golden`.
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

type Outcome =
  { kind: "passed" } | { kind: "not_passed"; completed: number } | { kind: "cancelled" };

export type GoldenExpected = {
  participants: number;
  ignoredRows: number;
  items: number;
  emptySlots: number;
  itemRange: { from: string; to: string; cekSync: string };
  itemTypes: Record<"overview" | "material" | "video" | "quiz" | "final_assessment", number>;
  duplicateTitleColumns: string[];
  entityTitles: number;
  titleLength: { min: number; max: number };
  status: { passed: number; not_passed: number; cancelled: number; unmapped: number };
  notPassed: { notStarted: number; stoppedMidway: number; stopAtItems: number[] };
  lmsConflicts: number;
  cekSync: { formulaError: number; errorSync: number };
  totalsRow1: { pendaftar: number; diterima: number; onboarding: number; selesai: number };
  titleProposal: { teamCode: string; portalTrainingId: string; schemeCode: string };
  updateLabel: { day: number; month: number; time: string };
};

export type GoldenSheet = {
  key: string;
  spreadsheetTitle: string;
  tab: string;
  updateLabel: string;
  regPrefix: string;
  organization: string;
  items: string[];
  outcomes: Outcome[];
  refErrorAt: number | null;
  expected: GoldenExpected;
};

export const SLOT_COUNT = 42;
export const BLANK_ROWS = 25;
export const TEAM_CODES = ["DTA", "GTA", "KDD"];
export const IDENTITY_HEADERS = [
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
export const SOURCE_STATUS = {
  passed: "Lulus Pelatihan - Nilai",
  not_passed: "Tidak Lulus Pelatihan - Nilai",
  cancelled: "Pembatalan",
} as const;

const DONE = "Selesai";
const NOT_DONE = "Belum Mengerjakan";

/** Rencana baris peserta: semua lulus kecuali indeks yang disebut. */
function plan(total: number, exceptions: Record<number, Outcome>): Outcome[] {
  return Array.from({ length: total }, (_, i) => exceptions[i] ?? { kind: "passed" });
}

const notStarted: Outcome = { kind: "not_passed", completed: 0 };

const SHEET_1_ITEMS = [
  "OVERVIEW PELATIHAN",
  "MATERI 1: PENGANTAR WEB",
  "MATERI 2: STRUKTUR DOKUMEN HTML",
  "VIDEO: MENYIAPKAN EDITOR KODE",
  "MATERI 3: HTML &AMP; CSS DASAR",
  "MATERI 4: TATA LETAK FLEXBOX",
  "MATERI 5: TATA LETAK GRID",
  "VIDEO: MEMBUAT HALAMAN PROFIL",
  "MATERI 6: JAVASCRIPT DASAR",
  "MATERI 7: DOM DAN EVENT",
  "MATERI 8: FORMULIR, VALIDASI, DAN AKSESIBILITAS",
  "MATERI 9: GIT &AMP; REPOSITORI",
  "MATERI 10: MENULIS DOKUMENTASI",
  "VIDEO: README",
  "KUIS 1",
  "MATERI 11: FETCH API",
  "MATERI 12: PENANGANAN GALAT",
  "MATERI 13: MODUL JAVASCRIPT",
  "VIDEO: MENGHUBUNGKAN API",
  "MATERI 14: PENYIMPANAN LOKAL",
  "MATERI 15: DESAIN RESPONSIF",
  "KUIS 2",
  "MATERI 16: PENGUJIAN SEDERHANA",
  "MATERI 17: OPTIMASI ASET",
  "VIDEO: MENERBITKAN SITUS",
  "MATERI 18: KEAMANAN DASAR WEB",
  "MATERI 19: PRAKTIK MEMBANGUN APLIKASI WEB SEDERHANA DARI PERANCANGAN HINGGA PENERBITAN SECARA BERTAHAP.",
  "MATERI 20: KOLABORASI TIM",
  "MATERI 21: ETIKA DIGITAL",
  "MATERI 22: PORTOFOLIO",
  "MATERI 23: PERSIAPAN PROYEK AKHIR",
  "KUIS 3",
  "MATERI 24: PROYEK AKHIR",
  "FINAL ASSESSMENT",
];

const SHEET_2_ITEMS = [
  "MATERI 1: PENGENALAN SERAT OPTIK",
  "MATERI 2: KESELAMATAN KERJA",
  "MATERI 3: JENIS KABEL",
  "MATERI 4: ALAT KERJA",
  "MATERI 5: KONEKTOR",
  "MATERI 6: PENYAMBUNGAN",
  "MATERI 7: PENGUKURAN DAYA",
  "KUIS 1",
  "MATERI 8: OTDR DASAR",
  "MATERI 9: JALUR KABEL UDARA",
  "MATERI 10: JALUR KABEL TANAM",
  "MATERI 11: TERMINASI",
  "MATERI 12: DOKUMENTASI LAPANGAN",
  "MATERI 13: PERAWATAN JARINGAN",
  "MATERI 14: PENANGANAN GANGGUAN",
  "KUIS 2",
  "MATERI 15: STANDAR INSTALASI",
  "MATERI 16: PERHITUNGAN REDAMAN",
  "MATERI 17: SPLITTER",
  "MATERI 18: PERENCANAAN SEDERHANA",
  "MATERI 19: KERJA SAMA TIM",
  "MATERI 20: STUDI KASUS INSTALASI",
  "MATERI 20: STUDI KASUS INSTALASI",
  "MATERI 21: PRAKTIK INSTALASI KABEL SERAT OPTIK DARI TIANG KE RUMAH PELANGGAN TERMASUK PENGUKURAN, PENCATATAN HASIL, DAN PEMERIKSAAN KESELAMATAN SEBELUM SERAH TERIMA",
  "MATERI 22: EVALUASI MANDIRI",
  "KUIS 3",
  "MATERI 23: PERSIAPAN UJI",
  "FINAL ASSESSMENT",
];

export const GOLDEN_SHEETS: GoldenSheet[] = [
  {
    key: "golden-1",
    spreadsheetTitle: "Mirror DTA VBL 90109 SNWD 23 - 30 Sept",
    tab: "ALL PENDAFTAR WEB",
    updateLabel: "UPDATE TERAKHIR: 13 OKTOBER 11:43 WIB",
    regPrefix: "SINT1",
    organization: "SMK Sintetis Nusantara Satu",
    items: SHEET_1_ITEMS,
    outcomes: plan(41, {
      3: notStarted,
      9: notStarted,
      12: { kind: "not_passed", completed: 14 },
      15: notStarted,
      21: notStarted,
      27: notStarted,
      33: notStarted,
      38: { kind: "not_passed", completed: 16 },
    }),
    refErrorAt: 20,
    expected: {
      participants: 41,
      ignoredRows: BLANK_ROWS,
      items: 34,
      emptySlots: 8,
      itemRange: { from: "J", to: "AY", cekSync: "AZ" },
      itemTypes: { overview: 1, material: 24, video: 5, quiz: 3, final_assessment: 1 },
      duplicateTitleColumns: [],
      entityTitles: 2,
      titleLength: { min: 6, max: 103 },
      status: { passed: 33, not_passed: 8, cancelled: 0, unmapped: 0 },
      notPassed: { notStarted: 6, stoppedMidway: 2, stopAtItems: [15, 17] },
      lmsConflicts: 0,
      cekSync: { formulaError: 1, errorSync: 0 },
      totalsRow1: { pendaftar: 41, diterima: 41, onboarding: 33, selesai: 33 },
      titleProposal: { teamCode: "DTA", portalTrainingId: "90109", schemeCode: "SNWD" },
      updateLabel: { day: 13, month: 10, time: "11:43" },
    },
  },
  {
    key: "golden-2",
    spreadsheetTitle: "MIRROR - DTA VBL 90107 SNAT 10 -31 Agustus",
    tab: "ALL PENDAFTAR WEB",
    updateLabel: "UPDATE TERAKHIR: 2 SEPTEMBER 11:00 WIB",
    regPrefix: "SINT2",
    organization: "SMK Sintetis Nusantara Dua",
    items: SHEET_2_ITEMS,
    outcomes: plan(51, {
      5: notStarted,
      17: notStarted,
      24: { kind: "not_passed", completed: 2 },
      29: notStarted,
      41: notStarted,
      50: { kind: "cancelled" },
    }),
    refErrorAt: null,
    expected: {
      participants: 51,
      ignoredRows: BLANK_ROWS,
      items: 28,
      emptySlots: 14,
      itemRange: { from: "J", to: "AY", cekSync: "AZ" },
      itemTypes: { overview: 0, material: 24, video: 0, quiz: 3, final_assessment: 1 },
      duplicateTitleColumns: ["AE", "AF"],
      entityTitles: 0,
      titleLength: { min: 6, max: 164 },
      status: { passed: 45, not_passed: 5, cancelled: 1, unmapped: 0 },
      notPassed: { notStarted: 4, stoppedMidway: 1, stopAtItems: [3] },
      lmsConflicts: 1,
      cekSync: { formulaError: 0, errorSync: 1 },
      totalsRow1: { pendaftar: 50, diterima: 50, onboarding: 45, selesai: 45 },
      titleProposal: { teamCode: "DTA", portalTrainingId: "90107", schemeCode: "SNAT" },
      updateLabel: { day: 2, month: 9, time: "11:00" },
    },
  },
];

function completedOf(outcome: Outcome, itemCount: number): number {
  if (outcome.kind === "passed") return itemCount;
  return outcome.kind === "not_passed" ? outcome.completed : 0;
}

function participantRow(sheet: GoldenSheet, outcome: Outcome, index: number): string[] {
  const n = String(index + 1).padStart(3, "0");
  const done = completedOf(outcome, sheet.items.length);
  // Baris Pembatalan meniru konflik contoh 2: LMS 100 tetapi 0 item selesai.
  const lms = outcome.kind === "cancelled" ? 100 : Math.round((done / sheet.items.length) * 100);
  const onboarding = { passed: "Onboarding", not_passed: "Tidak Onboarding", cancelled: "" };
  const slots = Array.from({ length: SLOT_COUNT }, (_, i) =>
    i < sheet.items.length && i < done ? DONE : NOT_DONE,
  );
  let cekSync = index === sheet.refErrorAt ? "#REF!" : "OK";
  if (outcome.kind === "cancelled") cekSync = "Error Sync";
  return [
    `Peserta Sintetis ${sheet.regPrefix.slice(-1)}-${n}`,
    `${sheet.regPrefix}-${n}`,
    sheet.organization,
    index % 2 === 0 ? "Laki-laki" : "Perempuan",
    index % 3 === 0 ? "16Tahun" : "17Tahun",
    "FALSE",
    SOURCE_STATUS[outcome.kind],
    onboarding[outcome.kind],
    String(lms),
    ...slots,
    cekSync,
  ];
}

/** Baris tanpa identitas yang hanya berisi nilai bawaan formula. */
function blankRow(): string[] {
  return ["", "", "", "", "", "FALSE", "", "", "0", ...Array(SLOT_COUNT).fill(NOT_DONE), "OK"];
}

function metadataRow(sheet: GoldenSheet, participants: string[][]): string[] {
  const t = sheet.expected.totalsRow1;
  const firstSlot = IDENTITY_HEADERS.length;
  const perItem = Array.from({ length: SLOT_COUNT }, (_, i) =>
    i < sheet.items.length
      ? String(participants.filter((r) => r[firstSlot + i] === DONE).length)
      : "0",
  );
  return [
    sheet.updateLabel,
    "TOTAL PENDAFTAR",
    String(t.pendaftar),
    "TOTAL DITERIMA",
    String(t.diterima),
    "TOTAL ONBOARDING",
    String(t.onboarding),
    "TOTAL SELESAI",
    String(t.selesai),
    ...perItem,
    "",
  ];
}

export function buildSheetRows(sheet: GoldenSheet): string[][] {
  const header = [
    ...IDENTITY_HEADERS,
    ...Array.from({ length: SLOT_COUNT }, (_, i) => sheet.items[i] ?? ""),
    "Cek Sync",
  ];
  const participants = sheet.outcomes.map((o, i) => participantRow(sheet, o, i));
  const blanks = Array.from({ length: BLANK_ROWS }, blankRow);
  return [metadataRow(sheet, participants), header, ...participants, ...blanks];
}

function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(rows: string[][]): string {
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/** Isi file yang di-commit di tests/fixtures/sheets/. */
export function goldenFiles(): Record<string, string> {
  const files: Record<string, string> = {};
  for (const sheet of GOLDEN_SHEETS) {
    files[`${sheet.key}.csv`] = toCsv(buildSheetRows(sheet));
    const meta = { spreadsheetTitle: sheet.spreadsheetTitle, tab: sheet.tab };
    files[`${sheet.key}.expected.json`] =
      JSON.stringify({ ...meta, ...sheet.expected }, null, 2) + "\n";
  }
  return files;
}

export const SHEETS_DIR = fileURLToPath(new URL("../sheets/", import.meta.url));

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  mkdirSync(SHEETS_DIR, { recursive: true });
  for (const [name, content] of Object.entries(goldenFiles())) {
    writeFileSync(`${SHEETS_DIR}${name}`, content);
  }
}
