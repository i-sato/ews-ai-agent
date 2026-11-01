import type { ItemStatus } from "../../domain/status-mapping";
import type {
  ProgressSnapshot,
  TrainingFilter,
  TrainingRecord,
  TrainingViewRepository,
} from "../../application/view-ports";
import type { RepositoryClients } from "./import-repository";
import { intervalHours } from "./rows";
import {
  TRAINING_COLUMNS,
  batchRow,
  moduleCatalogRow,
  moduleProgressRow,
  snapshotRow,
  toTrainingRecord,
} from "./view-rows";

const PAGE = 1000;

function failed(operation: string, error: { code?: string } | null): never {
  throw new Error(`TrainingViewRepository.${operation} gagal (${error?.code ?? "unknown"})`);
}

/** Pencarian bebas tanpa karakter khusus filter PostgREST (`%`, `,`, `(`, `)`). */
const safeQuery = (q: string) => q.replace(/[%_,()*\\]/g, " ").trim();

type Page = { data: unknown[] | null; error: { code?: string } | null };

type PhaseFilter = {
  status?: ["eq" | "neq", string];
  or?: string;
  ranges: ["lt" | "lte" | "gte", "start_date" | "end_date"][];
};

/** Padanan database untuk fase dari tanggal (domain `trainingPhase`). */
function phaseFilter({ phase, today }: TrainingFilter): PhaseFilter {
  if (!phase) return { ranges: [] };
  if (phase === "cancelled") return { status: ["eq", "cancelled"], ranges: [] };
  const active = { status: ["neq", "cancelled"] as ["neq", string] };
  if (phase === "planned") {
    return {
      ...active,
      or: `start_date.is.null,end_date.is.null,start_date.gt.${today}`,
      ranges: [],
    };
  }
  if (phase === "completed") return { ...active, ranges: [["lt", "end_date"]] };
  return {
    ...active,
    ranges: [
      ["lte", "start_date"],
      ["gte", "end_date"],
    ],
  };
}

async function fetchAll(operation: string, page: (from: number, to: number) => PromiseLike<Page>) {
  const rows: unknown[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) failed(operation, error);
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < PAGE) return rows;
  }
}

export class SupabaseTrainingViewRepository implements TrainingViewRepository {
  constructor(private readonly db: RepositoryClients) {}

  private filtered(filter: TrainingFilter) {
    let query = this.db.reader.from("trainings").select(TRAINING_COLUMNS, { count: "exact" });
    if (filter.year) query = query.eq("work_team_years.year", filter.year);
    if (filter.teamCode) query = query.eq("work_team_years.work_teams.code", filter.teamCode);
    const q = filter.query ? safeQuery(filter.query) : "";
    if (q) query = query.or(`code.ilike.%${q}%,name.ilike.%${q}%`);
    const phase = phaseFilter(filter);
    if (phase.status) {
      const [op, value] = phase.status;
      query = op === "eq" ? query.eq("status", value) : query.neq("status", value);
    }
    if (phase.or) query = query.or(phase.or);
    for (const [op, column] of phase.ranges) query = query[op](column, filter.today);
    return query;
  }

  async listTrainings(filter: TrainingFilter) {
    const query = this.filtered(filter);
    const from = (filter.page - 1) * filter.pageSize;
    const { data, error, count } = await query
      .order("start_date", { ascending: false, nullsFirst: false })
      .order("code")
      .range(from, from + filter.pageSize - 1);
    if (error) failed("listTrainings", error);
    return { rows: (data ?? []).map(toTrainingRecord), total: count ?? 0 };
  }

  async findTraining(trainingId: string): Promise<TrainingRecord | null> {
    const { data, error } = await this.db.reader
      .from("trainings")
      .select(TRAINING_COLUMNS)
      .eq("id", trainingId)
      .maybeSingle();
    if (error) failed("findTraining", error);
    return data ? toTrainingRecord(data) : null;
  }

