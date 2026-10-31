import styles from "./page.module.css";

/** Header halaman: putih di web (Main.dc.html), gelap dengan logo di mobile (M-*.dc.html). */
export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className={styles.header}>
      <div className={styles.logo} aria-hidden="true">
        EWS
      </div>
      <div className={styles.titles}>
        <h1 className={styles.title}>{title}</h1>
        {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
      </div>
    </header>
  );
}
