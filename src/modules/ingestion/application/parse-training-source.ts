import { parseSpreadsheetUrl } from "../domain/spreadsheet-url";
import { idMismatch, parsePortalUrl, parseSpreadsheetTitle } from "../domain/title-parser";
import { type Result, fail, ok } from "./errors";
import type { Actor, SheetSource, TrainingRepository } from "./ports";
import { type ParseTrainingSourceOutput, parseInput, parseTrainingSourceInput } from "./schemas";

export interface ParseSourceDeps {
  sheets: SheetSource;
  trainings: TrainingRepository;
}

export const ID_MISMATCH_WARNING =
  "ID pelatihan pada judul sheet berbeda dengan ID pada tautan portal.";

const READ_FAILED: Record<string, string> = {
  PERMISSION_DENIED: "Judul sheet tidak dapat dibaca: akses untuk service account belum diberikan.",
  NOT_FOUND: "Sheet tidak ditemukan.",
};

/** Tautan sheet dan portal tervalidasi; null + galat bila tidak memenuhi allowlist host. */
export function parseLinks(spreadsheetUrl: string, portalUrl: string | undefined) {
  const sheet = parseSpreadsheetUrl(spreadsheetUrl);
  if (!sheet) return fail("VALIDATION_ERROR", "Tautan Google Sheets tidak valid.");
  const portalId = portalUrl === undefined ? null : parsePortalUrl(portalUrl);
  if (portalUrl !== undefined && portalId === null) {
    return fail("VALIDATION_ERROR", "Tautan halaman pelatihan portal tidak valid.");
  }
  return ok({ sheet, portalId });
}

/**
 * Usulan tim kerja, ID, skema, dan periode dari judul sheet dan tautan portal (spesifikasi §3.7).
 * Hanya usulan; tidak menulis apa pun. Admin mengonfirmasi lewat RegisterTraining.
 */
export async function parseTrainingSource(
  deps: ParseSourceDeps,
  raw: unknown,
  actor: Actor,
): Promise<Result<ParseTrainingSourceOutput>> {
  const input = parseInput(parseTrainingSourceInput, raw);
  if (!input.ok)
    return fail("VALIDATION_ERROR", "Permintaan tidak valid.", { fields: input.fields });
  if (actor.role !== "admin")
    return fail("FORBIDDEN", "Hanya Admin yang dapat menambah pelatihan.");
  const links = parseLinks(input.value.spreadsheetUrl, input.value.portalUrl);
  if (!links.ok) return links;
  const { sheet, portalId } = links.value;
  const title = await deps.sheets.readTitle(sheet.spreadsheetId);
  if (!title.ok) {
    const message =
      READ_FAILED[title.error] ?? "Sheet tidak dapat dibaca saat ini. Coba lagi nanti.";
    return fail("SOURCE_UNAVAILABLE", message, { reason: title.error });
  }
  const proposal = parseSpreadsheetTitle(title.title, await deps.trainings.teamCodes());
  const warnings = idMismatch(proposal.portalTrainingId, portalId) ? [ID_MISMATCH_WARNING] : [];
  return ok({
    title: title.title,
    spreadsheetId: sheet.spreadsheetId,
    gid: sheet.gid,
    ...proposal,
    portalTrainingIdFromUrl: portalId,
    warnings,
  });
}
