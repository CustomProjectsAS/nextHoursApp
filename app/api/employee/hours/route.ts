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
  // also treats same time as 24h (will be rejected by max duration guard)
  if (toMinutes < fromMinutes) return (24 * 60 - fromMinutes) + toMinutes;
  return toMinutes - fromMinutes;
}

function parseMonthToUtcRange(month: string): { start: Date; end: Date } | null {
  // expects "YYYY-MM"
  if (!/^\d{4}-\d{2}$/.test(month)) return null;

  const [yStr, mStr] = month.split("-");
  const y = Number(yStr);
  const m = Number(mStr);

  if (Number.isNaN(y) || Number.isNaN(m) || m < 1 || m > 12) return null;

  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0)); // next month
  return { start, end };
}

export const GET = withRequestId(async (req, requestId) => {
  try {
    const ctx = await getAuthContext(req);
    if (!ctx) {
      log.warn("EMP_HOURS_AUTH_REQUIRED", {
        requestId,
        route: "GET /api/employee/hours",
      });
      return failNext("AUTH_REQUIRED", "Unauthorized", 401, undefined, requestId);
    }

    const { searchParams } = new URL(req.url);
    const month = String(searchParams.get("month") ?? "").trim();

    const range = parseMonthToUtcRange(month);
    if (!range) {
      return failNext(
        "VALIDATION",
        "Invalid or missing month. Use ?month=YYYY-MM",
        400,
        undefined,
        requestId,
      );
    }

    const entries = await prisma.hourEntry.findMany({
      where: {
        companyId: ctx.companyId,
        employeeId: ctx.employeeId,
        workDate: {
          gte: range.start,
          lt: range.end,
        },
      },
      orderBy: [{ workDate: "desc" }, { fromTime: "asc" }],
      select: {
        id: true,
        companyId: true,
        employeeId: true,
        projectId: true,
        workDate: true,
        fromTime: true,
        toTime: true,
        breakMinutes: true,
        hoursNet: true,
        hoursBrut: true,
        description: true,
        status: true,
        rejectReason: true,
        createdAt: true,
      },
    });

    log.info("EMP_HOURS_GET_OK", {
      requestId,
      route: "GET /api/employee/hours",
      companyId: ctx.companyId,
      employeeId: ctx.employeeId,
      month,
      count: entries.length,
    });

    return okNext({ month, entries }, undefined, requestId);
  } catch (err: unknown) {
    log.error("EMP_HOURS_GET_FAILED", {
      requestId,
      route: "GET /api/employee/hours",
      err,
    });
    return failNext("INTERNAL", "Internal error", 500, undefined, requestId);
  }
});


export const POST = withRequestId(async (req, requestId) => {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return failNext("BAD_REQUEST", "Invalid JSON body", 400, undefined, requestId);
    }

    const ctx = await getAuthContext(req);
    if (!ctx) {
      log.warn("EMP_HOURS_AUTH_REQUIRED", {
        requestId,
        route: "POST /api/employee/hours",
      });
      return failNext("AUTH_REQUIRED", "Unauthorized", 401, undefined, requestId);
    }

    const b = (body ?? {}) as Record<string, unknown>;

    const projectIdRaw = b.projectId;
    const date = b.date;
    const fromTime = b.fromTime;
    const toTime = b.toTime;
    const breakMinutes = b.breakMinutes ?? 0;
    const description = b.description;

    // basic presence check
    if (!date || !fromTime || !toTime) {
      return failNext("VALIDATION", "Missing required fields", 400, undefined, requestId);
    }

    const fromMinutes = parseTimeToMinutes(String(fromTime));
    const toMinutes = parseTimeToMinutes(String(toTime));

    if (fromMinutes === null || toMinutes === null) {
      return failNext("VALIDATION", "Invalid time format. Use HH:MM.", 400, undefined, requestId);
    }

    const breakM =
      typeof breakMinutes === "number"
        ? breakMinutes
        : parseInt(String(breakMinutes || "0"), 10);

    if (Number.isNaN(breakM) || breakM < 0) {
      return failNext(
        "VALIDATION",
        "Break minutes must be a non-negative number.",
        400,
        undefined,
        requestId,
      );
    }

    const totalMinutes = computeTotalMinutes(fromMinutes, toMinutes);

    const MAX_SHIFT_MINUTES = 16 * 60; // 16 hours cap (keep consistent with admin)
    if (totalMinutes > MAX_SHIFT_MINUTES) {
      return failNext("VALIDATION", "Shift is too long", 400, undefined, requestId);
    }

    if (totalMinutes === 0) {
      return failNext(
        "VALIDATION",
        "End time must be different from start time.",
        400,
        undefined,
        requestId,
      );
    }

    const netMinutes = totalMinutes - breakM;

    if (netMinutes <= 0) {
      return failNext(
        "VALIDATION",
        "Break is too long. Net time must be greater than zero minutes.",
        400,
        undefined,
        requestId,
      );
    }

    const hoursNet = netMinutes / 60;

    const workDate = new Date(String(date));
    if (Number.isNaN(workDate.getTime())) {
      return failNext("VALIDATION", "Invalid date. Use YYYY-MM-DD.", 400, undefined, requestId);
    }

    // Parse projectId to number|null (prevents `{}` leaking into Prisma)
    const projectId =
      projectIdRaw == null || projectIdRaw === ""
        ? null
        : Number(projectIdRaw);

    if (projectId !== null && Number.isNaN(projectId)) {
      return failNext("VALIDATION", "Invalid projectId", 400, undefined, requestId);
    }

    if (projectId !== null) {
      const proj = await prisma.project.findFirst({
        where: {
          id: projectId,
          companyId: ctx.companyId,
        },
        select: { id: true },
      });

      if (!proj) {
        return failNext("NOT_FOUND", "Project not found", 404, undefined, requestId);
      }
    }

    const entry = await prisma.hourEntry.create({
      data: {
        companyId: ctx.companyId,
        employeeId: ctx.employeeId,
        projectId,
        workDate,
        fromTime: String(fromTime),
        toTime: String(toTime),
        breakMinutes: breakM,
        hoursNet,
        hoursBrut: hoursNet, // same for now
        description: typeof description === "string" ? description : "",
        status: "PENDING",
      },
    });

    await prisma.activityEvent.create({
      data: {
        companyId: ctx.companyId,
        actorType: ctx.role,
        actorId: ctx.employeeId,
        actorName: ctx.name ?? null,
        entityType: "HOUR_ENTRY",
        entityId: entry.id,
        eventType: "HOUR_CREATED",
        summary: `Created hour entry #${entry.id}`,
        meta: {
          requestId,
          workDate: entry.workDate,
          fromTime: entry.fromTime,
          toTime: entry.toTime,
          breakMinutes: entry.breakMinutes,
          hoursNet: entry.hoursNet,
          hoursBrut: entry.hoursBrut,
          projectId: entry.projectId,
          description: entry.description,
          status: entry.status,
        },
      },
    });

    log.info("EMP_HOURS_POST_OK", {
      requestId,
      route: "POST /api/employee/hours",
      companyId: ctx.companyId,
      employeeId: ctx.employeeId,
      entryId: entry.id,
    });

    return okNext({ entry }, undefined, requestId);
  } catch (err: unknown) {
    log.error("EMP_HOURS_POST_FAILED", {
      requestId,
      route: "POST /api/employee/hours",
      err,
    });
    return failNext("INTERNAL", "Internal error", 500, undefined, requestId);
  }
});

