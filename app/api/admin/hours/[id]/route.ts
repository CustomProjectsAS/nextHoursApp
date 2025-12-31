import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth";
import { okNext, failNext } from "@/lib/api/nextResponse";
import { getOrCreateRequestId } from "@/lib/requestId";
import { log } from "@/lib/log";





// small helper: "HH:MM" -> minutes from midnight
// strict helper: "HH:MM" -> minutes from midnight (00:00..23:59)
function parseTimeToMinutes(time: string | null | undefined): number | null {
  if (!time) return null;
  const t = String(time).trim();

  // must be exactly HH:MM
  const m = /^(\d{2}):(\d{2})$/.exec(t);
  if (!m) return null;

  const h = Number(m[1]);
  const min = Number(m[2]);

  if (!Number.isInteger(h) || !Number.isInteger(min)) return null;
  if (h < 0 || h > 23) return null;
  if (min < 0 || min > 59) return null;

  return h * 60 + min;
}


function calculateHours(
  fromTime: string,
  toTime: string,
  breakMinutes: number | null | undefined
) {

  const start = parseTimeToMinutes(fromTime);
  const endRaw = parseTimeToMinutes(toTime);
  if (start == null || endRaw == null) {
    throw new Error("Invalid from/to times");
  }

  // Overnight support: toTime earlier than fromTime => next day
  const end = endRaw < start ? endRaw + 24 * 60 : endRaw;

  if (end <= start) {
    throw new Error("Invalid from/to times");
  }


  const breakMin = breakMinutes ?? 0;
  if (!Number.isFinite(breakMin) || breakMin < 0) {
    throw new Error("Invalid breakMinutes");
  }

  const durationMinutes = end - start;
  if (breakMin >= durationMinutes) {
    throw new Error("Break is too long for the given time range");
  }

  const rawMinutes = durationMinutes - breakMin;
  const MAX_SHIFT_MINUTES = 16 * 60; // 16 hours cap (adjust later if your business needs it)
  if (durationMinutes > MAX_SHIFT_MINUTES) {
    throw new Error("Shift is too long");
  }

  if (rawMinutes <= 0) {
    throw new Error("Break is too long for the given time range");
  }

  const netHours = rawMinutes / 60;
  const brutHours = netHours; // adjust later if you ever add OT rules

  // store with two decimals
  return {
    hoursNet: parseFloat(netHours.toFixed(2)),
    hoursBrut: parseFloat(brutHours.toFixed(2)),
  };
}

// PATCH /api/admin/hours/[id]  -> update an entry
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getOrCreateRequestId(req);

  const ctx = await getAuthContext(req);

  if (!ctx) {
  log.warn("AUTH_REQUIRED: admin/hours/[id] PATCH", { requestId });
  return failNext("AUTH_REQUIRED", "Unauthorized", 401, undefined, requestId);
}

