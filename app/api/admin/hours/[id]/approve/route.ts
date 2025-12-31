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
  const id = Number(idParam);
  if (!Number.isFinite(id) || id <= 0) {
    return failNext("VALIDATION", `Invalid id (got: ${idParam})`, 400);
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
      if (!existing) {
        return failNext("NOT_FOUND", "Hour entry not found", 404);
      }

    }

    if (existing.status === "APPROVED") {
      return okNext({ alreadyApproved: true });
    }


    const updated = await prisma.hourEntry.update({
      where: { id },
      data: {
        status: "APPROVED",
        rejectReason: null,
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
        eventType: "HOUR_APPROVED",
        summary: `Approved hour entry #${updated.id}`,
        meta: {
          prevStatus: existing.status,
          nextStatus: "APPROVED",
        },
      },
    });

    return okNext({ entry: updated });



    } catch (err: any) {
    console.error("POST /api/admin/hours/[id]/approve error:", err);
    return failNext("INTERNAL", "Failed to approve hour entry", 500);
  }
}

