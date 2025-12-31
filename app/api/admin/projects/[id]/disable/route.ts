import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth";
import { okNext, failNext } from "@/lib/api/nextResponse";
import { getOrCreateRequestId } from "@/lib/requestId";
import { log } from "@/lib/log";


export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getOrCreateRequestId(req);
  const ctx = await getAuthContext(req);
  if (!ctx) {
    log.warn("AUTH_REQUIRED: admin/projects/[id]/disable POST", { requestId });
    return failNext("AUTH_REQUIRED", "Unauthorized", 401, undefined, requestId);
  }

  if (ctx.role !== "ADMIN" && ctx.role !== "OWNER") {
    log.warn("FORBIDDEN: admin/projects/[id]/disable POST", { requestId, role: ctx.role });
    return failNext("FORBIDDEN", "Forbidden", 403, undefined, requestId);
  }


  const { id: idParam } = await params;
  const projectId = Number(idParam);
  if (!Number.isFinite(projectId) || projectId <= 0) {
    log.warn("VALIDATION: admin/projects/[id]/disable POST (id)", { requestId, idParam });
    return failNext("VALIDATION", `Invalid id (got: ${idParam})`, 400, undefined, requestId);
  }



  try {
    const existing = await prisma.project.findFirst({
      where: {
        id: projectId,
        companyId: ctx.companyId,
      },
      select: {
        id: true,
        name: true,
        isActive: true,
      },
    });

    if (!existing) {
      log.warn("NOT_FOUND: admin/projects/[id]/disable POST", { requestId, projectId });
      return failNext("NOT_FOUND", "Project not found", 404, undefined, requestId);
    }


    if (!existing.isActive) {
      return okNext({ alreadyDisabled: true }, undefined, requestId);
    }



    const updated = await prisma.$transaction(async (tx) => {
      const proj = await tx.project.update({
        where: { id: existing.id },
        data: { isActive: false },
        select: { id: true, name: true, isActive: true },
      });

      await tx.activityEvent.create({
        data: {
          companyId: ctx.companyId,
          actorType: "EMPLOYEE",
          actorId: ctx.employeeId,
          actorName: ctx.name ?? null,
          entityType: "PROJECT",
          entityId: proj.id,
          eventType: "PROJECT_DISABLED",
          summary: `Disabled project #${proj.id}`,
          meta: {
            prevIsActive: true,
            nextIsActive: false,
          },
        },
      });

      return proj;
    });

    return okNext({ project: updated }, undefined, requestId);


   } catch (err: any) {
    log.error("INTERNAL: admin/projects/[id]/disable POST", {
      requestId,
      projectId,
      errorName: err?.name,
      errorMessage: err?.message,
    });
    return failNext("INTERNAL", "Failed to disable project", 500, undefined, requestId);
  }


}
