import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth";
import { okNext, failNext } from "@/lib/api/nextResponse";
import { getOrCreateRequestId } from "@/lib/requestId";
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
    const requestId = getOrCreateRequestId(req);

    try {
        const ctx = await getAuthContext(req);
        if (!ctx) {
            log.warn("AUTH_REQUIRED: employee/hours/[id] PATCH", { requestId });
            return failNext("AUTH_REQUIRED", "Unauthorized", 401, undefined, requestId);
        }


        const { id: idRaw } = await params;

        const id = Number(idRaw);
        if (!Number.isFinite(id) || id <= 0) {
            log.warn("VALIDATION: employee/hours/[id] PATCH (id)", { requestId, idRaw });
            return failNext("VALIDATION", "Invalid id", 400, undefined, requestId);
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
            log.warn("NOT_FOUND: employee/hours/[id] PATCH (entry)", { requestId, id });
            return failNext("NOT_FOUND", "Not found", 404, undefined, requestId);
        }

        // rule: cannot edit if APPROVED
if (existing.status === "APPROVED") {
    log.warn("FORBIDDEN: employee/hours/[id] PATCH (approved)", { requestId, id });
    return failNext("FORBIDDEN", "Entry is approved and cannot be edited.", 409, undefined, requestId);
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
                    log.warn("VALIDATION: employee/hours/[id] PATCH (projectId)", { requestId });
                    return failNext("VALIDATION", "Invalid projectId", 400, undefined, requestId);
                }
                // validate project belongs to company
                const proj = await prisma.project.findFirst({
                    where: { id: n, companyId: ctx.companyId },
                    select: { id: true },
                });
                if (!proj) {
                    log.warn("NOT_FOUND: employee/hours/[id] PATCH (project)", { requestId, projectId: projectIdRaw });
                    return failNext("NOT_FOUND", "Project not found", 404, undefined, requestId);
                }

                nextProjectId = n;
            }
        }

        // date
        let nextWorkDate: Date = existing.workDate;
        if (dateRaw !== undefined) {
            const d = new Date(String(dateRaw));
            if (Number.isNaN(d.getTime())) {
                log.warn("VALIDATION: employee/hours/[id] PATCH (date)", { requestId });
                return failNext("VALIDATION", "Invalid date", 400, undefined, requestId);
            }

            nextWorkDate = d;
        }

        // times
        const nextFromTime = fromTimeRaw !== undefined ? String(fromTimeRaw) : existing.fromTime;
        const nextToTime = toTimeRaw !== undefined ? String(toTimeRaw) : existing.toTime;

        const fromMinutes = parseTimeToMinutes(nextFromTime);
        const toMinutes = parseTimeToMinutes(nextToTime);

        if (fromMinutes === null || toMinutes === null) {
            log.warn("VALIDATION: employee/hours/[id] PATCH (time)", { requestId });
            return failNext("VALIDATION", "Invalid time format. Use HH:MM.", 400, undefined, requestId);
        }

        // break minutes
        let nextBreakM: number = existing.breakMinutes ?? 0;
        if (breakMinutesRaw !== undefined) {
            const bm =
                typeof breakMinutesRaw === "number"
                    ? breakMinutesRaw
                    : parseInt(String(breakMinutesRaw || "0"), 10);

            if (Number.isNaN(bm) || bm < 0) {
                log.warn("VALIDATION: employee/hours/[id] PATCH (breakMinutes)", { requestId });
                return failNext("VALIDATION", "Break minutes must be a non-negative number.", 400, undefined, requestId);
            }
            nextBreakM = bm;
        }

        const totalMinutes = computeTotalMinutes(fromMinutes, toMinutes);

        if (totalMinutes === 0) {
            log.warn("VALIDATION: employee/hours/[id] PATCH (zero duration)", { requestId });
            return failNext("VALIDATION", "End time must be different from start time.", 400, undefined, requestId);
        }

        const netMinutes = totalMinutes - nextBreakM;
        if (netMinutes <= 0) {
    log.warn("VALIDATION: employee/hours/[id] PATCH (netMinutes)", { requestId });
    return failNext("VALIDATION", "Break minutes must be a non-negative number.", 400, undefined, requestId);
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

        return okNext({ entry: updated }, undefined, requestId);

   } catch (err: any) {
    log.error("INTERNAL: employee/hours/[id] PATCH", {
        requestId,
        errorName: err?.name,
        errorMessage: err?.message,
    });
    return failNext("INTERNAL", "Internal error", 500, undefined, requestId);
}

}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getOrCreateRequestId(req);

  try {
    const ctx = await getAuthContext(req);
    if (!ctx) {
      log.warn("AUTH_REQUIRED: employee/hours/[id] DELETE", { requestId });
      return failNext("AUTH_REQUIRED", "Unauthorized", 401, undefined, requestId);
    }

    const { id: idRaw } = await params;

    const id = Number(idRaw);
    if (!Number.isFinite(id) || id <= 0) {
      log.warn("VALIDATION: employee/hours/[id] DELETE (id)", { requestId, idRaw });
      return failNext("VALIDATION", "Invalid id", 400, undefined, requestId);
    }

    const existing = await prisma.hourEntry.findFirst({
      where: {
        id,
        companyId: ctx.companyId,
        employeeId: ctx.employeeId,
      },
      select: { id: true, status: true },
    });

    if (!existing) {
      log.warn("NOT_FOUND: employee/hours/[id] DELETE (entry)", { requestId, id });
      return failNext("NOT_FOUND", "Not found", 404, undefined, requestId);
    }

    // rule: only PENDING can be deleted by employee
    if (existing.status !== "PENDING") {
      log.warn("FORBIDDEN: employee/hours/[id] DELETE (status)", {
        requestId,
        id,
        status: existing.status,
      });
      return failNext(
        "FORBIDDEN",
        "Only pending entries can be deleted.",
        409,
        undefined,
        requestId
      );
    }

    await prisma.hourEntry.delete({ where: { id: existing.id } });

    log.info("EMP_HOURS_DELETE_OK", {
      requestId,
      route: "DELETE /api/employee/hours/[id]",
      companyId: ctx.companyId,
      employeeId: ctx.employeeId,
      entryId: existing.id,
    });

    return okNext({ deleted: true }, undefined, requestId);
  } catch (err: any) {
    log.error("INTERNAL: employee/hours/[id] DELETE", {
      requestId,
      errorName: err?.name,
      errorMessage: err?.message,
    });
    return failNext("INTERNAL", "Internal error", 500, undefined, requestId);
  }
}
