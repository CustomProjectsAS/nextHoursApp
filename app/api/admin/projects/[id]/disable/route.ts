import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth";
import { okNext, failNext } from "@/lib/api/nextResponse";


export async function POST(
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
      return failNext("NOT_FOUND", "Project not found", 404);
    }


    if (!existing.isActive) {
      return okNext({ alreadyDisabled: true });
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

    return okNext({ project: updated });

  } catch (err: any) {
  console.error("POST /api/admin/projects/[id]/disable error:", err);
  return failNext("INTERNAL", "Failed to disable project", 500);
}

}
