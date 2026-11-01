// Label dan format tampilan layar Pelatihan: bahasa Indonesia, WIB, desimal koma (aturan UI).
import type {
  Category,
  ItemType,
  ItemStatus,
  ScheduleState,
  TrainingPhase,
} from "@/modules/ingestion/application/view-types";

export const PHASE_LABELS: Record<TrainingPhase, string> = {
  planned: "Direncanakan",
  in_progress: "Berlangsung",
  completed: "Selesai",
  cancelled: "Dibatalkan",
};

export const SCHEDULE_LABELS: Record<ScheduleState, string> = {
  verified: "Jadwal terverifikasi",
  needs_verification: "Perlu verifikasi",
  no_link: "Tautan belum ada",
};

export const CATEGORY_LABELS: Record<Category, string> = {
  not_started: "Belum mulai",
  partial: "Sebagian",
  completed: "Tuntas",
  check: "Perlu dicek",
};

export const CATEGORY_ORDER: Category[] = ["not_started", "partial", "completed", "check"];

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  overview: "Overview",
  material: "Materi",
  video: "Video",
  quiz: "Kuis",
  final_assessment: "Final",
};

export const ITEM_STATUS_LABELS: Record<ItemStatus, string> = {
  completed: "Selesai",
  not_started: "Belum selesai",
  unknown: "Tidak diketahui",
};

/** Status risiko individu baru tersedia setelah rules engine (F3) berjalan. */
export const RISK_NOT_ASSESSED = "Belum dinilai";

const number = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });

export const formatNumber = (n: number) => number.format(n);
export const formatPercent = (n: number) => `${number.format(n)}%`;

const dateTime = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Waktu WIB ringkas, mis. "30 Okt 10.00". */
export function formatDateTime(iso: string | null): string {
  return iso ? dateTime.format(new Date(iso)) : "—";
}

export function categorySummary(c: Record<Category, number>): string {
  const parts = [`${c.not_started} belum mulai`, `${c.partial} sebagian`, `${c.completed} tuntas`];
  if (c.check > 0) parts.push(`${c.check} perlu dicek`);
  return parts.join(" · ");
}
