// app/api/projects/route.ts
import { okNext, failNext } from "@/lib/api/nextResponse";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth";
import { getOrCreateRequestId } from "@/lib/requestId";
import { log } from "@/lib/log";


export async function GET(req: Request) {
  const requestId = getOrCreateRequestId(req);
  const route = "GET /api/projects";


  const ctx = await getAuthContext(req);
  if (!ctx) {
    log.warn("AUTH_REQUIRED: projects GET", {
      requestId,
      route,
      statusCode: 401,
      errorCode: "AUTH_REQUIRED",
    });

    return failNext("AUTH_REQUIRED", "Unauthorized", 401, undefined, requestId);
  }


  try {
    const projects = await prisma.project.findMany({
      where: {
        companyId: ctx.companyId,
        isActive: true,
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        color: true,
      },
    });

    return okNext({ projects }, undefined, requestId);


  } catch (error: any) {
    log.error("INTERNAL: projects GET", {
      requestId,
      route,
      statusCode: 500,
      errorCode: "INTERNAL",
      errorName: error?.name,
      errorMessage: error?.message,
    });

    return failNext("INTERNAL", "Failed to load projects", 500, undefined, requestId);
  }


}

// Public creation is not allowed in SaaS (must be admin-scoped)
export async function POST(req: Request) {
  const requestId = getOrCreateRequestId(req);
  const route = "POST /api/projects";

  log.warn("FORBIDDEN: projects POST (public disabled)", {
    requestId,
    route,
    statusCode: 403,
    errorCode: "FORBIDDEN",
  });

  return failNext("FORBIDDEN", "Forbidden", 403, undefined, requestId);
}

