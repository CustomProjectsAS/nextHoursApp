import { getAuthContext } from "@/lib/auth";
import { okNext, failNext } from "@/lib/api/nextResponse";
import { withRequestId } from "@/lib/api/withRequestId";
import { log } from "@/lib/log";

export const GET = withRequestId(async (req, requestId) => {
  try {
    const ctx = await getAuthContext(req);

    if (!ctx) {
      log.warn("AUTH_REQUIRED", { requestId, path: "/api/auth/me" });
      return failNext("AUTH_REQUIRED", "Unauthorized", 401, undefined, requestId);
    }

    log.info("AUTH_OK", { requestId, path: "/api/auth/me" });

    return okNext(ctx, undefined, requestId);
  } catch (err: unknown) {
    log.error("AUTH_ME_FAILED", { requestId, path: "/api/auth/me", err });
    return failNext("INTERNAL", "Internal server error", 500, undefined, requestId);
  }
});
