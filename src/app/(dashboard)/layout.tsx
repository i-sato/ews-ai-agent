import type { ReactNode } from "react";
import { BottomTabs } from "@/components/navigation/BottomTabs";
import { Sidebar } from "@/components/navigation/Sidebar";
import { UserCard } from "@/components/navigation/UserCard";
import { requireSession } from "@/lib/auth/session";
import styles from "./layout.module.css";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  await requireSession();
  return (
    <div className={styles.shell}>
      <Sidebar footer={<UserCard />} />
      <main className={styles.main}>{children}</main>
      <BottomTabs />
    </div>
  );
}
