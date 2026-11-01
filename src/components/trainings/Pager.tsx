import Link from "next/link";
import styles from "./trainings.module.css";

type PagerProps = {
  page: number;
  pageSize: number;
  total: number;
  /** Membuat href untuk halaman tertentu dengan query lain dipertahankan. */
  hrefFor: (page: number) => string;
  noun: string;
  note?: string;
};

/** "Menampilkan 1–10 dari 12 pelatihan" dengan tautan Sebelumnya/Berikutnya. */
export function Pager({ page, pageSize, total, hrefFor, noun, note }: PagerProps) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className={styles.footer}>
      <span>
        Menampilkan {from}–{to} dari {total} {noun}.{note ? ` ${note}` : ""}
      </span>
      <nav className={styles.pager} aria-label="Halaman">
        {page > 1 ? <Link href={hrefFor(page - 1)}>Sebelumnya</Link> : null}
        {to < total ? <Link href={hrefFor(page + 1)}>Berikutnya</Link> : null}
      </nav>
    </div>
  );
}
