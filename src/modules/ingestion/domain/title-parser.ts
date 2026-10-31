import { parseMonth } from "@/modules/shared/domain/indonesian-months";

export interface DayMonth {
  day: number;
  month: number;
}

/** Usulan dari judul spreadsheet. Wajib dikonfirmasi Admin sebelum disimpan (spesifikasi §3.7). */
export interface TitleProposal {
  teamCode: string | null;
  portalTrainingId: string | null;
  schemeCode: string | null;
  period: { start: DayMonth; end: DayMonth } | null;
}

const PERIOD = /(\d{1,2})\s*([A-Za-z]{3,}\.?)?\s*-\s*(\d{1,2})\s*([A-Za-z]{3,}\.?)/;

function parsePeriod(title: string): TitleProposal["period"] {
  const m = PERIOD.exec(title);
  if (!m) return null;
  const endMonth = parseMonth(m[4] ?? "");
  if (!endMonth) return null;
  const startMonth = m[2] ? parseMonth(m[2]) : endMonth;
  if (!startMonth) return null;
  return {
    start: { day: Number(m[1]), month: startMonth },
    end: { day: Number(m[3]), month: endMonth },
  };
}

export function parseSpreadsheetTitle(title: string, teamCodes: readonly string[]): TitleProposal {
  const tokens = title.split(/[\s\-_]+/).filter(Boolean);
  const upperTeams = teamCodes.map((c) => c.toUpperCase());
  const teamCode = tokens.map((t) => t.toUpperCase()).find((t) => upperTeams.includes(t)) ?? null;
  const idIndex = tokens.findIndex((t) => /^\d{4,6}$/.test(t));
  const portalTrainingId = idIndex >= 0 ? (tokens[idIndex] as string) : null;
  const next = idIndex >= 0 ? tokens[idIndex + 1] : undefined;
  const schemeCode = next && /^[A-Z]{2,10}$/.test(next) ? next : null;
  return { teamCode, portalTrainingId, schemeCode, period: parsePeriod(title) };
}

export const PORTAL_HOST = "digitalent.komdigi.go.id";

/** ID pelatihan portal dari `https://digitalent.komdigi.go.id/pelatihan/{id}`; null bila bukan URL portal. */
export function parsePortalUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.hostname !== PORTAL_HOST) return null;
  const m = /^\/pelatihan\/(\d{4,6})\/?$/.exec(url.pathname);
  return m ? (m[1] as string) : null;
}

/** Peringatan bila ID dari judul berbeda dengan ID dari tautan portal. */
export function idMismatch(fromTitle: string | null, fromPortal: string | null): boolean {
  return fromTitle !== null && fromPortal !== null && fromTitle !== fromPortal;
}
