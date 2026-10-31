import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Dipakai smoke test pascadeploy dan webServer Playwright. Tanpa detail internal. */
export function GET() {
  return NextResponse.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
}
