import type { Category } from "@/modules/ingestion/application/view-types";
import { CATEGORY_ORDER, categorySummary } from "./format";
import styles from "./trainings.module.css";

const FILL: Record<Category, string> = {
  not_started: "#d0d5dd",
  partial: "#9db4f0",
  completed: "#1f4fd1",
  check: "#f79009",
};

/**
 * Bar bertumpuk kategori penyelesaian. SVG, bukan atribut `style`, karena CSP produksi memblokir
 * style inline (SH-HDR-01). Teks ringkasan menyertai warna (status tidak hanya dengan warna).
 */
export function CompletionBar({
  categories,
  showText = true,
}: {
  categories: Record<Category, number>;
  showText?: boolean;
}) {
  const total = CATEGORY_ORDER.reduce((n, c) => n + categories[c], 0);
  let x = 0;
  const label = categorySummary(categories);
  return (
    <div>
      <svg
        className={styles.bar}
        viewBox="0 0 100 8"
        preserveAspectRatio="none"
        role="img"
        aria-label={label}
      >
        {total > 0
          ? CATEGORY_ORDER.map((c) => {
              const width = (categories[c] / total) * 100;
              const rect = <rect key={c} x={x} y={0} width={width} height={8} fill={FILL[c]} />;
              x += width;
              return rect;
            })
          : null}
      </svg>
      {showText ? <div className={styles.barText}>{label}</div> : null}
    </div>
  );
}

/** Progres satu item (selesai dari penyebut), juga SVG. */
export function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const width = max > 0 ? (value / max) * 100 : 0;
  return (
    <svg
      className={styles.bar}
      viewBox="0 0 100 8"
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
    >
      <rect x={0} y={0} width={width} height={8} fill="#1f4fd1" />
    </svg>
  );
}
