// F2-06: ParseTrainingSource dan RegisterTraining (spesifikasi §3.7) dengan fake port.
import { describe, expect, it } from "vitest";
import { parseTrainingSource } from "@/modules/ingestion/application/parse-training-source";
import { registerTraining } from "@/modules/ingestion/application/register-training";
import {
  parseTrainingSourceOutput,
  registerTrainingOutput,
} from "@/modules/ingestion/application/schemas";
import {
  ADMIN,
  FakeAudit,
  FakeClock,
  FakeSheets,
  FakeTrainings,
  MANAGER,
  SHEET_URL,
  SPREADSHEET_ID,
  SeqIds,
  goldenRows,
} from "../support/ingestion-fakes";

const TITLE = "Mirror DTA VBL 90109 SNWD 23 - 30 Sept";
const PORTAL = "https://digitalent.komdigi.go.id/pelatihan/90109";

function deps() {
  const sheets = new FakeSheets();
  sheets.setRows(goldenRows("golden-1"));
  sheets.titles.set(SPREADSHEET_ID, TITLE);
  return {
    sheets,
    trainings: new FakeTrainings(),
    audit: new FakeAudit(),
    clock: new FakeClock(),
    ids: new SeqIds(),
  };
}

const confirmed = {
  spreadsheetUrl: SHEET_URL,
  portalUrl: PORTAL,
  year: 2026,
  teamCode: "DTA",
  name: "Pemrograman Web Sintetis",
  portalTrainingId: "90109",
  schemeCode: "SNWD",
  period: { start: "2026-09-23", end: "2026-09-30" },
  confirmed: true,
};

describe("ParseTrainingSource", () => {
  it("usulan dari judul sheet dan tautan portal, tanpa menulis", async () => {
    const d = deps();
    const result = await parseTrainingSource(
      d,
      { spreadsheetUrl: SHEET_URL, portalUrl: PORTAL },
      ADMIN,
    );
    if (!result.ok) throw new Error(result.error.message);
    expect(parseTrainingSourceOutput.parse(result.value)).toEqual(result.value);
    expect(result.value).toEqual({
      title: TITLE,
      spreadsheetId: SPREADSHEET_ID,
      gid: "0",
      teamCode: "DTA",
      portalTrainingId: "90109",
      schemeCode: "SNWD",
      period: { start: { day: 23, month: 9 }, end: { day: 30, month: 9 } },
      portalTrainingIdFromUrl: "90109",
      warnings: [],
    });
    expect(d.trainings.created).toHaveLength(0);
  });

  it("peringatan bila ID judul berbeda dengan ID portal", async () => {
    const other = "https://digitalent.komdigi.go.id/pelatihan/90107";
    const result = await parseTrainingSource(
      deps(),
      { spreadsheetUrl: SHEET_URL, portalUrl: other },
      ADMIN,
    );
    expect(result).toMatchObject({
      ok: true,
      value: { warnings: [expect.stringContaining("berbeda")] },
    });
  });

  it("tautan di luar allowlist, role, dan sheet tak terbaca", async () => {
    const d = deps();
    const evil =
      "https://docs.google.evil.test/spreadsheets/d/1SintetisSpreadsheetIdUntukUji_ABCDEFG";
    expect(await parseTrainingSource(d, { spreadsheetUrl: evil }, ADMIN)).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR" },
    });
    expect(
      await parseTrainingSource(
        d,
        { spreadsheetUrl: SHEET_URL, portalUrl: "https://contoh.invalid/pelatihan/1" },
        ADMIN,
      ),
    ).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
    expect(await parseTrainingSource(d, { spreadsheetUrl: SHEET_URL }, MANAGER)).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
    d.sheets.readError = "PERMISSION_DENIED";
    expect(await parseTrainingSource(d, { spreadsheetUrl: SHEET_URL }, ADMIN)).toMatchObject({
      ok: false,
      error: { code: "SOURCE_UNAVAILABLE" },
    });
  });
});

describe("RegisterTraining", () => {
  it("menyimpan pelatihan dan sumber dengan konfirmasi dari aktor dan jam server", async () => {
    const d = deps();
    const result = await registerTraining(d, confirmed, ADMIN);
    if (!result.ok) throw new Error(result.error.message);
    expect(registerTrainingOutput.parse(result.value)).toEqual(result.value);
    expect(result.value).toMatchObject({ code: "DTA-90109", warnings: [] });
    const [created] = d.trainings.created;
    expect(created?.training).toMatchObject({
      code: "DTA-90109",
      portalTrainingId: "90109",
      idConfirmedBy: ADMIN.id,
      idConfirmedAt: "2026-10-13T05:00:00.000Z",
      startDate: "2026-09-23",
      endDate: "2026-09-30",
    });
    expect(created?.source).toMatchObject({ spreadsheetId: SPREADSHEET_ID, gid: "0" });
    expect(d.audit.entries).toMatchObject([{ action: "training.register", actorId: ADMIN.id }]);
  });

  it("tanpa konfirmasi atau dengan field konfirmasi dari klien ditolak", async () => {
    const d = deps();
    const unconfirmed = Object.fromEntries(
      Object.entries(confirmed).filter(([k]) => k !== "confirmed"),
    );
    expect(await registerTraining(d, unconfirmed, ADMIN)).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR" },
    });
    const spoofed = { ...confirmed, id_confirmed_by: MANAGER.id };
    expect(await registerTraining(d, spoofed, ADMIN)).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR" },
    });
    expect(await registerTraining(d, confirmed, MANAGER)).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
    expect(d.trainings.created).toHaveLength(0);
  });

  it("ID portal yang sudah dipakai ditolak dan diarahkan ke pelatihan yang ada", async () => {
    const d = deps();
    d.trainings.byPortal.set("90109", {
      id: "00000000-0000-4000-8000-000000000555",
      code: "DTA-90109",
    });
    expect(await registerTraining(d, confirmed, ADMIN)).toMatchObject({
      ok: false,
      error: {
        code: "CONFLICT",
        details: { existingTrainingId: "00000000-0000-4000-8000-000000000555" },
      },
    });
  });

  it("peringatan bila ID terkonfirmasi atau judul berbeda dengan ID portal", async () => {
    const other = { ...confirmed, portalUrl: "https://digitalent.komdigi.go.id/pelatihan/90107" };
    const result = await registerTraining(deps(), other, ADMIN);
    expect(result).toMatchObject({
      ok: true,
      value: { warnings: [expect.stringContaining("berbeda")] },
    });
  });

  it("tim/tahun belum terdaftar, periode terbalik, dan tata letak sheet tidak sesuai", async () => {
    const d = deps();
    expect(await registerTraining(d, { ...confirmed, year: 2027 }, ADMIN)).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR" },
    });
    const reversed = { ...confirmed, period: { start: "2026-09-30", end: "2026-09-23" } };
    expect(await registerTraining(d, reversed, ADMIN)).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR" },
    });
    const rows = goldenRows("golden-1");
    rows[1] = (rows[1] ?? []).filter((h) => h !== "PERSENTASE LMS");
    d.sheets.setRows(rows);
    expect(await registerTraining(d, confirmed, ADMIN)).toMatchObject({
      ok: false,
      error: { code: "BLOCKED", details: { layoutError: "MISSING_COLUMN" } },
    });
    expect(d.trainings.created).toHaveLength(0);
  });
});
