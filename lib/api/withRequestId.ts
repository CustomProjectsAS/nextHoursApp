// lib/api/withRequestId.ts
import type { NextResponse } from "next/server";
import { getOrCreateRequestId } from "@/lib/requestId";
import { log } from "@/lib/log";

/**
 * Wraps a route handler to guarantee:
 * - requestId exists
 * - x-request-id header is present on all responses (even if handler forgets)
 * - a consistent error fallback if the handler throws
 */
export function withRequestId(
  handler: (req: Request, requestId: string) => Promise<Response | NextResponse>
) {
  return async (req: Request) => {
    const requestId = getOrCreateRequestId(req);

    try {
      const res = await handler(req, requestId);

      // Ensure header is always present, even if handler didn’t set it.
      // Clone into a new Response to safely adjust headers.
      const headers = new Headers(res.headers);
      if (!headers.get("x-request-id")) headers.set("x-request-id", requestId);

      return new Response(res.body, {
        status: res.status,
        statusText: res.statusText,
        headers,
      });
    } catch (err: unknown) {
      log.error("UNHANDLED_ROUTE_ERROR", {
        requestId,
        path: new URL(req.url).pathname,
        err,
      });

      return new Response(
        JSON.stringify({
          ok: false,
          error: { code: "INTERNAL", message: "Internal server error", requestId },
        }),
        {
          status: 500,
          headers: {
            "content-type": "application/json",
            "x-request-id": requestId,
          },
        }
      );
    }
  };
}
