import { withApi } from "@/lib/api/handler";
import { readJson, resultResponse } from "@/lib/api/http";
import { ADMIN_ONLY } from "@/lib/api/roles";
import { ingestionDeps } from "@/lib/container";
import { parseTrainingSource } from "@/modules/ingestion/application/parse-training-source";

// §7.1: usulan tim kerja, ID, skema, dan periode dari tautan sheet dan portal; tidak menulis data.
export function POST(request: Request) {
  return withApi(ADMIN_ONLY, async ({ requestId, actor, session }) => {
    const body = await readJson(request, requestId);
    if (!body.ok) return body.response;
    const deps = await ingestionDeps(session);
    return resultResponse(requestId, await parseTrainingSource(deps, body.value, actor));
  });
}
