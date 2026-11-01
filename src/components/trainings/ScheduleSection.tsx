import type { TrainingDetail } from "@/modules/ingestion/application/training-detail";
import { SCHEDULE_LABELS, formatDateTime } from "./format";
import { ScheduleForm } from "./ScheduleForm";
import styles from "./detail.module.css";

type Training = TrainingDetail["training"];

const SOURCE_LABELS = { manual: "Manual dari halaman pelatihan", official_api: "API resmi" };

/** Pemeriksaan jadwal yang dapat dihitung dari data tersimpan (§3.6). */
export function scheduleChecks(detail: TrainingDetail): [boolean, string][] {
  const t = detail.training;
  const checks: [boolean, string][] = [];
  if (t.registrationEnd && t.startDate) {
    const ok = t.registrationEnd < t.startDate;
    checks.push([
      ok,
      ok
        ? "Pendaftaran ditutup sebelum pelaksanaan dimulai."
        : "Pendaftaran belum ditutup saat pelaksanaan dimulai.",
    ]);
  }
  if (detail.freshness?.labelNotUpdated) {
    checks.push([
      false,
      "Label UPDATE TERAKHIR di sheet tidak diperbarui padahal isi berubah. " +
        "Kesegaran memakai waktu perubahan isi.",
    ]);
  }
  return checks;
}

function Field({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className={styles.tile}>
      <div className={styles.tileLabel}>{label}</div>
      <div>{value}</div>
      {note ? <div className={styles.tileNote}>{note}</div> : null}
    </div>
  );
}

function sourceNote(t: Training): string {
  if (t.scheduleVerifiedAt) return `Diverifikasi ${formatDateTime(t.scheduleVerifiedAt)}`;
  return SCHEDULE_LABELS[t.schedule];
}

export function ScheduleSection({ detail, canEdit }: { detail: TrainingDetail; canEdit: boolean }) {
  const t = detail.training;
  return (
    <section className={styles.section} aria-label="Jadwal pelatihan">
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>Jadwal &amp; halaman pelatihan</h2>
        {t.portalUrl ? (
          <a href={t.portalUrl} target="_blank" rel="noopener noreferrer">
            Halaman pelatihan ↗
          </a>
        ) : null}
      </div>
      <div className={styles.tiles}>
        <Field label="Pendaftaran" value={t.registration ?? "Belum diisi"} />
        <Field label="Pelaksanaan" value={t.period ?? "Belum diisi"} />
        <Field
          label="Sumber jadwal"
          value={t.scheduleSource ? SOURCE_LABELS[t.scheduleSource] : "Belum diisi"}
          note={sourceNote(t)}
        />
      </div>
      <ul className={styles.checks}>
        {scheduleChecks(detail).map(([ok, text]) => (
          <li key={text}>
            <span className={ok ? styles.ok : styles.warn}>{ok ? "✓" : "!"}</span> {text}
          </li>
        ))}
      </ul>
      <p className={styles.notice}>
        Jadwal tidak diambil otomatis: halaman Digitalent dirender di browser dan API-nya
        mengembalikan data terenkripsi. Tautan disimpan sebagai rujukan sampai tersedia akses data
        resmi.
      </p>
      {canEdit ? (
        <ScheduleForm
          trainingId={t.id}
          values={{
            registrationStart: t.registrationStart ?? "",
            registrationEnd: t.registrationEnd ?? "",
            startDate: t.startDate ?? "",
            endDate: t.endDate ?? "",
          }}
        />
      ) : null}
    </section>
  );
}
