// Adapter Google Sheets/Drive dengan MSW (tanpa akses Google sungguhan): token service account,
// respons divalidasi skema (SH-API-04), allowlist dan redirect (SH-API-02), retry terbatas.
import { createVerify, generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  GoogleTokenProvider,
  TOKEN_URL,
} from "@/modules/ingestion/infrastructure/google/service-account";
import {
  GoogleDriveMetadata,
  GoogleSheetSource,
} from "@/modules/ingestion/infrastructure/google/sheets";
import { SHEETS_DIR } from "../fixtures/golden/golden-sheets";
import { parseCsv } from "../support/csv";

const SHEET_ID = "1SintetisSpreadsheetIdUntukUji_ABCDEFG";
const SHEETS = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}`;
const TITLE = "Mirror DTA VBL 90109 SNWD 23 - 30 Sept";
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const account = {
  email: "ews-reader@proyek-sintetis.iam.gserviceaccount.com",
  privateKey: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
};
const golden = parseCsv(readFileSync(`${SHEETS_DIR}golden-1.csv`, "utf8"));
const sheet = {
  sourceType: "google_sheets" as const,
  reference: { spreadsheetId: SHEET_ID, gid: "509877154" },
};

let tokenRequests = 0;
let lastClaims: Record<string, unknown> = {};

function verifiedClaims(assertion: string) {
  const [header = "", claims = "", signature = ""] = assertion.split(".");
  const ok = createVerify("RSA-SHA256")
    .update(`${header}.${claims}`)
    .verify(publicKey, signature, "base64url");
  return ok
    ? (JSON.parse(Buffer.from(claims, "base64url").toString()) as Record<string, unknown>)
    : null;
}

const meta = {
  properties: { title: TITLE },
  sheets: [
    { properties: { sheetId: 0, title: "Ringkasan" } },
    { properties: { sheetId: 509877154, title: "ALL PENDAFTAR WEB" } },
  ],
};

const handlers = [
  http.post(TOKEN_URL, async ({ request }) => {
    tokenRequests++;
    const form = new URLSearchParams(await request.text());
    const claims = verifiedClaims(form.get("assertion") ?? "");
    if (!claims) return HttpResponse.json({ error: "invalid_grant" }, { status: 400 });
    lastClaims = claims;
    return HttpResponse.json({
      access_token: "token-sintetis",
      expires_in: 3600,
      token_type: "Bearer",
    });
  }),
  http.get(SHEETS, ({ request }) =>
    request.headers.get("authorization") === "Bearer token-sintetis"
      ? HttpResponse.json(meta)
      : HttpResponse.json({}, { status: 401 }),
  ),
  http.get(`${SHEETS}/values/:range`, ({ params }) =>
    params.range === "'ALL PENDAFTAR WEB'"
      ? HttpResponse.json({ range: params.range, values: golden })
      : HttpResponse.json({}, { status: 400 }),
  ),
  http.get(`https://www.googleapis.com/drive/v3/files/${SHEET_ID}`, () =>
    HttpResponse.json({ modifiedTime: "2026-10-13T04:43:00.000Z" }),
  ),
];

const server = setupServer(...handlers);
const source = () => new GoogleSheetSource(new GoogleTokenProvider(account), { maxRows: 5000 });

beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => {
  server.resetHandlers();
  tokenRequests = 0;
});
afterAll(() => server.close());

