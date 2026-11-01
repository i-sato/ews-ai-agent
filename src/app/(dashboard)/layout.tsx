import type { ReactNode } from "react";
import { BottomTabs } from "@/components/navigation/BottomTabs";
import { Sidebar } from "@/components/navigation/Sidebar";
import styles from "./layout.module.css";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <Sidebar />
      <main className={styles.main}>{children}</main>
      <BottomTabs />
    </div>
  );
}
