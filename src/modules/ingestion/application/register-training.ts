import { detectLayout } from "../domain/sheet-layout";
import type { SpreadsheetRef } from "../domain/spreadsheet-url";
import { idMismatch, parseSpreadsheetTitle } from "../domain/title-parser";
import { type Result, fail, ok } from "./errors";
import { ID_MISMATCH_WARNING, parseLinks } from "./parse-training-source";
import type {
  Actor,
  AuditLog,
  Clock,
  IdGenerator,
  NewTraining,
  SheetSource,
  TrainingRepository,
} from "./ports";
import {
  type RegisterTrainingInput,
  type RegisterTrainingOutput,
  parseInput,
  registerTrainingInput,
} from "./schemas";

export interface RegisterDeps {
  sheets: SheetSource;
  trainings: TrainingRepository;
  audit: AuditLog;
  clock: Clock;
  ids: IdGenerator;
}

/** Periksa tata letak sheet tanpa mengimpor (spesifikasi §7.1 `POST /trainings`). */
async function checkSheet(deps: RegisterDeps, sheet: SpreadsheetRef): Promise<Result<string>> {
  const rows = await deps.sheets.readRows({ sourceType: "google_sheets", reference: sheet }, null);
  if (!rows.ok) {
    return fail("SOURCE_UNAVAILABLE", "Sheet tidak dapat dibaca untuk pemeriksaan tata letak.", {
      reason: rows.error,
    });
  }
  const layout = detectLayout(rows.rows[1] ?? []);
  if (!layout.ok) {
    const { code, detail } = layout.error;
    return fail("BLOCKED", `Tata letak sheet tidak sesuai: ${detail}.`, { layoutError: code });
  }
  const title = await deps.sheets.readTitle(sheet.spreadsheetId);
  return ok(title.ok ? title.title : "");
}

/** Peringatan ID judul ≠ ID portal, atau ID terkonfirmasi ≠ ID portal (§3.7). Tidak memblokir. */
function idWarnings(
  input: RegisterTrainingInput,
  ctx: { title: string; teams: string[]; portalId: string | null },
) {
  const fromTitle = parseSpreadsheetTitle(ctx.title, ctx.teams).portalTrainingId;
  const mismatch =
    idMismatch(fromTitle, ctx.portalId) || idMismatch(input.portalTrainingId, ctx.portalId);
  return mismatch ? [ID_MISMATCH_WARNING] : [];
}

type Checked = {
  workTeamYearId: string;
  sheet: SpreadsheetRef;
  portalId: string | null;
  title: string;
};

/** Pemeriksaan sebelum menyimpan: tautan, tim/tahun, ID ganda (§3.7), dan tata letak sheet. */
async function checkRegistration(
  deps: RegisterDeps,
  value: RegisterTrainingInput,
): Promise<Result<Checked>> {
  const links = parseLinks(value.spreadsheetUrl, value.portalUrl);
  if (!links.ok) return links;
  const teamYear = await deps.trainings.findWorkTeamYear(value.teamCode, value.year);
  if (!teamYear) return fail("VALIDATION_ERROR", "Tim kerja untuk tahun tersebut belum terdaftar.");
  const existing = await deps.trainings.findByPortalTrainingId(value.portalTrainingId);
  if (existing) {
    return fail("CONFLICT", `ID pelatihan sudah dipakai oleh ${existing.code}.`, {
      existingTrainingId: existing.id,
    });
  }
  const sheet = await checkSheet(deps, links.value.sheet);
  if (!sheet.ok) return sheet;
  return ok({ workTeamYearId: teamYear.id, ...links.value, title: sheet.value });
}

function toNewTraining(
  value: RegisterTrainingInput,
  ids: { trainingId: string; workTeamYearId: string },
  confirmation: { by: string; at: string },
): NewTraining {
  return {
    id: ids.trainingId,
    workTeamYearId: ids.workTeamYearId,
    code: `${value.teamCode}-${value.portalTrainingId}`,
    name: value.name,
    schemeCode: value.schemeCode ?? null,
    portalUrl: value.portalUrl ?? null,
    portalTrainingId: value.portalTrainingId,
    startDate: value.period.start,
    endDate: value.period.end,
    idConfirmedBy: confirmation.by,
    idConfirmedAt: confirmation.at,
  };
}

/**
 * Simpan pelatihan setelah Admin mengonfirmasi tahun, tim, ID, nama, dan periode (§3.7).
 * `id_confirmed_by`/`at` diisi dari aktor dan jam server, bukan dari klien.
 */
export async function registerTraining(
  deps: RegisterDeps,
  raw: unknown,
  actor: Actor,
): Promise<Result<RegisterTrainingOutput>> {
  const input = parseInput(registerTrainingInput, raw);
  if (!input.ok) {
    const fields = input.fields;
    return fail("VALIDATION_ERROR", "Data pelatihan belum lengkap atau tidak valid.", { fields });
  }
  if (actor.role !== "admin") {
    return fail("FORBIDDEN", "Hanya Admin yang dapat mengonfirmasi pelatihan.");
  }
  const value = input.value;
  const checked = await checkRegistration(deps, value);
  if (!checked.ok) return checked;
  const { workTeamYearId, sheet, portalId, title } = checked.value;
  const trainingId = deps.ids.uuid();
  const sourceId = deps.ids.uuid();
  const confirmation = { by: actor.id, at: deps.clock.now().toISOString() };
  const training = toNewTraining(value, { trainingId, workTeamYearId }, confirmation);
  const code = training.code;
  await deps.trainings.createWithSource(training, { id: sourceId, trainingId, ...sheet });
  const ctx = { title, teams: await deps.trainings.teamCodes(), portalId };
  await deps.audit.record({
    actorId: actor.id,
    action: "training.register",
    resourceType: "training",
    resourceId: trainingId,
    details: { code, sourceId },
  });
  return ok({ trainingId, sourceId, code, warnings: idWarnings(value, ctx) });
}
