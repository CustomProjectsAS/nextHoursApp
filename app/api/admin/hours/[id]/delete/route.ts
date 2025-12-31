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
    log.warn("AUTH_REQUIRED: admin/hours/[id]/delete POST", { requestId });
    return failNext("AUTH_REQUIRED", "Unauthorized", 401, undefined, requestId);
  }

  if (ctx.role !== "ADMIN" && ctx.role !== "OWNER") {
    log.warn("FORBIDDEN: admin/hours/[id]/delete POST", { requestId, role: ctx.role });
    return failNext("FORBIDDEN", "Forbidden", 403, undefined, requestId);
  }


  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isFinite(id) || id <= 0) {
    return failNext("VALIDATION", `Invalid id (got: ${idParam})`, 400, undefined, requestId);
  }



  try {
    // Only delete entries in this company that are not already soft-deleted
    const existing = await prisma.hourEntry.findFirst({
      where: {
        id,
        companyId: ctx.companyId,
        deletedAt: null,
      },
      select: { id: true, status: true },
    });

    if (!existing) {
      // Either not found OR already deleted (we don't leak which)
      return failNext("NOT_FOUND", "Hour entry not found", 404, undefined, requestId);
    }


    const updated = await prisma.hourEntry.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });

    await prisma.activityEvent.create({
      data: {
        companyId: ctx.companyId,
        actorType: "EMPLOYEE",
        actorId: ctx.employeeId,
        actorName: ctx.name ?? null,
        entityType: "HOUR_ENTRY",
        entityId: updated.id,
        eventType: "HOUR_DELETED",
        summary: `Deleted hour entry #${updated.id}`,
        meta: {
          prevStatus: existing.status,
          deletedAt: updated.deletedAt,
        },
      },
    });

    return okNext({ entry: updated }, undefined, requestId);

  } catch (err: any) {
    log.error("INTERNAL: admin/hours/[id]/delete POST", {
      requestId,
      errorName: err?.name,
      errorMessage: err?.message,
    });
    return failNext("INTERNAL", "Failed to delete hour entry", 500, undefined, requestId);
  }


}
