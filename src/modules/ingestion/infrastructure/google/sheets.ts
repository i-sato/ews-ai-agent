import { z } from "zod";
import type {
  DataSourceConfig,
  DriveMetadata,
  SheetRead,
  SheetSource,
} from "../../application/ports";
import { TARGET_SHEET } from "../files/xlsx-file";
import { type GoogleResult, requestJson } from "./http";
import type { GoogleTokenProvider } from "./service-account";

const SHEETS = "https://sheets.googleapis.com/v4/spreadsheets";
const DRIVE = "https://www.googleapis.com/drive/v3/files";
/** ID sudah divalidasi domain; dicek lagi sebelum menyusun URL (mencegah path injection). */
const FILE_ID = /^[A-Za-z0-9_-]{20,}$/;

const metadata = z.object({
  properties: z.object({ title: z.string() }),
  sheets: z.array(
    z.object({ properties: z.object({ sheetId: z.number().int(), title: z.string() }) }),
  ),
});

// FORMATTED_VALUE: teks seperti tampil di sheet (sama dengan ekspor CSV); formula tidak dieksekusi.
const values = z.object({ values: z.array(z.array(z.string())).optional() });

const driveFile = z.object({ modifiedTime: z.iso.datetime({ offset: true }) });

type Tab = z.infer<typeof metadata>["sheets"][number]["properties"];

/** Tab sesuai gid; tanpa gid: tab template, atau satu-satunya tab. Tidak menebak. */
function chooseTab(tabs: Tab[], gid: string | null): Tab | null {
  if (gid !== null) return tabs.find((t) => String(t.sheetId) === gid) ?? null;
  return (
    tabs.find((t) => t.title === TARGET_SHEET) ?? (tabs.length === 1 ? (tabs[0] as Tab) : null)
  );
}

export class GoogleSheetSource implements SheetSource {
  constructor(
    private readonly tokens: GoogleTokenProvider,
    private readonly limits: { maxRows: number },
  ) {}

  private async get<T>(url: string, schema: z.ZodType<T>): Promise<GoogleResult<T>> {
    const token = await this.tokens.token();
    if (!token.ok) return token;
    const init = { headers: { Authorization: `Bearer ${token.data}` } };
    return requestJson({ url, init, schema });
  }

  private meta(spreadsheetId: string) {
    const fields = "properties.title,sheets.properties(sheetId,title)";
    return this.get(`${SHEETS}/${spreadsheetId}?fields=${encodeURIComponent(fields)}`, metadata);
  }

  async readTitle(spreadsheetId: string) {
    if (!FILE_ID.test(spreadsheetId)) return { ok: false as const, error: "NOT_FOUND" as const };
    const meta = await this.meta(spreadsheetId);
    return meta.ok ? { ok: true as const, title: meta.data.properties.title } : meta;
  }

  async readRows(source: Pick<DataSourceConfig, "sourceType" | "reference">): Promise<SheetRead> {
    const ref = source.reference;
    if (!ref || !FILE_ID.test(ref.spreadsheetId)) return { ok: false, error: "NOT_FOUND" };
    const meta = await this.meta(ref.spreadsheetId);
    if (!meta.ok) return meta;
    const tab = chooseTab(
      meta.data.sheets.map((s) => s.properties),
      ref.gid,
    );
    if (!tab) return { ok: false, error: "NOT_FOUND" };
    const range = encodeURIComponent(`'${tab.title.replace(/'/g, "''")}'`);
    const query = "valueRenderOption=FORMATTED_VALUE&majorDimension=ROWS";
    const res = await this.get(`${SHEETS}/${ref.spreadsheetId}/values/${range}?${query}`, values);
    if (!res.ok) return res;
    const rows = res.data.values ?? [];
    if (rows.length > this.limits.maxRows) return { ok: false, error: "TOO_MANY_ROWS" };
    return { ok: true, rows };
  }
}

/** `modifiedTime` file (Drive API, `drive.metadata.readonly`); null bila tidak tersedia. */
export class GoogleDriveMetadata implements DriveMetadata {
  constructor(private readonly tokens: GoogleTokenProvider) {}

  async modifiedTime(fileId: string): Promise<string | null> {
    if (!FILE_ID.test(fileId)) return null;
    const token = await this.tokens.token();
    if (!token.ok) return null;
    const url = `${DRIVE}/${fileId}?fields=modifiedTime&supportsAllDrives=true`;
    const init = { headers: { Authorization: `Bearer ${token.data}` } };
    const res = await requestJson({ url, init, schema: driveFile });
    return res.ok ? res.data.modifiedTime : null;
  }
}

/** Google Sheets ke adapter Google; CSV/XLSX ke adapter file. Google null = belum dikonfigurasi. */
export class RoutingSheetSource implements SheetSource {
  constructor(
    private readonly google: SheetSource | null,
    private readonly files: SheetSource,
  ) {}

  readRows(source: Pick<DataSourceConfig, "sourceType" | "reference">, fileKey: string | null) {
    if (source.sourceType !== "google_sheets") return this.files.readRows(source, fileKey);
    return this.google ? this.google.readRows(source, null) : this.files.readRows(source, null);
  }

  readTitle(spreadsheetId: string) {
    return this.google ? this.google.readTitle(spreadsheetId) : this.files.readTitle(spreadsheetId);
  }
}
