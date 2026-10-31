import { currentComplianceStatement } from "@/modules/shared/application/compliance-statement";
import styles from "./compliance.module.css";

/** Teks lengkap di web (Web-Login.dc.html); dapat dilipat di mobile (M-Login.dc.html). */
export function ComplianceStatement() {
  const { text } = currentComplianceStatement();
  return (
    <>
      <section aria-label="Pernyataan kepatuhan" className={styles.full}>
        <div className={styles.heading}>Pernyataan kepatuhan</div>
        {text}
      </section>
      <details className={styles.collapsible}>
        <summary className={styles.heading}>Pernyataan kepatuhan</summary>
        <p className={styles.text}>{text}</p>
      </details>
    </>
  );
}
