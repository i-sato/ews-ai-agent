import { withApi, withCron } from "@/lib/api/handler";
import { readJson, resultResponse } from "@/lib/api/http";
import { TRAINING_MANAGERS } from "@/lib/api/roles";
import { ingestionDeps } from "@/lib/container";
import { syncAllSources } from "@/modules/ingestion/application/sync-runs";
import { syncSheet } from "@/modules/ingestion/application/sync-sheet";

// §3.5, §7.1. Vercel Cron memanggil GET dengan Bearer CRON_SECRET: semua sumber Google aktif,
// berurutan, service role. POST: sinkron manual satu sumber oleh pengguna, dengan batas frekuensi.
export function GET(request: Request) {
  return withCron(request, async (requestId) => {
    const results = await syncAllSources(await ingestionDeps(null));
    return resultResponse(requestId, { ok: true, value: { results } });
  });
}

export function POST(request: Request) {
  return withApi(TRAINING_MANAGERS, async ({ requestId, actor, session }) => {
    const body = await readJson(request, requestId);
    if (!body.ok) return body.response;
    const input = { ...(body.value as object), trigger: "manual" };
    const deps = await ingestionDeps(session);
    return resultResponse(requestId, await syncSheet(deps, input, actor));
  });
}
