import type { Metadata } from "next";
import Link from "next/link";
import { currentComplianceStatement } from "@/modules/shared/application/compliance-statement";
import styles from "./compliance.module.css";

export const metadata: Metadata = { title: "Pernyataan kepatuhan" };

// Halaman publik (tanpa login) agar dapat dirujuk dari halaman login dan dokumen laporan.
export default function CompliancePage() {
  const statement = currentComplianceStatement();
  return (
    <main className={styles.page}>
      <article className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.logo} aria-hidden="true">
            EWS
          </span>
          EWS AI Agent
        </div>
        <h1 className={styles.title}>Pernyataan kepatuhan</h1>
        <p className={styles.meta}>
          Versi {statement.version} · berlaku {statement.effectiveDateLabel}
        </p>
        {statement.isDraft ? (
          <p className={styles.draft}>
            Draf: teks ini menunggu tinjauan fungsi hukum dan pengelola data instansi.
          </p>
        ) : null}
        <p className={styles.text}>{statement.text}</p>
        <Link href="/dashboard" className={styles.back}>
          Kembali ke aplikasi
        </Link>
      </article>
    </main>
  );
}
