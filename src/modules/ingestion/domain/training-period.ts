// Fase pelatihan dan tampilan periode (spesifikasi §3.6). Tanggal ISO `YYYY-MM-DD` (WIB).

export type TrainingPhase = "planned" | "in_progress" | "completed" | "cancelled";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const DAY_MS = 86_400_000;

/**
 * Fase dari tanggal pelaksanaan; kolom `trainings.status` hanya dipakai untuk pembatalan karena
 * tidak diperbarui otomatis.
 */
export function trainingPhase(
  t: { startDate: string | null; endDate: string | null; cancelled: boolean },
  today: string,
): TrainingPhase {
  if (t.cancelled) return "cancelled";
  if (!t.startDate || !t.endDate || today < t.startDate) return "planned";
  return today <= t.endDate ? "in_progress" : "completed";
}

const toUtc = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

/** "hari ke-8 dari 11" selama pelaksanaan; null di luar periode. */
export function dayOfTraining(
  startDate: string | null,
  endDate: string | null,
  today: string,
): { day: number; total: number } | null {
  if (!startDate || !endDate || today < startDate || today > endDate) return null;
  return {
    day: (toUtc(today) - toUtc(startDate)) / DAY_MS + 1,
    total: (toUtc(endDate) - toUtc(startDate)) / DAY_MS + 1,
  };
}

function parts(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return { year: y as number, month: MONTHS[(m as number) - 1] as string, day: d as number };
}

/** `21–31 Okt 2026`, `28 Sep–5 Okt 2026`, `28 Des 2026–5 Jan 2027`. */
export function formatDateRange(start: string | null, end: string | null): string | null {
  if (!start || !end) return null;
  const a = parts(start);
  const b = parts(end);
  if (start === end) return `${a.day} ${a.month} ${a.year}`;
  if (a.year !== b.year) return `${a.day} ${a.month} ${a.year}–${b.day} ${b.month} ${b.year}`;
  if (a.month !== b.month) return `${a.day} ${a.month}–${b.day} ${b.month} ${b.year}`;
  return `${a.day}–${b.day} ${b.month} ${b.year}`;
}

export type ScheduleState = "verified" | "needs_verification" | "no_link";

export function scheduleState(t: {
  portalUrl: string | null;
  verifiedAt: string | null;
}): ScheduleState {
  if (t.verifiedAt) return "verified";
  return t.portalUrl ? "needs_verification" : "no_link";
}
