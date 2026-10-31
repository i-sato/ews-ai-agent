import { PageHeader } from "@/components/ui/PageHeader";
import styles from "@/components/ui/page.module.css";
import { LogoutButton } from "./LogoutButton";

const MESSAGES = {
  forbidden:
    "Halaman ini hanya tersedia untuk role tertentu. Hubungi Admin bila Anda memerlukannya.",
  inactive: "Akun Anda belum aktif atau belum memiliki role. Hubungi Admin.",
} as const;

export function AccessDenied({ reason }: { reason: keyof typeof MESSAGES }) {
  return (
    <>
      <PageHeader title="Akses ditolak" />
      <div className={styles.body}>
        <p className={styles.notice} role="status">
          {MESSAGES[reason]}
        </p>
        {reason === "inactive" ? <LogoutButton /> : null}
      </div>
    </>
  );
}
