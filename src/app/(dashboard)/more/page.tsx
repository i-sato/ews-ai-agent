import type { Metadata } from "next";
import { AccessDenied } from "@/components/auth/AccessDenied";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { DesktopRedirect } from "@/components/navigation/DesktopRedirect";
import { MoreMenu } from "@/components/navigation/MoreMenu";
import { ProfileSummary } from "@/components/navigation/ProfileSummary";
import moreStyles from "@/components/navigation/more.module.css";
import { PageHeader } from "@/components/ui/PageHeader";
import styles from "@/components/ui/page.module.css";
import { requireUser } from "@/lib/auth/require-role";

export const metadata: Metadata = { title: "Lainnya" };

// Layar "Lainnya" mobile (M-Lainnya.dc.html); keputusan rute /more di docs/decisions.md.
export default async function MorePage() {
  const access = await requireUser();
  if (!access.ok) return <AccessDenied reason={access.reason} />;
  return (
    <>
      <DesktopRedirect to="/dashboard" />
      <PageHeader title="Lainnya" />
      <div className={styles.body}>
        <ProfileSummary user={access.user} />
        <MoreMenu role={access.user.role} />
        <p className={moreStyles.roleNote}>
          Menu yang tampil mengikuti role yang diverifikasi di server. Pengaturan hanya tersedia
          untuk Admin.
        </p>
        <LogoutButton className={moreStyles.logout} />
      </div>
    </>
  );
}
