import type { ReactNode } from "react";
import { ComplianceLink } from "@/components/compliance/ComplianceLink";
import type { Role } from "@/lib/auth/roles";
import { MAIN_MENU, visibleFor } from "./menu";
import { NavLink } from "./NavLink";
import styles from "./navigation.module.css";

/** Sidebar web (Main.dc.html). Disembunyikan di layar sempit; diganti BottomTabs. */
export function Sidebar({ role, footer }: { role: Role; footer?: ReactNode }) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <div className={styles.logo} aria-hidden="true">
          EWS
        </div>
        <div>
          <div className={styles.brandName}>EWS AI Agent</div>
          <div className={styles.brandTagline}>Early Warning System Pelatihan</div>
        </div>
      </div>
      <nav aria-label="Menu utama" className={styles.sideNav}>
        {visibleFor(MAIN_MENU, role).map((m) => (
          <NavLink key={m.href} href={m.href} className={styles.sideLink}>
            {m.label}
          </NavLink>
        ))}
      </nav>
      {footer}
      <ComplianceLink className={styles.complianceLink} />
    </aside>
  );
}
