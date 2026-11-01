import type { NextConfig } from "next";

// Header keamanan dasar (SH-HDR-02, SH-HDR-03). CSP dengan nonce dipasang di proxy (F1-06).
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // Indikator dev di kiri bawah menutupi tombol Keluar di sidebar dan tab Dashboard di mobile.
  devIndicators: { position: "top-right" },
  experimental: {
    // Next 16.4.2: cache dev Turbopack yang dipakai ulang setelah restart memicu loop muat
    // ulang ("HMR hash mismatch"). Matikan sampai versi Next diperbarui.
    turbopackFileSystemCacheForDev: false,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
