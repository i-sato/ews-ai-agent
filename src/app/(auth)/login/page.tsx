import type { Metadata } from "next";
import { ComplianceStatement } from "@/components/compliance/ComplianceStatement";
import { LoginForm } from "./LoginForm";
import styles from "./login.module.css";

export const metadata: Metadata = { title: "Masuk" };

type LoginPageProps = { searchParams: Promise<{ next?: string | string[] }> };

// Web-Login.dc.html dan M-Login.dc.html. Tidak ada halaman daftar (SH-AUTH-03).
// "Lupa kata sandi?" ditunda sampai alur reset dibuat (docs/decisions.md).
export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next } = await searchParams;
  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <div className={styles.brand}>
          <div className={styles.logo} aria-hidden="true">
            EWS
          </div>
          <div className={styles.brandName}>EWS AI Agent</div>
        </div>
        <div className={styles.pitch}>
          <h1 className={styles.headline}>Pantau capaian pelatihan sebelum target terlewat.</h1>
          <p className={styles.lead}>
            Early Warning System untuk risiko capaian indikator PK dan risiko individu peserta.
          </p>
        </div>
      </div>
      <main className={styles.panel}>
        <div className={styles.column}>
          <LoginForm next={typeof next === "string" ? next : undefined} />
          <ComplianceStatement />
        </div>
      </main>
    </div>
  );
}
