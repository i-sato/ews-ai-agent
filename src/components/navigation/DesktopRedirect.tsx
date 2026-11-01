"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const DESKTOP_QUERY = "(min-width: 768px)";

/** Layar khusus mobile (mis. Lainnya) tidak dipakai di web; alihkan bila layar lebar. */
export function DesktopRedirect({ to }: { to: string }) {
  const router = useRouter();
  useEffect(() => {
    const media = window.matchMedia(DESKTOP_QUERY);
    const redirect = () => {
      if (media.matches) router.replace(to);
    };
    redirect();
    media.addEventListener("change", redirect);
    return () => media.removeEventListener("change", redirect);
  }, [router, to]);
  return null;
}
