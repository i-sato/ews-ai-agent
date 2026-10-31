import type { CurrentUser } from "@/lib/auth/current-user";
import { ROLE_LABELS } from "@/lib/auth/roles";
import styles from "./more.module.css";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join("") || "?";
}

/** Kartu profil di layar Lainnya (M-Lainnya.dc.html). */
export function ProfileSummary({ user }: { user: CurrentUser }) {
  return (
    <div className={styles.profile}>
      <div className={styles.avatar} aria-hidden="true">
        {initials(user.displayName)}
      </div>
      <div>
        <div className={styles.profileName}>{user.displayName}</div>
        <div className={styles.description}>Role: {ROLE_LABELS[user.role]}</div>
      </div>
    </div>
  );
}
