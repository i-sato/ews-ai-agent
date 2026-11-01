import { withApi } from "@/lib/api/handler";
import { readJson, resultResponse } from "@/lib/api/http";
import { ADMIN_ONLY } from "@/lib/api/roles";
import { ingestionDeps } from "@/lib/container";
import { registerTraining } from "@/modules/ingestion/application/register-training";

// §7.1, §3.7: simpan pelatihan setelah Admin mengonfirmasi; tata letak sheet diperiksa tanpa impor.
export function POST(request: Request) {
  return withApi(ADMIN_ONLY, async ({ requestId, actor, session }) => {
    const body = await readJson(request, requestId);
    if (!body.ok) return body.response;
    const deps = await ingestionDeps(session);
    return resultResponse(requestId, await registerTraining(deps, body.value, actor), 201);
  });
}
