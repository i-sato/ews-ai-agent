import { z } from "zod";
import { type Category, summarizeProgress } from "../domain/progress-summary";
import {
  type ScheduleState,
  type TrainingPhase,
  formatDateRange,
  scheduleState,
  trainingPhase,
} from "../domain/training-period";
import { type Result, fail, ok } from "./errors";
import { parseInput } from "./schemas";
import { freshnessOf, todayWib } from "./view-helpers";
import type { TrainingRecord, ViewDeps } from "./view-ports";

export const PAGE_SIZE = 10;

export const listTrainingsInput = z
  .object({
    year: z.coerce.number().int().min(2020).max(2100).optional(),
    team: z
      .string()
      .regex(/^[A-Z]{2,10}$/)
      .optional(),
    phase: z.enum(["planned", "in_progress", "completed", "cancelled"]).optional(),
    q: z.string().trim().max(100).optional(),
    page: z.coerce.number().int().min(1).max(1000).optional(),
  })
  .strict();

export interface TrainingListRow {
  id: string;
  code: string;
  name: string;
  teamCode: string;
  period: string | null;
  phase: TrainingPhase;
  portalUrl: string | null;
  schedule: ScheduleState;
  participants: number | null;
  categories: Record<Category, number> | null;
  averageLms: number | null;
  topStop: { code: string; name: string; count: number } | { items: number } | null;
  lastDataAt: string | null;
  stale: boolean;
}

export interface TrainingList {
  rows: TrainingListRow[];
  total: number;
  page: number;
  pageSize: number;
}

async function toRow(deps: ViewDeps, t: TrainingRecord, today: string): Promise<TrainingListRow> {
  const snapshot = await deps.views.latestProgress(t.id, { withIdentity: false });
  const base = {
    id: t.id,
    code: t.code,
    name: t.name,
    teamCode: t.teamCode,
    period: formatDateRange(t.startDate, t.endDate),
    phase: trainingPhase({ ...t }, today),
    portalUrl: t.portalUrl,
    schedule: scheduleState({ portalUrl: t.portalUrl, verifiedAt: t.scheduleVerifiedAt }),
  };
  if (!snapshot) {
    const empty = { participants: null, categories: null, averageLms: null, topStop: null };
    return { ...base, ...empty, lastDataAt: null, stale: false };
  }
  const summary = summarizeProgress(snapshot.participants, snapshot.items);
  const [top] = summary.topStops;
  const distinct = summary.topStops.length + summary.otherStops.items;
  const freshness = freshnessOf(snapshot, deps.clock.now());
  return {
    ...base,
    participants: summary.funnel.registered,
    categories: summary.categories,
    averageLms: summary.averageLms,
    topStop: top && top.count > 1 ? top : distinct > 0 ? { items: distinct } : null,
    lastDataAt: freshness.contentChangedAt,
    stale: freshness.stale,
  };
}

/** Daftar pelatihan per tahun dan tim kerja dengan indikator penyelesaian (§8.6). Tanpa PII. */
export async function listTrainings(deps: ViewDeps, raw: unknown): Promise<Result<TrainingList>> {
  const input = parseInput(listTrainingsInput, raw);
  if (!input.ok) return fail("VALIDATION_ERROR", "Filter tidak valid.", { fields: input.fields });
  const { year, team, phase, q, page = 1 } = input.value;
  const today = todayWib(deps.clock.now());
  const filter = {
    year: year ?? null,
    teamCode: team ?? null,
    phase: phase ?? null,
    query: q || null,
    today,
    page,
    pageSize: PAGE_SIZE,
  };
  const { rows, total } = await deps.views.listTrainings(filter);
  const items = await Promise.all(rows.map((t) => toRow(deps, t, today)));
  return ok({ rows: items, total, page, pageSize: PAGE_SIZE });
}
