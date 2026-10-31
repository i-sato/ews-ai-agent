import { LogoutButton } from "@/components/auth/LogoutButton";
import type { CurrentUser } from "@/lib/auth/current-user";
import { ROLE_LABELS } from "@/lib/auth/roles";
import styles from "./navigation.module.css";

/** Kartu pengguna di bawah sidebar (Main.dc.html) dengan tombol Keluar (docs/decisions.md). */
export function UserCard({ user }: { user: CurrentUser }) {
  return (
    <div className={styles.userCard}>
      <div className={styles.userName}>{user.displayName}</div>
      <div className={styles.userRole}>Role: {ROLE_LABELS[user.role]}</div>
      <LogoutButton className={styles.logout} />
    </div>
  );
}
