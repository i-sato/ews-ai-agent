import { withApi } from "@/lib/api/handler";
import { readJson, resultResponse } from "@/lib/api/http";
import { TRAINING_MANAGERS } from "@/lib/api/roles";
import { ingestionDeps } from "@/lib/container";
import { commitImport } from "@/modules/ingestion/application/commit-import";

// §7.1, §3.4, §7.4: konfirmasi impor; idempoten dengan idempotency_key, validasi ulang sumber.
export function POST(request: Request) {
  return withApi(TRAINING_MANAGERS, async ({ requestId, actor, session }) => {
    const body = await readJson(request, requestId);
    if (!body.ok) return body.response;
    const deps = await ingestionDeps(session);
    return resultResponse(requestId, await commitImport(deps, body.value, actor));
  });
}
