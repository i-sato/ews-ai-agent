// Port baca untuk layar Pelatihan (F2-09). Pelatihan dibaca lewat sesi pengguna (RLS); progres
// dibaca service role hanya untuk pelatihan yang sudah lolos pemeriksaan itu.
import type { ProgressRow, SummaryItem } from "../domain/progress-summary";
import type { TrainingPhase } from "../domain/training-period";
import type { Clock, SourceType } from "./ports";

export interface TrainingRecord {
  id: string;
  code: string;
  name: string;
  teamCode: string;
  year: number;
  startDate: string | null;
  endDate: string | null;
  registrationStart: string | null;
  registrationEnd: string | null;
  cancelled: boolean;
  portalUrl: string | null;
  scheduleSource: "manual" | "official_api" | null;
  scheduleVerifiedAt: string | null;
}

export interface TrainingFilter {
  year: number | null;
  teamCode: string | null;
  phase: TrainingPhase | null;
  query: string | null;
  today: string;
  page: number;
  pageSize: number;
}

export interface ParticipantProgress extends ProgressRow {
  /** Hanya terisi bila identitas diminta (role berwenang, §8.6). */
  participantNumber: string | null;
  participantName: string | null;
}

export interface ProgressSnapshot {
  batchId: string;
  sourceType: SourceType;
  fetchedAt: string;
  lastCheckedAt: string | null;
  contentChangedAt: string | null;
  sourceUpdatedAt: string | null;
  labelUpdatedAt: string | null;
  freshnessThresholdHours: number;
  summary: Record<string, unknown>;
  items: SummaryItem[];
  participants: ParticipantProgress[];
}

export interface TrainingViewRepository {
  listTrainings(filter: TrainingFilter): Promise<{ rows: TrainingRecord[]; total: number }>;
  findTraining(trainingId: string): Promise<TrainingRecord | null>;
  /** Snapshot valid terakhir; null bila belum ada impor. */
  latestProgress(
    trainingId: string,
    options: { withIdentity: boolean },
  ): Promise<ProgressSnapshot | null>;
}

export interface ViewDeps {
  views: TrainingViewRepository;
  clock: Clock;
}
