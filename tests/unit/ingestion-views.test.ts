import { describe, expect, it } from "vitest";
import { listTrainings } from "@/modules/ingestion/application/list-trainings";
import { getTrainingDetail } from "@/modules/ingestion/application/training-detail";
import type {
  ParticipantProgress,
  ProgressSnapshot,
  TrainingFilter,
  TrainingRecord,
  TrainingViewRepository,
} from "@/modules/ingestion/application/view-ports";

// Data sintetis: nomor dan nama fiktif berawalan SYN-.
const NOW = new Date("2026-10-28T03:00:00Z");
const ID = "11111111-1111-4111-8111-111111111111";

const training: TrainingRecord = {
  id: ID,
  code: "DTA-0001",
  name: "Pelatihan Sintetis",
  teamCode: "DTA",
  year: 2026,
  startDate: "2026-10-21",
  endDate: "2026-10-31",
  registrationStart: "2026-10-06",
  registrationEnd: "2026-10-17",
  cancelled: false,
  portalUrl: null,
  scheduleSource: null,
  scheduleVerifiedAt: null,
};

const items = ["M01", "M02", "M03"].map((code, i) => ({
  sequence: i + 1,
  code,
  name: `ITEM ${code}`,
  type: "material" as const,
}));

function person(n: number, statuses: ParticipantProgress["statuses"], extra = {}) {
  return {
    participantNumber: `SYN-${n}`,
    participantName: `Peserta Sintetis ${n}`,
    enrollmentStatus: "in_progress",
    onboardingStatus: true,
    completionPercentage: null,
    qualityFlags: [],
    statuses,
    ...extra,
  } as ParticipantProgress;
}

const snapshot: ProgressSnapshot = {
  batchId: "batch-1",
  sourceType: "csv",
  fetchedAt: "2026-10-28T02:00:00Z",
  lastCheckedAt: "2026-10-28T02:00:00Z",
  contentChangedAt: "2026-10-27T09:00:00Z",
  sourceUpdatedAt: null,
  labelUpdatedAt: null,
  freshnessThresholdHours: 24,
  summary: { reconciliationMismatches: 0, emptySlots: 2 },
  items,
  participants: [
    person(1, ["completed", "completed", "completed"]),
    person(2, ["completed", "not_started", "not_started"]),
    person(3, ["not_started", "not_started", "not_started"]),
    person(4, ["completed", "not_started", "not_started"], { enrollmentStatus: "cancelled" }),
    person(5, ["not_started", "not_started", "not_started"], { enrollmentStatus: "in_selection" }),
  ],
};

function fakeViews(found: TrainingRecord | null, progress: ProgressSnapshot | null) {
  const calls: { identity: boolean[]; filters: TrainingFilter[] } = { identity: [], filters: [] };
  const views: TrainingViewRepository = {
    async listTrainings(filter) {
      calls.filters.push(filter);
      return { rows: found ? [found] : [], total: found ? 1 : 0 };
    },
    async findTraining(id) {
      return found && found.id === id ? found : null;
    },
    async latestProgress(_id, { withIdentity }) {
      calls.identity.push(withIdentity);
      if (!progress || withIdentity) return progress;
      const anonymous = progress.participants.map((p) => ({
        ...p,
        participantNumber: null,
        participantName: null,
      }));
      return { ...progress, participants: anonymous };
    },
  };
  return { deps: { views, clock: { now: () => NOW } }, calls };
}

const manager = { id: "u1", role: "training_manager" as const };
const viewer = { id: "u2", role: "viewer" as const };

describe("listTrainings", () => {
  it("menghitung baris daftar dari snapshot tanpa identitas peserta", async () => {
    const { deps, calls } = fakeViews(training, snapshot);
    const result = await listTrainings(deps, { year: "2026", team: "DTA", q: " web " });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [row] = result.value.rows;
    expect(row).toMatchObject({
      code: "DTA-0001",
      phase: "in_progress",
      period: "21–31 Okt 2026",
      schedule: "no_link",
      participants: 4,
      lastDataAt: "2026-10-27T09:00:00Z",
      stale: false,
    });
    expect(row?.categories).toEqual({ not_started: 1, partial: 1, completed: 1, check: 0 });
    expect(calls.identity).toEqual([false]);
    expect(calls.filters[0]).toMatchObject({ year: 2026, teamCode: "DTA", query: "web" });
    expect(calls.filters[0]?.today).toBe("2026-10-28");
  });

  it("menampilkan baris tanpa impor dan menolak parameter tak dikenal", async () => {
    const { deps } = fakeViews(training, null);
    const result = await listTrainings(deps, {});
    expect(result.ok && result.value.rows[0]?.participants).toBeNull();
    const bad = await listTrainings(deps, { sort: "name" });
    expect(bad.ok).toBe(false);
  });
});

describe("getTrainingDetail", () => {
  it("memberi pengelola daftar peserta tanpa batal dan seleksi, dengan titik berhenti", async () => {
    const { deps, calls } = fakeViews(training, snapshot);
    const result = await getTrainingDetail(deps, { trainingId: ID }, manager);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(calls.identity).toEqual([true]);
    expect(result.value.training.day).toEqual({ day: 8, total: 11 });
    expect(result.value.batch).toMatchObject({ reconciliationMismatches: 0, emptySlots: 2 });
    const rows = result.value.participants?.rows ?? [];
    expect(rows.map((r) => r.number)).toEqual(["SYN-1", "SYN-2", "SYN-3"]);
    expect(rows[1]?.stop).toMatchObject({ index: 1, code: "M02" });
  });

  it("menyaring peserta per kategori", async () => {
    const { deps } = fakeViews(training, snapshot);
    const raw = { trainingId: ID, category: "partial", page: "1" };
    const result = await getTrainingDetail(deps, raw, manager);
    expect(result.ok && result.value.participants?.rows.map((r) => r.number)).toEqual(["SYN-2"]);
  });

  it("viewer hanya menerima agregat, tanpa identitas peserta", async () => {
    const { deps, calls } = fakeViews(training, snapshot);
    const result = await getTrainingDetail(deps, { trainingId: ID }, viewer);
    expect(calls.identity).toEqual([false]);
    expect(result.ok && result.value.participants).toBeNull();
    expect(result.ok && result.value.summary?.funnel.registered).toBe(4);
  });

  it("pelatihan yang tidak terlihat lewat RLS dilaporkan tidak ditemukan", async () => {
    const { deps, calls } = fakeViews(null, snapshot);
    const result = await getTrainingDetail(deps, { trainingId: ID }, manager);
    expect(!result.ok && result.error.code).toBe("NOT_FOUND");
    expect(calls.identity).toEqual([]);
  });

  it("menolak ID bukan UUID dan tetap tampil tanpa impor", async () => {
    const { deps } = fakeViews(training, null);
    const bad = await getTrainingDetail(deps, { trainingId: "1" }, manager);
    expect(!bad.ok && bad.error.code).toBe("VALIDATION_ERROR");
    const empty = await getTrainingDetail(deps, { trainingId: ID }, manager);
    expect(empty.ok && empty.value.summary).toBeNull();
  });
});