  async latestProgress(trainingId: string, options: { withIdentity: boolean }) {
    const { data, error } = await this.db.writer
      .from("import_batches")
      .select(
        "id, source_type, fetched_at, content_changed_at, source_updated_at, label_updated_at, " +
          "row_counts, data_sources!inner(training_id, last_fetched_at, freshness_threshold)",
      )
      .eq("data_sources.training_id", trainingId)
      .eq("status", "committed")
      .order("content_changed_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (error) failed("latestProgress", error);
    if (!data) return null;
    const batch = batchRow.parse(data);
    const items = await this.catalog(trainingId);
    const participants = await this.participants(batch.id, items.length, options.withIdentity);
    return {
      batchId: batch.id,
      sourceType: batch.source_type,
      fetchedAt: batch.fetched_at,
      lastCheckedAt: batch.data_sources.last_fetched_at,
      contentChangedAt: batch.content_changed_at,
      sourceUpdatedAt: batch.source_updated_at,
      labelUpdatedAt: batch.label_updated_at,
      freshnessThresholdHours: intervalHours(batch.data_sources.freshness_threshold),
      summary: batch.row_counts,
      items,
      participants,
    } satisfies ProgressSnapshot;
  }

  private async catalog(trainingId: string) {
    const { data, error } = await this.db.writer
      .from("training_modules")
      .select("catalog_version, sequence, module_code, name, module_type")
      .eq("training_id", trainingId)
      .order("catalog_version", { ascending: false })
      .order("sequence");
    if (error) failed("catalog", error);
    const rows = (data ?? []).map((r) => moduleCatalogRow.parse(r));
    const version = rows[0]?.catalog_version;
    return rows
      .filter((r) => r.catalog_version === version)
      .map((r) => ({
        sequence: r.sequence,
        code: r.module_code,
        name: r.name,
        type: r.module_type,
      }));
  }

  private async statuses(batchId: string, itemCount: number) {
    const raw = await fetchAll("moduleProgress", (from, to) =>
      this.db.writer
        .from("participant_module_progress")
        .select("enrollment_id, status, training_modules!inner(sequence)")
        .eq("import_batch_id", batchId)
        .order("id")
        .range(from, to),
    );
    const byEnrollment = new Map<string, ItemStatus[]>();
    for (const r of raw.map((x) => moduleProgressRow.parse(x))) {
      const list = byEnrollment.get(r.enrollment_id) ?? Array(itemCount).fill("unknown");
      list[r.training_modules.sequence - 1] = r.status;
      byEnrollment.set(r.enrollment_id, list);
    }
    return byEnrollment;
  }

  private async participants(batchId: string, itemCount: number, withIdentity: boolean) {
    // Nama dan nomor hanya diambil bila role berwenang; untuk viewer tidak pernah dibaca (§8.6).
    const person = withIdentity ? ", participants!inner(participant_number, name)" : "";
    const raw = await fetchAll("snapshots", (from, to) =>
      this.db.writer
        .from("participant_progress_snapshots")
        .select(
          "enrollment_id, completion_percentage, quality_flags, " +
            `training_enrollments!inner(enrollment_status, onboarding_status${person})`,
        )
        .eq("import_batch_id", batchId)
        .order("id")
        .range(from, to),
    );
    const statuses = await this.statuses(batchId, itemCount);
    return raw.map((x) => {
      const r = snapshotRow.parse(x);
      const e = r.training_enrollments;
      return {
        enrollmentStatus: e.enrollment_status,
        onboardingStatus: e.onboarding_status,
        completionPercentage: r.completion_percentage,
        qualityFlags: r.quality_flags,
        statuses: statuses.get(r.enrollment_id) ?? Array(itemCount).fill("unknown"),
        participantNumber: e.participants?.participant_number ?? null,
        participantName: e.participants?.name ?? null,
      };
    });
  }
}
