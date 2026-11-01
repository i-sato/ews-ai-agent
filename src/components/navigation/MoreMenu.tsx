import Link from "next/link";
import { Icon } from "./icons";
import { MORE_MENU } from "./menu";
import styles from "./more.module.css";

/** Daftar menu layar "Lainnya" (M-Lainnya.dc.html). */
export function MoreMenu() {
  return (
    <nav aria-label="Menu lainnya" className={styles.list}>
      {MORE_MENU.map((m) => (
        <Link key={m.href} href={m.href} className={styles.item}>
          <span className={styles.icon}>
            <Icon name={m.icon} />
          </span>
          <span className={styles.text}>
            <span className={styles.label}>{m.label}</span>
            <span className={styles.description}>{m.moreDescription}</span>
          </span>
          <span className={styles.chevron}>
            <Icon name="chevron" size={18} />
          </span>
        </Link>
      ))}
    </nav>
  );
}
