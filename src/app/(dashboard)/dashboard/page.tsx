import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/ui/PagePlaceholder";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return <PagePlaceholder title="Dashboard" />;
}
