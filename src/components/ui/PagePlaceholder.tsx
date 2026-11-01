import { PageHeader } from "./PageHeader";
import styles from "./page.module.css";

/** Halaman kerangka F1-03: judul dan status belum diimplementasi. */
export function PagePlaceholder({ title }: { title: string }) {
  return (
    <>
      <PageHeader title={title} />
      <div className={styles.body}>
        <p className={styles.notice} role="status">
          Belum diimplementasi
        </p>
      </div>
    </>
  );
}
