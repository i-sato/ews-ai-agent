import Link from "next/link";
import type { TrainingListRow } from "@/modules/ingestion/application/list-trainings";
import { CompletionBar } from "./CompletionBar";
import { PHASE_LABELS, RISK_NOT_ASSESSED, formatPercent } from "./format";
import { lastDataText, topStopText } from "./TrainingTable";
import styles from "./trainings.module.css";

function footerText(row: TrainingListRow): string {
  if (row.participants === null) return "Belum ada impor";
  if (row.stale) return `Data terakhir ${lastDataText(row)}`;
  const lms = row.averageLms === null ? null : `Rata-rata LMS ${formatPercent(row.averageLms)}`;
  const stop = row.topStop ? `terbanyak berhenti di ${topStopText(row)}` : null;
  return [lms, stop].filter(Boolean).join(" · ") || "—";
}

/** Kartu daftar pelatihan untuk layar sempit (M-Pelatihan.dc.html). */
export function TrainingCards({ rows }: { rows: TrainingListRow[] }) {
  return (
    <div className={styles.cards}>
      {rows.map((row) => (
        <Link key={row.id} href={`/trainings/${row.id}`} className={styles.mobileCard}>
          <div className={styles.cardTop}>
            <span className={styles.mono}>
              {row.code} · {PHASE_LABELS[row.phase]}
            </span>
            <span className={styles.pill}>{RISK_NOT_ASSESSED}</span>
          </div>
          <div className={styles.name}>{row.name}</div>
          <div className={styles.muted}>
            {row.period ?? "Periode belum diisi"}
            {row.participants === null ? "" : ` · ${row.participants} peserta`}
          </div>
          {row.categories ? <CompletionBar categories={row.categories} /> : null}
          <div className={styles.barText}>{footerText(row)}</div>
        </Link>
      ))}
    </div>
  );
}
