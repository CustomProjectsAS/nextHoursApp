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
        log.warn("AUTH_REQUIRED: admin/hours/[id]/reject POST", { requestId });
        return failNext("AUTH_REQUIRED", "Unauthorized", 401, undefined, requestId);
    }

    if (ctx.role !== "ADMIN" && ctx.role !== "OWNER") {
        log.warn("FORBIDDEN: admin/hours/[id]/reject POST", { requestId, role: ctx.role });
        return failNext("FORBIDDEN", "Forbidden", 403, undefined, requestId);
    }

    const { id: idParam } = await params;
    const id = Number(idParam);
    if (!Number.isFinite(id) || id <= 0) {
        return failNext("VALIDATION", `Invalid id (got: ${idParam})`, 400, undefined, requestId);
    }

    const body = await req.json().catch(() => ({}));
    const rejectReasonRaw = String(body?.rejectReason ?? "").trim();
    if (!rejectReasonRaw) {
        return failNext("VALIDATION", "rejectReason is required", 400, undefined, requestId);
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
            return failNext("NOT_FOUND", "Hour entry not found", 404, undefined, requestId);
        }

        if (existing.status === "REJECTED") {
            return okNext({ alreadyRejected: true }, undefined, requestId);
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
                actorType: ctx.role,
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


        return okNext({ entry: updated }, undefined, requestId);


    } catch (err: any) {
        log.error("INTERNAL: admin/hours/[id]/reject POST", {
            requestId,
            errorName: err?.name,
            errorMessage: err?.message,
        });
        return failNext("INTERNAL", "Failed to reject hour entry", 500, undefined, requestId);
    }

}
