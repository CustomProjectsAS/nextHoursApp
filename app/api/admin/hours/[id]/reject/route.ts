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

        const updated = await prisma.$transaction(async (tx) => {
            const result = await tx.hourEntry.updateMany({
                where: {
                    id,
                    companyId: ctx.companyId,
                    deletedAt: null,
                },
                data: {
                    status: "REJECTED",
                    rejectReason: rejectReasonRaw,
                },
            });

            if (result.count !== 1) {
                // row disappeared or tenant mismatch after the earlier read (race)
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
                    eventType: "HOUR_REJECTED",
                    summary: `Rejected hour entry #${id}`,
                    meta: {
                        prevStatus: existing.status,
                        nextStatus: "REJECTED",
                        rejectReason: rejectReasonRaw,
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

        log.error("INTERNAL: admin/hours/[id]/reject POST", {
            requestId,
            errorName: err?.name,
            errorMessage: err?.message,
        });
        return failNext("INTERNAL", "Failed to reject hour entry", 500, undefined, requestId);
    }

}
