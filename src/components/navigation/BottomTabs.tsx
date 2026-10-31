import { Icon } from "./icons";
import { MOBILE_TABS } from "./menu";
import { NavLink } from "./NavLink";
import styles from "./navigation.module.css";

/** Tab bawah mobile (M-Dashboard.dc.html). Hanya tampil di layar sempit. */
export function BottomTabs() {
  return (
    <nav aria-label="Menu utama" className={styles.tabs}>
      {MOBILE_TABS.map((t) => (
        <NavLink key={t.href} href={t.href} matches={t.matches} className={styles.tab}>
          <Icon name={t.icon} />
          <span>{t.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
