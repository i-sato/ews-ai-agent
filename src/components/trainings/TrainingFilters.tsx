import { PHASE_LABELS } from "./format";
import styles from "./trainings.module.css";

const TEAMS: [string, string][] = [
  ["DTA", "DTA · Digital Talent Academy"],
  ["GTA", "GTA · Government Transformation Academy"],
  ["KDD", "KDD · Keterampilan Digital Dasar"],
];

export type FilterValues = { q?: string; year?: string; team?: string; phase?: string };

/** Filter daftar pelatihan lewat query string (GET), tanpa JavaScript klien. */
export function TrainingFilters({ values, years }: { values: FilterValues; years: number[] }) {
  return (
    <form className={styles.filters} method="get" aria-label="Filter pelatihan">
      <label className={styles.field}>
        Cari pelatihan
        <input
          name="q"
          type="search"
          placeholder="Kode atau nama pelatihan"
          defaultValue={values.q}
        />
      </label>
      <label className={styles.field}>
        Tahun
        <select name="year" defaultValue={values.year ?? ""}>
          <option value="">Semua tahun</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        Tim kerja
        <select name="team" defaultValue={values.team ?? ""}>
          <option value="">Semua tim kerja</option>
          {TEAMS.map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        Status pelatihan
        <select name="phase" defaultValue={values.phase ?? ""}>
          <option value="">Semua status</option>
          {Object.entries(PHASE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className={styles.button}>
        Terapkan
      </button>
    </form>
  );
}
