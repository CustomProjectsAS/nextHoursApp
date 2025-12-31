// NOTE: Legacy route. Use POST /api/admin/invite instead.

import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth";
import { okNext, failNext } from "@/lib/api/nextResponse";
import { getOrCreateRequestId } from "@/lib/requestId";
import { log } from "@/lib/log";


export async function POST(req: Request) {

  const requestId = getOrCreateRequestId(req);
  const ctx = await getAuthContext(req);
  if (!ctx) {
    log.warn("AUTH_REQUIRED: admin/employees POST", { requestId });
    return failNext("AUTH_REQUIRED", "Unauthorized", 401, undefined, requestId);

  }
  if (ctx.role !== "ADMIN" && ctx.role !== "OWNER") {
    log.warn("FORBIDDEN: admin/employees (legacy)", { requestId, role: ctx.role });
    return failNext("FORBIDDEN", "Forbidden", 403, undefined, requestId);
  }

  log.warn("LEGACY_DISABLED: admin/employees", { requestId });
  return failNext(
    "BAD_REQUEST",
    "Legacy endpoint disabled. Use POST /api/admin/invite.",
    410,
    undefined,
    requestId
  );


}
