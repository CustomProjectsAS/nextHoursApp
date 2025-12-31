import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth";
import { okNext, failNext } from "@/lib/api/nextResponse";


export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext(req);
 if (!ctx) {
  return failNext("AUTH_REQUIRED", "Unauthorized", 401);
}

  if (ctx.role !== "ADMIN" && ctx.role !== "OWNER") {
  return failNext("FORBIDDEN", "Forbidden", 403);
}


  const { id: idParam } = await params;
  const projectId = Number(idParam);
  if (!Number.isFinite(projectId) || projectId <= 0) {
  return failNext("VALIDATION", `Invalid id (got: ${idParam})`, 400);
}


  try {
    const body = await req.json();
    const nameRaw = body?.name;
    const colorRaw = body?.color;

    if (nameRaw === undefined && colorRaw === undefined) {
  return failNext("VALIDATION", "Nothing to update", 400);
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
  return failNext("NOT_FOUND", "Project not found", 404);
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
  return okNext({ noChanges: true });
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

    return okNext({ project: updated });

  } catch (err: any) {
  console.error("PATCH /api/admin/projects/[id] error:", err);
  return failNext("INTERNAL", "Failed to update project", 500);
}

}
