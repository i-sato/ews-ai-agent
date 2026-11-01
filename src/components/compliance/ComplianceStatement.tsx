import styles from "./compliance.module.css";

// Spesifikasi §11.3 (draf; teks final ditinjau fungsi hukum, penyimpanan berversi di F1-08).
export const COMPLIANCE_TEXT =
  "Aplikasi ini dirancang dan dioperasikan dengan mengacu pada UU No. 27 Tahun 2022 tentang " +
  "Pelindungan Data Pribadi, PP No. 71 Tahun 2019 tentang Penyelenggaraan Sistem dan Transaksi " +
  "Elektronik, Perpres No. 95 Tahun 2018 tentang Sistem Pemerintahan Berbasis Elektronik, " +
  "Perpres No. 39 Tahun 2019 tentang Satu Data Indonesia, serta kebijakan internal instansi. " +
  "Data peserta hanya digunakan untuk pemantauan dan pelaporan pelatihan, diakses sesuai " +
  "kewenangan, dan tidak dikirim ke penyedia AI dalam bentuk yang mengidentifikasi peserta. " +
  "Status risiko dan rekomendasi AI adalah alat bantu; keputusan tetap berada pada petugas " +
  "yang berwenang.";

/** Teks lengkap di web (Web-Login.dc.html); dapat dilipat di mobile (M-Login.dc.html). */
export function ComplianceStatement() {
  return (
    <>
      <section aria-label="Pernyataan kepatuhan" className={styles.full}>
        <div className={styles.heading}>Pernyataan kepatuhan</div>
        {COMPLIANCE_TEXT}
      </section>
      <details className={styles.collapsible}>
        <summary className={styles.heading}>Pernyataan kepatuhan</summary>
        <p className={styles.text}>{COMPLIANCE_TEXT}</p>
      </details>
    </>
  );
}
