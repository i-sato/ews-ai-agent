import type { ReactNode } from "react";
import { AccessDenied } from "@/components/auth/AccessDenied";
import { ComplianceLink } from "@/components/compliance/ComplianceLink";
import { BottomTabs } from "@/components/navigation/BottomTabs";
import { Sidebar } from "@/components/navigation/Sidebar";
import { UserCard } from "@/components/navigation/UserCard";
import { requireUser } from "@/lib/auth/require-role";
import styles from "./layout.module.css";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const access = await requireUser();
  if (!access.ok) {
    return (
      <main className={styles.main}>
        <AccessDenied reason={access.reason} />
      </main>
    );
  }
  return (
    <div className={styles.shell}>
      <Sidebar role={access.user.role} footer={<UserCard user={access.user} />} />
      <main className={styles.main}>
        {children}
        <footer className={styles.mobileFooter}>
          <ComplianceLink />
        </footer>
      </main>
      <BottomTabs />
    </div>
  );
}
