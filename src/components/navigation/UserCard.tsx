import { LogoutButton } from "@/components/auth/LogoutButton";
import styles from "./navigation.module.css";

/** Kartu pengguna di bawah sidebar (Main.dc.html) dengan tombol Keluar (docs/decisions.md). */
export function UserCard() {
  return (
    <div className={styles.userCard}>
      <LogoutButton className={styles.logout} />
    </div>
  );
}
