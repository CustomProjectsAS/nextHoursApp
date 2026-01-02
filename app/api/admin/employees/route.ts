// NOTE: Legacy route. Use POST /api/admin/invite instead.
// This endpoint is intentionally disabled and must short-circuit without auth/DB.

import { failNext } from "@/lib/api/nextResponse";
import { getOrCreateRequestId } from "@/lib/requestId";
import { log } from "@/lib/log";

export async function POST(req: Request) {
  const requestId = getOrCreateRequestId(req);

  log.warn("LEGACY_DISABLED: admin/employees", { requestId });

  return failNext(
    "BAD_REQUEST",
    "Legacy endpoint disabled. Use POST /api/admin/invite.",
    410,
    undefined,
    requestId
  );
}
