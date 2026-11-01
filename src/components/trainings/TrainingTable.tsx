import Link from "next/link";
import type { TrainingListRow } from "@/modules/ingestion/application/list-trainings";
import { CompletionBar } from "./CompletionBar";
import {
  PHASE_LABELS,
  RISK_NOT_ASSESSED,
  SCHEDULE_LABELS,
  formatDateTime,
  formatNumber,
  formatPercent,
} from "./format";
import styles from "./trainings.module.css";

const SCHEDULE_PILL = { verified: styles.pillOk, needs_verification: styles.pillInfo, no_link: "" };

export function topStopText(row: TrainingListRow): string {
  if (!row.topStop) return "—";
  if ("items" in row.topStop) return `${row.topStop.items} item berbeda`;
  return `${row.topStop.code} · ${row.topStop.name} (${row.topStop.count} peserta)`;
}

export function lastDataText(row: TrainingListRow): string {
  if (row.participants === null) return "Belum ada impor";
  const time = formatDateTime(row.lastDataAt);
  return row.stale ? `${time} (kedaluwarsa)` : time;
}

function Row({ row }: { row: TrainingListRow }) {
  return (
    <tr>
      <td>
        <div className={styles.mono}>
          {row.code} · {row.teamCode}
        </div>
        <Link className={styles.name} href={`/trainings/${row.id}`}>
          {row.name}
        </Link>
      </td>
      <td>{row.period ?? "—"}</td>
      <td>
        {row.portalUrl ? (
          <div>
            <a href={row.portalUrl} target="_blank" rel="noopener noreferrer">
              Digitalent ↗
            </a>
          </div>
        ) : null}
        <span className={`${styles.pill} ${SCHEDULE_PILL[row.schedule]}`}>
          {SCHEDULE_LABELS[row.schedule]}
        </span>
      </td>
      <td>{PHASE_LABELS[row.phase]}</td>
      <td className={styles.num}>
        {row.participants === null ? "—" : formatNumber(row.participants)}
      </td>
      <td>{row.categories ? <CompletionBar categories={row.categories} /> : "—"}</td>
      <td className={styles.num}>
        {row.averageLms === null ? "—" : formatPercent(row.averageLms)}
      </td>
      <td>{topStopText(row)}</td>
      <td>{lastDataText(row)}</td>
      <td>
        <span className={styles.pill}>{RISK_NOT_ASSESSED}</span>
      </td>
    </tr>
  );
}

/** Tabel daftar pelatihan untuk layar lebar (Web-Pelatihan.dc.html). */
export function TrainingTable({ rows }: { rows: TrainingListRow[] }) {
  return (
    <div className={`${styles.tableWrap} ${styles.desktopOnly}`}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Pelatihan</th>
            <th>Periode</th>
            <th>Halaman &amp; jadwal</th>
            <th>Status</th>
            <th className={styles.num}>Peserta</th>
            <th>Penyelesaian item</th>
            <th className={styles.num}>Rata-rata LMS</th>
            <th>Titik berhenti terbanyak</th>
            <th>Data terakhir</th>
            <th>Status risiko</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <Row key={row.id} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
