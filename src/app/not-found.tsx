import type { Metadata } from "next";
import Link from "next/link";
import styles from "./not-found.module.css";

export const metadata: Metadata = { title: "Halaman tidak ditemukan" };

// Pengganti 404 bawaan Next.js yang memakai style inline dan diblokir CSP (SH-HDR-01).
export default function NotFound() {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Halaman tidak ditemukan</h1>
      <p className={styles.text}>Alamat yang Anda buka tidak tersedia atau sudah dipindahkan.</p>
      <Link href="/dashboard" className={styles.link}>
        Kembali ke Dashboard
      </Link>
    </main>
  );
}
