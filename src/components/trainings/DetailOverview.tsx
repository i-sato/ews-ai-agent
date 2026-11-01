import type { TrainingDetail } from "@/modules/ingestion/application/training-detail";
import { CompletionBar } from "./CompletionBar";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  ITEM_TYPE_LABELS,
  formatDateTime,
  formatNumber,
} from "./format";
import styles from "./detail.module.css";

const SOURCE_LABELS: Record<string, string> = {
  google_sheets: "Google Sheets",
  csv: "Unggahan CSV",
  xlsx: "Unggahan XLSX",
};

/** Sumber dan dua waktu kesegaran: "Dicek … · isi berubah …" (§3.5, aturan UI). */
export function FreshnessStrip({ detail }: { detail: TrainingDetail }) {
  const { freshness, batch } = detail;
  if (!freshness || !batch) {
    return <p className={styles.strip}>Belum ada impor untuk pelatihan ini.</p>;
  }
  return (
    <p className={styles.strip}>
      <span>{SOURCE_LABELS[batch.sourceType] ?? batch.sourceType}</span>
      <span>
        Dicek <b>{formatDateTime(freshness.checkedAt)}</b> · isi berubah{" "}
        <b>{formatDateTime(freshness.contentChangedAt)}</b>
        {freshness.stale ? <span className={styles.warn}> (melewati batas kesegaran)</span> : null}
      </span>
      {freshness.labelNotUpdated ? (
        <span className={styles.warn}>
          Label UPDATE TERAKHIR: {formatDateTime(freshness.labelUpdatedAt)} (tidak diperbarui)
        </span>
      ) : null}
      <span className={batch.reconciliationMismatches === 0 ? styles.ok : styles.warn}>
        {batch.reconciliationMismatches === 0
          ? "Rekonsiliasi baris 1 cocok"
          : `Rekonsiliasi baris 1: ${batch.reconciliationMismatches} selisih`}
      </span>
      {batch.emptySlots > 0 ? (
        <span>{batch.emptySlots} slot item tanpa judul diabaikan</span>
      ) : null}
    </p>
  );
}

const percentOf = (n: number, of: number) =>
  of > 0 ? `${Math.round((n / of) * 100)}% dari pendaftar` : "";

/** Funnel peserta (§8.6): pendaftar tanpa batal → diterima → … → lulus. */
export function Funnel({ summary }: { summary: NonNullable<TrainingDetail["summary"]> }) {
  const f = summary.funnel;
  const steps: [string, number, string][] = [
    ["1 · Pendaftar", f.registered, "Tanpa Pembatalan"],
    ["2 · Diterima", f.accepted, percentOf(f.accepted, f.registered)],
    ["3 · Onboarding", f.onboarded, percentOf(f.onboarded, f.registered)],
    ["4 · Mulai mengerjakan", f.started, "Minimal 1 item selesai"],
    ["5 · Tuntas semua item", f.completedAll, percentOf(f.completedAll, f.registered)],
    ["6 · Lulus (STATUS)", f.passed, f.passed === 0 ? "Belum ditetapkan di sheet" : ""],
  ];
  return (
    <section className={styles.tiles} aria-label="Funnel peserta">
      {steps.map(([label, value, note]) => (
        <div key={label} className={styles.tile}>
          <div className={styles.tileLabel}>{label}</div>
          <div className={styles.tileValue}>{formatNumber(value)}</div>
          <div className={styles.tileNote}>{note}</div>
        </div>
      ))}
    </section>
  );
}

/** Kategori penyelesaian dan titik berhenti terbanyak. */
export function CompletionOverview({
  summary,
}: {
  summary: NonNullable<TrainingDetail["summary"]>;
}) {
  const total = CATEGORY_ORDER.reduce((n, c) => n + summary.categories[c], 0);
  return (
    <div className={styles.tiles}>
      <section className={styles.section} aria-label="Kategori penyelesaian item">
        <h2 className={styles.sectionTitle}>Kategori penyelesaian item</h2>
        <p className={styles.notice}>
          {total} peserta · {summary.denominator} masuk penyebut
        </p>
        <CompletionBar categories={summary.categories} showText={false} />
        <ul className={styles.checks}>
          {CATEGORY_ORDER.map((c) => (
            <li key={c}>
              <b>{summary.categories[c]}</b> {CATEGORY_LABELS[c]}
            </li>
          ))}
        </ul>
      </section>
      <section className={styles.section} aria-label="Titik berhenti terbanyak">
        <h2 className={styles.sectionTitle}>Titik berhenti terbanyak</h2>
        {summary.topStops.length === 0 ? (
          <p className={styles.notice}>Belum ada peserta yang berhenti di tengah.</p>
        ) : null}
        <ul className={styles.checks}>
          {summary.topStops.map((s) => (
            <li key={s.code}>
              <b>{s.count}</b> {s.code} · {ITEM_TYPE_LABELS[s.type]} — {s.name}
            </li>
          ))}
        </ul>
        {summary.otherStops.items > 0 ? (
          <p className={styles.notice}>
            {summary.otherStops.participants} peserta lain berhenti di {summary.otherStops.items}{" "}
            item berbeda.
          </p>
        ) : null}
      </section>
    </div>
  );
}
