import { prisma } from "@/lib/prisma";
import { okNext, failNext } from "@/lib/api/nextResponse";
import { getOrCreateRequestId } from "@/lib/requestId";
import { log } from "@/lib/log";
import { env } from "@/lib/env";


export async function GET(req: Request) {
  const requestId = getOrCreateRequestId(req);
  const route = "GET /api/health";


  const version = env.APP_VERSION ?? "unknown";
  const timestamp = new Date().toISOString();

  try {
    await prisma.$queryRaw`SELECT 1`;

    return okNext(
      {
        version,
        db: { ok: true },
        timestamp,
      },
      undefined,
      requestId
    );
  } catch (err: any) {
    log.error("INTERNAL: health GET", {
      requestId,
      route,
      statusCode: 503,
      errorCode: "INTERNAL",
      errorName: err?.name,
      errorMessage: err?.message,
    });


    return failNext(
      "INTERNAL",
      "Service unavailable",
      503,
      undefined,
      requestId
    );
  }
}
