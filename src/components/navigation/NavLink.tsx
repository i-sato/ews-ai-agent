"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { isActivePath } from "./menu";

type NavLinkProps = {
  href: string;
  /** Path lain yang membuat tautan ini aktif (mis. tab Lainnya untuk /participants). */
  matches?: readonly string[];
  className?: string;
  children: ReactNode;
};

export function NavLink({ href, matches = [href], className, children }: NavLinkProps) {
  const pathname = usePathname();
  const active = matches.some((m) => isActivePath(pathname, m));
  return (
    <Link href={href} className={className} aria-current={active ? "page" : undefined}>
      {children}
    </Link>
  );
}
