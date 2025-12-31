import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth";
import { okNext, failNext } from "@/lib/api/nextResponse";
import { getOrCreateRequestId } from "@/lib/requestId";
import { log } from "@/lib/log";



export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getOrCreateRequestId(req);
  const ctx = await getAuthContext(req);
  if (!ctx) {
    log.warn("AUTH_REQUIRED: admin/projects/[id] PATCH", { requestId });
    return failNext("AUTH_REQUIRED", "Unauthorized", 401, undefined, requestId);
  }


  if (ctx.role !== "ADMIN" && ctx.role !== "OWNER") {
    log.warn("FORBIDDEN: admin/projects/[id] PATCH", { requestId, role: ctx.role });
    return failNext("FORBIDDEN", "Forbidden", 403, undefined, requestId);
  }



  const { id: idParam } = await params;
  const projectId = Number(idParam);
  if (!Number.isFinite(projectId) || projectId <= 0) {
    log.warn("VALIDATION: admin/projects/[id] PATCH (id)", { requestId, idParam });
    return failNext("VALIDATION", `Invalid id (got: ${idParam})`, 400, undefined, requestId);
  }



  try {
    const body = await req.json();
    const nameRaw = body?.name;
    const colorRaw = body?.color;

    if (nameRaw === undefined && colorRaw === undefined) {
      log.warn("VALIDATION: admin/projects/[id] PATCH (no fields)", { requestId, projectId });
      return failNext("VALIDATION", "Nothing to update", 400, undefined, requestId);
    }


    const existing = await prisma.project.findFirst({
      where: {
        id: projectId,
        companyId: ctx.companyId,
      },
      select: {
        id: true,
        name: true,
        color: true,
        isActive: true,
      },
    });

    if (!existing) {
      log.warn("NOT_FOUND: admin/projects/[id] PATCH", { requestId, projectId });
      return failNext("NOT_FOUND", "Project not found", 404, undefined, requestId);
    }



    const nextData: { name?: string; color?: string | null } = {};
    const changed: Record<string, { from: any; to: any }> = {};

    if (typeof nameRaw === "string" && nameRaw.trim() && nameRaw !== existing.name) {
      nextData.name = nameRaw.trim();
      changed.name = { from: existing.name, to: nextData.name };
    }

    if (colorRaw !== undefined && colorRaw !== existing.color) {
      nextData.color = typeof colorRaw === "string" ? colorRaw : null;
      changed.color = { from: existing.color, to: nextData.color };
    }

        if (Object.keys(changed).length === 0) {
      return okNext({ noChanges: true }, undefined, requestId);
    }



    const updated = await prisma.$transaction(async (tx) => {
      const proj = await tx.project.update({
        where: { id: existing.id },
        data: nextData,
        select: { id: true, name: true, color: true, isActive: true },
      });

      await tx.activityEvent.create({
        data: {
          companyId: ctx.companyId,
          actorType: "EMPLOYEE",
          actorId: ctx.employeeId,
          actorName: ctx.name ?? null,
          entityType: "PROJECT",
          entityId: proj.id,
          eventType: "PROJECT_UPDATED",
          summary: `Updated project #${proj.id}`,
          meta: {
            changed,
          },
        },
      });

      return proj;
    });

        return okNext({ project: updated }, undefined, requestId);


    } catch (err: any) {
    log.error("INTERNAL: admin/projects/[id] PATCH", {
      requestId,
      projectId,
      errorName: err?.name,
      errorMessage: err?.message,
    });
    return failNext("INTERNAL", "Failed to update project", 500, undefined, requestId);
  }


}
