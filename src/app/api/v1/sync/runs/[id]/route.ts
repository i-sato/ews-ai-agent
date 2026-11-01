import { withApi } from "@/lib/api/handler";
import { resultResponse } from "@/lib/api/http";
import { ANY_ROLE } from "@/lib/api/roles";
import { ingestionDeps } from "@/lib/container";
import { getSyncRun } from "@/modules/ingestion/application/sync-runs";

type Params = { params: Promise<{ id: string }> };

// §7.1: status sinkronisasi. Run milik tim lain tidak terlihat (RLS) sehingga 404.
export function GET(_request: Request, { params }: Params) {
  return withApi(ANY_ROLE, async ({ requestId, session }) => {
    const deps = await ingestionDeps(session);
    return resultResponse(requestId, await getSyncRun(deps, { runId: (await params).id }));
  });
}
