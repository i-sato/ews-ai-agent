import { withApi } from "@/lib/api/handler";
import { readJson, resultResponse } from "@/lib/api/http";
import { TRAINING_MANAGERS } from "@/lib/api/roles";
import { ingestionDeps } from "@/lib/container";
import { updateSchedule } from "@/modules/ingestion/application/update-schedule";

type Params = { params: Promise<{ id: string }> };

// §7.1, §3.6: jadwal pendaftaran dan pelaksanaan beserta sumber dan verifikasinya.
export function PUT(request: Request, { params }: Params) {
  return withApi(TRAINING_MANAGERS, async ({ requestId, actor, session }) => {
    const body = await readJson(request, requestId);
    if (!body.ok) return body.response;
    const input = { ...(body.value as object), trainingId: (await params).id };
    const deps = await ingestionDeps(session);
    return resultResponse(requestId, await updateSchedule(deps, input, actor));
  });
}
