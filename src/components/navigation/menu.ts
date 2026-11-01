// Menu utama sesuai docs/design (Main.dc.html, M-Dashboard.dc.html, M-Lainnya.dc.html).
// Jangan menambah menu di luar desain.
import { type Role, hasRole } from "@/lib/auth/roles";
import type { IconName } from "./icons";

export type MenuItem = {
  label: string;
  href: string;
  icon: IconName;
  /** Label tab bawah mobile bila berbeda dari label web. */
  tabLabel?: string;
  /** Item di layar "Lainnya" (mobile) beserta deskripsinya. */
  moreDescription?: string;
  /** Hanya tampil untuk role ini (M-Lainnya.dc.html: Pengaturan hanya untuk Admin). */
  roles?: readonly Role[];
};

export const MAIN_MENU: readonly MenuItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "dashboard" },
  { label: "Pelatihan", href: "/trainings", icon: "trainings" },
  {
    label: "Peserta",
    href: "/participants",
    icon: "participants",
    moreDescription: "Progres dan risiko individu",
  },
  { label: "Pemantauan Risiko", href: "/risk-monitoring", icon: "risk", tabLabel: "Risiko" },
  {
    label: "Indikator PK",
    href: "/pk-indicators",
    icon: "pk",
    moreDescription: "Dokumen, indikator, pemetaan",
  },
  { label: "Laporan", href: "/reports", icon: "reports" },
  {
    label: "Pengaturan",
    href: "/settings",
    icon: "settings",
    moreDescription: "Sumber data, provider AI, aturan, pengguna, audit log",
    roles: ["admin"],
  },
];

export const MORE_HREF = "/more";

export type TabItem = { label: string; href: string; icon: IconName; matches: readonly string[] };

const moreItems = MAIN_MENU.filter((m) => m.moreDescription !== undefined);

export const MORE_MENU: readonly MenuItem[] = moreItems;

/** Tab bawah mobile: menu tanpa deskripsi "Lainnya", ditambah tab Lainnya di akhir. */
export const MOBILE_TABS: readonly TabItem[] = [
  ...MAIN_MENU.filter((m) => m.moreDescription === undefined).map((m) => ({
    label: m.tabLabel ?? m.label,
    href: m.href,
    icon: m.icon,
    matches: [m.href],
  })),
  {
    label: "Lainnya",
    href: MORE_HREF,
    icon: "more",
    matches: [MORE_HREF, ...moreItems.map((m) => m.href)],
  },
];

export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Menu yang boleh tampil untuk role yang diverifikasi di server. Bukan pengganti otorisasi. */
export function visibleFor(items: readonly MenuItem[], role: Role): MenuItem[] {
  return items.filter((m) => !m.roles || hasRole(role, m.roles));
}
