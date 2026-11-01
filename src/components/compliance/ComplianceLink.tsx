import Link from "next/link";

export const COMPLIANCE_PATH = "/compliance";

/** Tautan "Pernyataan kepatuhan" di bagian bawah setiap halaman (spesifikasi §11.3). */
export function ComplianceLink({ className }: { className?: string }) {
  return (
    <Link href={COMPLIANCE_PATH} className={className}>
      Pernyataan kepatuhan
    </Link>
  );
}
