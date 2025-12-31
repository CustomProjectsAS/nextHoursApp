import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth";
import { okNext, failNext } from "@/lib/api/nextResponse";
import { withRequestId } from "@/lib/api/withRequestId";
import { log } from "@/lib/log";


function parseTimeToMinutes(time: string): number | null {
    if (!time || typeof time !== "string") return null;
    const [h, m] = time.split(":").map(Number);
    if (
        Number.isNaN(h) ||
        Number.isNaN(m) ||
        h < 0 ||
        h > 23 ||
        m < 0 ||
        m > 59
    ) {
        return null;
    }
    return h * 60 + m;
}

function computeTotalMinutes(fromMinutes: number, toMinutes: number): number {
    // overnight shift: e.g. 22:00 -> 06:00
    if (toMinutes < fromMinutes) return 24 * 60 - fromMinutes + toMinutes;
    return toMinutes - fromMinutes;
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const ctx = await getAuthContext(req);
        if (!ctx) {
            return failNext("AUTH_REQUIRED", "Unauthorized", 401);
        }

        const { id: idRaw } = await params;

        const id = Number(idRaw);
        if (!Number.isFinite(id) || id <= 0) {
            return failNext("VALIDATION", "Invalid id", 400);
        }




        const body = await req.json();

        // We allow partial updates, but we must load the current entry first.
        const existing = await prisma.hourEntry.findFirst({
            where: {
                id,
                companyId: ctx.companyId,
                employeeId: ctx.employeeId,
            },
        });

        if (!existing) {
            return failNext("NOT_FOUND", "Not found", 404);
        }



        // rule: cannot edit if APPROVED
        if (existing.status === "APPROVED") {
            return failNext("FORBIDDEN", "Entry is approved and cannot be edited.", 409);
        }


        // editable fields (partial)
        const projectIdRaw = body?.projectId;
        const dateRaw = body?.date; // keep same naming as POST
        const fromTimeRaw = body?.fromTime;
        const toTimeRaw = body?.toTime;
        const breakMinutesRaw = body?.breakMinutes;
        const descriptionRaw = body?.description;

        // projectId (nullable)
        let nextProjectId: number | null = existing.projectId ?? null;
        if (projectIdRaw !== undefined) {
            if (projectIdRaw === null || projectIdRaw === "") {
                nextProjectId = null;
            } else {
                const n = Number(projectIdRaw);
                if (!Number.isFinite(n) || n <= 0) {
                    return failNext("VALIDATION", "Invalid projectId", 400);

                }
                // validate project belongs to company
                const proj = await prisma.project.findFirst({
                    where: { id: n, companyId: ctx.companyId },
                    select: { id: true },
                });
                if (!proj) {
                    return failNext("NOT_FOUND", "Project not found", 404);
                }

                nextProjectId = n;
            }
        }

        // date
        let nextWorkDate: Date = existing.workDate;
        if (dateRaw !== undefined) {
            const d = new Date(String(dateRaw));
            if (Number.isNaN(d.getTime())) {
                return failNext("VALIDATION", "Invalid date", 400);
            }

            nextWorkDate = d;
        }

        // times
        const nextFromTime = fromTimeRaw !== undefined ? String(fromTimeRaw) : existing.fromTime;
        const nextToTime = toTimeRaw !== undefined ? String(toTimeRaw) : existing.toTime;

        const fromMinutes = parseTimeToMinutes(nextFromTime);
        const toMinutes = parseTimeToMinutes(nextToTime);

        if (fromMinutes === null || toMinutes === null) {
            return failNext("VALIDATION", "Invalid time format. Use HH:MM.", 400);

        }

        // break minutes
        let nextBreakM: number = existing.breakMinutes ?? 0;
        if (breakMinutesRaw !== undefined) {
            const bm =
                typeof breakMinutesRaw === "number"
                    ? breakMinutesRaw
                    : parseInt(String(breakMinutesRaw || "0"), 10);

            if (Number.isNaN(bm) || bm < 0) {
                return failNext("VALIDATION", "Break minutes must be a non-negative number.", 400);

            }
            nextBreakM = bm;
        }

        const totalMinutes = computeTotalMinutes(fromMinutes, toMinutes);

        if (totalMinutes === 0) {
            return failNext("VALIDATION", "End time must be different from start time.", 400);

        }

        const netMinutes = totalMinutes - nextBreakM;
        if (netMinutes <= 0) {
            return failNext("VALIDATION", "Break minutes must be a non-negative number.", 400);

        }

        const nextHoursNet = netMinutes / 60;

        // description
        const nextDescription =
            descriptionRaw !== undefined ? String(descriptionRaw ?? "") : (existing.description ?? "");

        // If it was rejected, editing reopens it
        const reopen = existing.status === "REJECTED";

        const updated = await prisma.hourEntry.update({
            where: { id: existing.id },
            data: {
                projectId: nextProjectId,
                workDate: nextWorkDate,
                fromTime: nextFromTime,
                toTime: nextToTime,
                breakMinutes: nextBreakM,
                hoursNet: nextHoursNet,
                hoursBrut: nextHoursNet, // keep same logic as POST for now
                description: nextDescription,
                ...(reopen ? { status: "PENDING", rejectReason: null } : {}),
            },
        });

        return okNext({ entry: updated });
    } catch (err: any) {
        console.error("PATCH /api/employee/hours/:id error:", err);
        return failNext("INTERNAL", "Internal error", 500);
    }
}
