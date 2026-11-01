import type { ReactNode } from "react";
import styles from "./page.module.css";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  /** Breadcrumb atau tautan kembali di atas judul. */
  eyebrow?: ReactNode;
  /** Isi tambahan di samping judul (mis. pill status). */
  children?: ReactNode;
};

/** Header halaman: putih di web (Main.dc.html), gelap dengan logo di mobile (M-*.dc.html). */
export function PageHeader({ title, subtitle, eyebrow, children }: PageHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.logo} aria-hidden="true">
        EWS
      </div>
      <div className={styles.titles}>
        {eyebrow ? <div className={styles.eyebrow}>{eyebrow}</div> : null}
        <h1 className={styles.title}>{title}</h1>
        {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
      </div>
      {children ? <div className={styles.extra}>{children}</div> : null}
    </header>
  );
}
