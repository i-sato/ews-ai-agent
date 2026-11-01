import { z } from "zod";
import {
  type Category,
  type ProgressSummary,
  categoryOf,
  stopPoint,
  summarizeProgress,
} from "../domain/progress-summary";
import type { ItemStatus } from "../domain/status-mapping";
import {
  type ScheduleState,
  type TrainingPhase,
  dayOfTraining,
  formatDateRange,
  scheduleState,
  trainingPhase,
} from "../domain/training-period";
import { type Result, fail, ok } from "./errors";
import type { Actor } from "./ports";
import { parseInput } from "./schemas";
import { type FreshnessView, freshnessOf, todayWib } from "./view-helpers";
import type { ProgressSnapshot, TrainingRecord, ViewDeps } from "./view-ports";

export const PARTICIPANT_PAGE_SIZE = 20;

export const trainingDetailInput = z
  .object({
    trainingId: z.uuid(),
    category: z.enum(["not_started", "partial", "completed", "check"]).optional(),
    page: z.coerce.number().int().min(1).max(1000).optional(),
  })
  .strict();

export interface ParticipantView {
  number: string;
  name: string;
  category: Category;
  done: number;
  total: number;
  stop: { index: number; code: string; name: string; skipped: number } | null;
  statuses: ItemStatus[];
}

export interface TrainingDetail {
  training: TrainingRecord & {
    phase: TrainingPhase;
    period: string | null;
    registration: string | null;
    day: { day: number; total: number } | null;
    schedule: ScheduleState;
  };
  freshness: FreshnessView | null;
  batch: {
    id: string;
    sourceType: string;
    reconciliationMismatches: number;
    emptySlots: number;
  } | null;
  summary: ProgressSummary | null;
  /** null bila role tidak berwenang melihat daftar peserta (§8.6, NFR-03). */
  participants: { rows: ParticipantView[]; total: number; page: number; pageSize: number } | null;
}

/** Viewer/Pimpinan hanya melihat agregat (RLS juga menolak data peserta untuk viewer). */
export const canSeeParticipants = (actor: Actor) => actor.role !== "viewer";

function participantView(p: ProgressSnapshot["participants"][number], s: ProgressSnapshot) {
  const stop = stopPoint(p.statuses);
  const item = stop ? s.items[stop.index] : undefined;
  return {
    number: p.participantNumber ?? "",
    name: p.participantName ?? "",
    category: categoryOf(p),
    done: p.statuses.filter((x) => x === "completed").length,
    total: p.statuses.length,
    stop:
      stop && item
        ? { index: stop.index, code: item.code, name: item.name, skipped: stop.skipped }
        : null,
    statuses: [...p.statuses],
  };
}

function participantPage(s: ProgressSnapshot, category: Category | undefined, page: number) {
  const rows = s.participants
    .filter((p) => !["cancelled", "in_selection"].includes(p.enrollmentStatus))
    .map((p) => participantView(p, s))
    .filter((p) => !category || p.category === category);
  const start = (page - 1) * PARTICIPANT_PAGE_SIZE;
  const pageRows = rows.slice(start, start + PARTICIPANT_PAGE_SIZE);
  return { rows: pageRows, total: rows.length, page, pageSize: PARTICIPANT_PAGE_SIZE };
}

function batchView(s: ProgressSnapshot) {
  const n = (key: string) => Number(s.summary[key] ?? 0);
  return {
    id: s.batchId,
    sourceType: s.sourceType,
    reconciliationMismatches: n("reconciliationMismatches"),
    emptySlots: n("emptySlots"),
  };
}

/** Detail pelatihan: jadwal, kesegaran, funnel, kategori, titik berhenti, item, peserta (§8.6). */
export async function getTrainingDetail(
  deps: ViewDeps,
  raw: unknown,
  actor: Actor,
): Promise<Result<TrainingDetail>> {
  const input = parseInput(trainingDetailInput, raw);
  if (!input.ok)
    return fail("VALIDATION_ERROR", "Permintaan tidak valid.", { fields: input.fields });
  const t = await deps.views.findTraining(input.value.trainingId);
  if (!t) return fail("NOT_FOUND", "Pelatihan tidak ditemukan.");
  const allowed = canSeeParticipants(actor);
  const s = await deps.views.latestProgress(t.id, { withIdentity: allowed });
  const now = deps.clock.now();
  const today = todayWib(now);
  const training = {
    ...t,
    phase: trainingPhase(t, today),
    period: formatDateRange(t.startDate, t.endDate),
    registration: formatDateRange(t.registrationStart, t.registrationEnd),
    day: dayOfTraining(t.startDate, t.endDate, today),
    schedule: scheduleState({ portalUrl: t.portalUrl, verifiedAt: t.scheduleVerifiedAt }),
  };
  if (!s) return ok({ training, freshness: null, batch: null, summary: null, participants: null });
  return ok({
    training,
    freshness: freshnessOf(s, now),
    batch: batchView(s),
    summary: summarizeProgress(s.participants, s.items),
    participants: allowed ? participantPage(s, input.value.category, input.value.page ?? 1) : null,
  });
}