describe("GoogleSheetSource", () => {
  it("membaca tab sesuai gid dengan nilai FORMATTED_VALUE", async () => {
    expect(await source().readRows(sheet)).toEqual({ ok: true, rows: golden });
  });

  it("token: JWT ditandatangani, scope baca saja, dipakai ulang", async () => {
    const reader = source();
    await reader.readTitle(SHEET_ID);
    await reader.readRows(sheet);
    expect(tokenRequests).toBe(1);
    expect(lastClaims).toMatchObject({
      iss: account.email,
      aud: TOKEN_URL,
      scope:
        "https://www.googleapis.com/auth/spreadsheets.readonly " +
        "https://www.googleapis.com/auth/drive.metadata.readonly",
    });
  });

  it("judul spreadsheet", async () => {
    expect(await source().readTitle(SHEET_ID)).toEqual({ ok: true, title: TITLE });
  });

  it("tanpa gid: tab template dipilih; gid tidak ada: tidak ditemukan", async () => {
    const noGid = { ...sheet, reference: { spreadsheetId: SHEET_ID, gid: null } };
    expect((await source().readRows(noGid)).ok).toBe(true);
    const wrongGid = { ...sheet, reference: { spreadsheetId: SHEET_ID, gid: "1" } };
    expect(await source().readRows(wrongGid)).toEqual({ ok: false, error: "NOT_FOUND" });
  });

  it.each([
    [403, "PERMISSION_DENIED"],
    [404, "NOT_FOUND"],
  ])("HTTP %d → %s", async (status, error) => {
    server.use(http.get(SHEETS, () => HttpResponse.json({}, { status })));
    expect(await source().readRows(sheet)).toEqual({ ok: false, error });
  });

  it("respons yang tidak sesuai skema ditolak (SH-API-04)", async () => {
    server.use(
      http.get(SHEETS, () => HttpResponse.json({ properties: {}, sheets: "bukan daftar" })),
    );
    expect(await source().readRows(sheet)).toEqual({ ok: false, error: "UNAVAILABLE" });
    server.use(http.get(`${SHEETS}/values/:range`, () => HttpResponse.json({ values: [[1, 2]] })));
    server.use(http.get(SHEETS, () => HttpResponse.json(meta)));
    expect(await source().readRows(sheet)).toEqual({ ok: false, error: "UNAVAILABLE" });
  });

  it("retry terbatas: 503 sekali lalu berhasil; 503 terus = tidak tersedia", async () => {
    let calls = 0;
    server.use(
      http.get(SHEETS, () =>
        ++calls === 1 ? HttpResponse.json({}, { status: 503 }) : HttpResponse.json(meta),
      ),
    );
    expect((await source().readTitle(SHEET_ID)).ok).toBe(true);
    expect(calls).toBe(2);
    calls = 0;
    server.use(http.get(SHEETS, () => (calls++, HttpResponse.json({}, { status: 503 }))));
    expect(await source().readTitle(SHEET_ID)).toEqual({ ok: false, error: "UNAVAILABLE" });
    expect(calls).toBe(2);
  });

  it("redirect tidak diikuti (SH-API-02)", async () => {
    let followed = false;
    server.use(
      http.get(SHEETS, () => HttpResponse.redirect("https://evil.test/data", 302)),
      http.get("https://evil.test/data", () => ((followed = true), HttpResponse.json(meta))),
    );
    expect(await source().readTitle(SHEET_ID)).toEqual({ ok: false, error: "UNAVAILABLE" });
    expect(followed).toBe(false);
  });

  it("ID tidak valid tidak pernah dipakai menyusun URL", async () => {
    const bad = { ...sheet, reference: { spreadsheetId: "../../etc", gid: null } };
    expect(await source().readRows(bad)).toEqual({ ok: false, error: "NOT_FOUND" });
    expect(tokenRequests).toBe(0);
  });

  it("batas baris", async () => {
    const small = new GoogleSheetSource(new GoogleTokenProvider(account), { maxRows: 10 });
    expect(await small.readRows(sheet)).toEqual({ ok: false, error: "TOO_MANY_ROWS" });
  });

  it("token ditolak Google: sumber tidak tersedia", async () => {
    server.use(
      http.post(TOKEN_URL, () => HttpResponse.json({ error: "invalid_grant" }, { status: 400 })),
    );
    expect(await source().readTitle(SHEET_ID)).toEqual({ ok: false, error: "UNAVAILABLE" });
  });
});

describe("GoogleDriveMetadata", () => {
  it("modifiedTime divalidasi; respons rusak atau galat = null", async () => {
    const drive = new GoogleDriveMetadata(new GoogleTokenProvider(account));
    expect(await drive.modifiedTime(SHEET_ID)).toBe("2026-10-13T04:43:00.000Z");
    server.use(
      http.get(`https://www.googleapis.com/drive/v3/files/${SHEET_ID}`, () =>
        HttpResponse.json({ modifiedTime: "kemarin" }),
      ),
    );
    expect(await drive.modifiedTime(SHEET_ID)).toBeNull();
    expect(await drive.modifiedTime("bukan id")).toBeNull();
  });
});
