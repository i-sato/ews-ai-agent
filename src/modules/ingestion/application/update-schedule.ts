import { type Result, fail, ok } from "./errors";
import type { Actor, AuditLog, Clock, TrainingRepository } from "./ports";
import { IMPORT_ROLES } from "./preview-import";
import { parseInput, updateScheduleInput } from "./schemas";

export interface ScheduleDeps {
  trainings: TrainingRepository;
  audit: AuditLog;
  clock: Clock;
}

export interface UpdateScheduleOutput {
  trainingId: string;
  verified: boolean;
  verifiedAt: string | null;
}

/**
 * Simpan jadwal pendaftaran dan pelaksanaan (spesifikasi §3.6), sumber `manual`. Penyimpan
 * sekaligus pemverifikasi bila mencentang `verified` (keputusan F2-08); tanpa centang mengosongkan
 * verifikasi. Pelatihan tim lain tidak terlihat (RLS) sehingga dilaporkan tidak ditemukan.
 */
export async function updateSchedule(
  deps: ScheduleDeps,
  raw: unknown,
  actor: Actor,
): Promise<Result<UpdateScheduleOutput>> {
  const input = parseInput(updateScheduleInput, raw);
  if (!input.ok) {
    return fail("VALIDATION_ERROR", "Jadwal tidak valid.", { fields: input.fields });
  }
  if (!IMPORT_ROLES.includes(actor.role)) return fail("FORBIDDEN", "Anda tidak memiliki akses.");
  const { trainingId, verified, ...dates } = input.value;
  const training = await deps.trainings.findTraining(trainingId);
  if (!training) return fail("NOT_FOUND", "Pelatihan tidak ditemukan.");
  const verifiedAt = verified ? deps.clock.now().toISOString() : null;
  await deps.trainings.updateSchedule(trainingId, {
    ...dates,
    scheduleSource: "manual",
    verifiedBy: verified ? actor.id : null,
    verifiedAt,
  });
  await deps.audit.record({
    actorId: actor.id,
    action: "training.schedule",
    resourceType: "training",
    resourceId: trainingId,
    details: { code: training.code, verified },
  });
  return ok({ trainingId, verified, verifiedAt });
}
