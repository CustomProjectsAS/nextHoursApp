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


    const body = await req.json().catch(() => ({}));
    const rejectReasonRaw = String(body?.rejectReason ?? "").trim();
    if (!rejectReasonRaw) {
        return failNext("VALIDATION", "rejectReason is required", 400);
    }


    try {
        const existing = await prisma.hourEntry.findFirst({
            where: {
                id,
                companyId: ctx.companyId,
                deletedAt: null,
            },
            select: { id: true, status: true },
        });

        if (!existing) {
            return failNext("NOT_FOUND", "Hour entry not found", 404);
        }


        if (existing.status === "REJECTED") {
            return okNext({ alreadyRejected: true });
        }


        const updated = await prisma.hourEntry.update({
            where: { id },
            data: {
                status: "REJECTED",
                rejectReason: rejectReasonRaw,
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
                eventType: "HOUR_REJECTED",
                summary: `Rejected hour entry #${updated.id}`,
                meta: {
                    prevStatus: existing.status,
                    nextStatus: "REJECTED",
                    rejectReason: rejectReasonRaw,
                },
            },
        });


        return okNext({ entry: updated });

    } catch (err: any) {
    console.error("POST /api/admin/hours/[id]/reject error:", err);
    return failNext("INTERNAL", "Failed to reject hour entry", 500);
}

}
