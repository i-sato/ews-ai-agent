// Ujung ke ujung dengan sumber Google Sheets: RegisterTraining → SyncSheet terjadwal lewat container,
// Google ditiru MSW, Supabase lokal sungguhan. Butuh `supabase start` dan `pnpm db:env`.
import { generateKeyPairSync, randomInt } from "node:crypto";
import { readFileSync } from "node:fs";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ingestionDeps } from "@/lib/container";
import { registerTraining } from "@/modules/ingestion/application/register-training";
import { syncSheet } from "@/modules/ingestion/application/sync-sheet";
import { SHEETS_DIR } from "../fixtures/golden/golden-sheets";
import { parseCsv } from "../support/csv";
import {
  TEST_USERS,
  adminClient,
  ensureTestUser,
  localSupabaseEnv,
} from "../support/local-supabase";

const SHEET_ID = `1SintetisGoogleSync_${randomInt(10 ** 9, 10 ** 10)}`;
const PORTAL = String(randomInt(100000, 999999));
const golden = parseCsv(readFileSync(`${SHEETS_DIR}golden-1.csv`, "utf8"));

const server = setupServer(
  http.post("https://oauth2.googleapis.com/token", () =>
    HttpResponse.json({ access_token: "token-sintetis", expires_in: 3600, token_type: "Bearer" }),
  ),
  http.get(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}`, () =>
    HttpResponse.json({
      properties: { title: `Mirror DTA VBL ${PORTAL} SNWD 23 - 30 Sept` },
      sheets: [{ properties: { sheetId: 0, title: "ALL PENDAFTAR WEB" } }],
    }),
  ),
  http.get(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/:range`, () =>
    HttpResponse.json({ values: golden }),
  ),
  http.get(`https://www.googleapis.com/drive/v3/files/${SHEET_ID}`, () =>
    HttpResponse.json({ modifiedTime: "2026-10-13T04:43:00.000Z" }),
  ),
);

let admin: { id: string; role: "admin" };

beforeAll(async () => {
  localSupabaseEnv();
  process.env.IMPORT_STAGING_TTL_MINUTES = "30";
  process.env.MANUAL_SYNC_MIN_INTERVAL_MINUTES = "10";
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "ews-reader@proyek-sintetis.iam.gserviceaccount.com";
  process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = privateKey
    .export({ type: "pkcs8", format: "pem" })
    .toString();
  // Hanya host Google yang ditiru; permintaan ke Supabase lokal diteruskan.
  server.listen({ onUnhandledFrame: "bypass" });
  admin = { id: await ensureTestUser(TEST_USERS.admin), role: "admin" };
});

afterAll(() => server.close());

describe("sumber Google Sheets", () => {
  let sourceId: string;

  it("Admin mendaftarkan pelatihan dari tautan sheet", async () => {
    const deps = await ingestionDeps(null);
    const result = await registerTraining(
      deps,
      {
        spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit#gid=0`,
        portalUrl: `https://digitalent.komdigi.go.id/pelatihan/${PORTAL}`,
        year: 2026,
        teamCode: "DTA",
        name: "Pelatihan Sintetis Google",
        portalTrainingId: PORTAL,
        period: { start: "2026-09-23", end: "2026-09-30" },
        confirmed: true,
      },
      admin,
    );
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value).toMatchObject({ code: `DTA-${PORTAL}`, warnings: [] });
    sourceId = result.value.sourceId;
  });

  it("sinkron terjadwal meng-commit, lalu isi sama = tidak berubah", async () => {
    const deps = await ingestionDeps(null);
    const first = await syncSheet(deps, { sourceId, trigger: "scheduled" }, null);
    expect(first).toMatchObject({
      ok: true,
      value: { status: "committed", freshness: { sourceUpdatedAt: "2026-10-13T04:43:00.000Z" } },
    });
    const second = await syncSheet(deps, { sourceId, trigger: "scheduled" }, null);
    expect(second).toMatchObject({ ok: true, value: { status: "unchanged" } });
    const { data } = await adminClient()
      .from("data_sources")
      .select("last_fetched_at, source_modified_at")
      .eq("id", sourceId)
      .single();
    expect(data?.source_modified_at).toBe("2026-10-13T04:43:00+00:00");
    expect(data?.last_fetched_at).not.toBeNull();
  });
});
