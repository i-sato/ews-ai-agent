import type { Metadata } from "next";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { DesktopRedirect } from "@/components/navigation/DesktopRedirect";
import { MoreMenu } from "@/components/navigation/MoreMenu";
import moreStyles from "@/components/navigation/more.module.css";
import { PageHeader } from "@/components/ui/PageHeader";
import styles from "@/components/ui/page.module.css";

export const metadata: Metadata = { title: "Lainnya" };

// Layar "Lainnya" mobile (M-Lainnya.dc.html); keputusan rute /more di docs/decisions.md.
export default function MorePage() {
  return (
    <>
      <DesktopRedirect to="/dashboard" />
      <PageHeader title="Lainnya" />
      <div className={styles.body}>
        <MoreMenu />
        <LogoutButton className={moreStyles.logout} />
      </div>
    </>
  );
}
