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
    log.warn("AUTH_REQUIRED: admin/hours/[id]/approve POST", { requestId });
    return failNext("AUTH_REQUIRED", "Unauthorized", 401, undefined, requestId);
  }

  if (ctx.role !== "ADMIN" && ctx.role !== "OWNER") {
    log.warn("FORBIDDEN: admin/hours/[id]/approve POST", { requestId, role: ctx.role });
    return failNext("FORBIDDEN", "Forbidden", 403, undefined, requestId);
  }


  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isFinite(id) || id <= 0) {
    return failNext("VALIDATION", `Invalid id (got: ${idParam})`, 400, undefined, requestId);
  }

  try {
    // Only approve entries in this company that are not soft-deleted
    const existing = await prisma.hourEntry.findFirst({
      where: {
        id,
        companyId: ctx.companyId,
        deletedAt: null,
      },
      select: { id: true, status: true },
    });

    if (!existing) {
      return failNext("NOT_FOUND", "Hour entry not found", 404, undefined, requestId);
    }


    if (existing.status === "APPROVED") {
      return okNext({ alreadyApproved: true }, undefined, requestId);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const res = await tx.hourEntry.updateMany({
        where: {
          id,
          companyId: ctx.companyId,
          deletedAt: null,
        },
        data: {
          status: "APPROVED",
          rejectReason: null,
        },
      });

      if (res.count !== 1) {
        throw Object.assign(new Error("Hour entry not found"), { code: "NOT_FOUND" });
      }

      const row = await tx.hourEntry.findUnique({ where: { id } });
      if (!row) {
        throw Object.assign(new Error("Hour entry not found"), { code: "NOT_FOUND" });
      }

      await tx.activityEvent.create({
        data: {
          companyId: ctx.companyId,
          actorType: ctx.role,
          actorId: ctx.employeeId,
          actorName: ctx.name ?? null,
          entityType: "HOUR_ENTRY",
          entityId: id,
          eventType: "HOUR_APPROVED",
          summary: `Approved hour entry #${id}`,
          meta: {
            prevStatus: existing.status,
            nextStatus: "APPROVED",
          },
        },
      });

      return row;
    });

    return okNext({ entry: updated }, undefined, requestId);



  } catch (err: any) {
    if (err?.code === "NOT_FOUND") {
      return failNext("NOT_FOUND", "Hour entry not found", 404, undefined, requestId);
    }

    log.error("INTERNAL: admin/hours/[id]/approve POST", {
      requestId,
      errorName: err?.name,
      errorMessage: err?.message,
    });
    return failNext("INTERNAL", "Failed to approve hour entry", 500, undefined, requestId);
  }

}

