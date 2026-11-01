import type { Metadata } from "next";
import { AccessDenied } from "@/components/auth/AccessDenied";
import { PagePlaceholder } from "@/components/ui/PagePlaceholder";
import { requireRole } from "@/lib/auth/require-role";

export const metadata: Metadata = { title: "Pengaturan" };

// Spesifikasi §11.1: pengguna, sumber data, provider AI, dan konfigurasi hanya untuk Admin.
export default async function SettingsPage() {
  const access = await requireRole(["admin"]);
  if (!access.ok) return <AccessDenied reason={access.reason} />;
  return <PagePlaceholder title="Pengaturan" />;
}
