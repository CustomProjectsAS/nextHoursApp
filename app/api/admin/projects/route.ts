import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth";
import { okNext, failNext } from "@/lib/api/nextResponse";
import { getOrCreateRequestId } from "@/lib/requestId";
import { log } from "@/lib/log";


export async function GET(req: Request) {
  const requestId = getOrCreateRequestId(req);

  const ctx = await getAuthContext(req);
  if (!ctx) {
    log.warn("AUTH_REQUIRED: admin/projects GET", { requestId });
    return failNext("AUTH_REQUIRED", "Unauthorized", 401, undefined, requestId);
  }

  if (ctx.role !== "ADMIN" && ctx.role !== "OWNER") {
    log.warn("FORBIDDEN: admin/projects GET", { requestId, role: ctx.role });
    return failNext("FORBIDDEN", "Forbidden", 403, undefined, requestId);
  }



  try {
    const projects = await prisma.project.findMany({
      where: { companyId: ctx.companyId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true, isActive: true, createdAt: true },
    });

    return okNext({ projects }, undefined, requestId);

  } catch (err: any) {
    log.error("INTERNAL: admin/projects GET", {
      requestId,
      errorName: err?.name,
      errorMessage: err?.message,
    });
    return failNext("INTERNAL", "Failed to load projects", 500, undefined, requestId);
  }

}


export async function POST(req: Request) {
  const requestId = getOrCreateRequestId(req);

  const ctx = await getAuthContext(req);
  if (!ctx) {
    log.warn("AUTH_REQUIRED: admin/projects POST", { requestId });
    return failNext("AUTH_REQUIRED", "Unauthorized", 401, undefined, requestId);
  }

  if (ctx.role !== "ADMIN" && ctx.role !== "OWNER") {
    log.warn("FORBIDDEN: admin/projects POST", { requestId, role: ctx.role });
    return failNext("FORBIDDEN", "Forbidden", 403, undefined, requestId);
  }



  try {
    const body = await req.json();
    const nameRaw = String(body?.name ?? "").trim();
    const colorRaw = body?.color;

    if (!nameRaw || nameRaw.length < 2) {
      log.warn("VALIDATION: admin/projects POST (name)", { requestId });
      return failNext("VALIDATION", "Name is required", 400, undefined, requestId);
    }


    const project = await prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          companyId: ctx.companyId,
          name: nameRaw,
          color: typeof colorRaw === "string" ? colorRaw : null,
          isActive: true,
        },
        select: { id: true, name: true, color: true, isActive: true, createdAt: true },
      });

      await tx.activityEvent.create({
        data: {
          companyId: ctx.companyId,
          actorType: "EMPLOYEE",
          actorId: ctx.employeeId,
          actorName: ctx.name ?? null,
          entityType: "PROJECT",
          entityId: created.id,
          eventType: "PROJECT_CREATED",
          summary: `Created project #${created.id}`,
          meta: { name: created.name, color: created.color },
        },
      });

      return created;
    });

    return okNext({ project }, undefined, requestId);



  } catch (err: any) {
  if (err?.code === "P2002") {
    log.warn("BAD_REQUEST: admin/projects POST (duplicate)", { requestId });
    return failNext("BAD_REQUEST", "Project already exists", 409, undefined, requestId);
  }

  log.error("INTERNAL: admin/projects POST", {
    requestId,
    errorName: err?.name,
    errorMessage: err?.message,
  });
  return failNext("INTERNAL", "Failed to create project", 500, undefined, requestId);
}

}