if (ctx.role !== "ADMIN" && ctx.role !== "OWNER") {
  log.warn("FORBIDDEN: admin/hours/[id] PATCH", { requestId, role: ctx.role });
  return failNext("FORBIDDEN", "Forbidden", 403, undefined, requestId);
}



  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isFinite(id) || id <= 0) {
    return failNext("VALIDATION", `Invalid id (got: ${idParam})`, 400, undefined, requestId);
  }


  try {

    const existing = await prisma.hourEntry.findFirst({
      where: {
        id,
        companyId: ctx.companyId,
        deletedAt: null,
      },
    });

        if (!existing) {
      return failNext("NOT_FOUND", "Hour entry not found", 404, undefined, requestId);
    }


       if (existing.status === "APPROVED") {
      return failNext("FORBIDDEN", "Entry is approved and cannot be edited.", 409, undefined, requestId);
    }


    const body = await req.json();

    const {
      fromTime,
      toTime,
      breakMinutes,
      projectId,
      description,
      workDate,
    } = body as {
      fromTime?: string;
      toTime?: string;
      breakMinutes?: number;
      projectId?: number | null;
      description?: string;
      workDate?: string;
    };



    const data: any = {};

    if (fromTime !== undefined) data.fromTime = fromTime;
    if (toTime !== undefined) data.toTime = toTime;
    if (breakMinutes !== undefined) data.breakMinutes = breakMinutes;
    if (projectId !== undefined) {
      if (projectId == null) {
        return failNext("VALIDATION", "projectId is required", 400, undefined, requestId);
      }


      const proj = await prisma.project.findFirst({
        where: { id: projectId, companyId: ctx.companyId },
        select: { id: true },
      });

      if (!proj) {
        return failNext("VALIDATION", "Invalid projectId for this company", 400, undefined, requestId);
      }


      data.projectId = projectId;
    }

    if (description !== undefined) data.description = description;


    if (workDate !== undefined) {
      // treat as local date, no timezone shift
      data.workDate = new Date(workDate + "T00:00:00");
    }

    // Admin edit rule: always reopen to PENDING + clear rejectReason
    data.status = "PENDING";
    data.rejectReason = null;

    // If any of the time-related fields changed, recalc hours
    if (fromTime !== undefined || toTime !== undefined || breakMinutes !== undefined) {
      const newFrom = fromTime ?? existing.fromTime;
      const newTo = toTime ?? existing.toTime;
      const newBreak =
        breakMinutes !== undefined ? breakMinutes : existing.breakMinutes;


      const { hoursNet, hoursBrut } = calculateHours(newFrom, newTo, newBreak);
      data.hoursNet = hoursNet;
      data.hoursBrut = hoursBrut;
    }

    const updated = await prisma.hourEntry.update({
      where: { id },
      data,
    });

    await prisma.activityEvent.create({
      data: {
        companyId: ctx.companyId,
        actorType: "EMPLOYEE",
        actorId: ctx.employeeId,
        actorName: ctx.name ?? null,
        entityType: "HOUR_ENTRY",
        entityId: updated.id,
        eventType: "HOUR_EDITED",
        summary: `Edited hour entry #${updated.id}`,
        meta: {
          prev: {
            workDate: existing.workDate,
            fromTime: existing.fromTime,
            toTime: existing.toTime,
            breakMinutes: existing.breakMinutes,
            projectId: existing.projectId,
            description: existing.description,
            status: existing.status,
            rejectReason: existing.rejectReason,
            hoursNet: existing.hoursNet,
            hoursBrut: existing.hoursBrut,
          },
          next: {
            workDate: updated.workDate,
            fromTime: updated.fromTime,
            toTime: updated.toTime,
            breakMinutes: updated.breakMinutes,
            projectId: updated.projectId,
            description: updated.description,
            status: updated.status,
            rejectReason: updated.rejectReason,
            hoursNet: updated.hoursNet,
            hoursBrut: updated.hoursBrut,
          },
          changed: Object.keys(data),
        },
      },
    });

    return okNext(updated, undefined, requestId);



  } catch (err: any) {
  log.error("INTERNAL: admin/hours/[id] PATCH", {
    requestId,
    errorName: err?.name,
    errorMessage: err?.message,
  });
  return failNext("INTERNAL", err?.message ?? "Unknown error", 500, undefined, requestId);
}

}



export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getOrCreateRequestId(req);

  const ctx = await getAuthContext(req);

    if (!ctx) {
    log.warn("AUTH_REQUIRED: admin/hours/[id] DELETE", { requestId });
    return failNext("AUTH_REQUIRED", "Unauthorized", 401, undefined, requestId);
  }


    if (ctx.role !== "ADMIN" && ctx.role !== "OWNER") {
    log.warn("FORBIDDEN: admin/hours/[id] DELETE", { requestId, role: ctx.role });
    return failNext("FORBIDDEN", "Forbidden", 403, undefined, requestId);
  }


  const { id: idParam } = await params;
  const id = Number(idParam);

  if (!Number.isFinite(id) || id <= 0) {
    return failNext("VALIDATION", `Invalid id (got: ${idParam})`, 400, undefined, requestId);
  }

  try {
    const existing = await prisma.hourEntry.findFirst({
      where: {
        id,
        companyId: ctx.companyId,
      },
      select: { id: true, deletedAt: true },
    });

        if (!existing) {
      return failNext("NOT_FOUND", "Hour entry not found", 404, undefined, requestId);
    }

    if (existing.deletedAt) {
      return okNext({ alreadyDeleted: true }, undefined, requestId);
    }

    await prisma.hourEntry.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

        return okNext({ deleted: true }, undefined, requestId);
    } catch (err: any) {
    log.error("INTERNAL: admin/hours/[id] DELETE", {
      requestId,
      errorName: err?.name,
      errorMessage: err?.message,
    });
    return failNext("INTERNAL", err?.message ?? "Unknown error", 500, undefined, requestId);
  }

}

