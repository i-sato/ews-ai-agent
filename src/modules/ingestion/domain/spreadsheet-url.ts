export const SHEETS_HOST = "docs.google.com";

export interface SpreadsheetRef {
  spreadsheetId: string;
  gid: string | null;
}

const PATH = /^\/spreadsheets\/d\/([A-Za-z0-9_-]{20,})(?:\/|$)/;

/**
 * ID spreadsheet dan gid dari tautan Google Sheets. Hanya `https://docs.google.com` tanpa port
 * (allowlist host, SH-API-02); selain itu null.
 */
export function parseSpreadsheetUrl(raw: string): SpreadsheetRef | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.hostname !== SHEETS_HOST || url.port !== "") return null;
  const m = PATH.exec(url.pathname);
  if (!m) return null;
  const gid = /(?:^|[#&?])gid=(\d+)/.exec(`${url.search}${url.hash}`)?.[1] ?? null;
  return { spreadsheetId: m[1] as string, gid };
}
