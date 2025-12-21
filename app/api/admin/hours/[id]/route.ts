import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createActivityEvent } from "@/features/activity/createActivityEvent";


// small helper: "HH:MM" -> minutes from midnight
function parseTimeToMinutes(time: string | null | undefined): number | null {
  if (!time) return null;
  const [hStr, mStr] = time.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function calculateHours(
  fromTime: string,
  toTime: string,
  breakMinutes: number | null | undefined
) {
  const start = parseTimeToMinutes(fromTime);
  const end = parseTimeToMinutes(toTime);
  if (start == null || end == null || end <= start) {
    throw new Error("Invalid from/to times");
  }

  const breakMin = breakMinutes ?? 0;
  const rawMinutes = end - start - breakMin;
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
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idParam } = await params;
  const id = Number(idParam);

  if (Number.isNaN(id)) {
    return NextResponse.json(
      { error: `Invalid id (got: ${idParam})` },
      { status: 400 }
    );
  }

  try {

    const existing = await prisma.hourEntry.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            companyId: true,
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Hour entry not found" },
        { status: 404 }
      );
    }


    const body = await req.json();

    const {
      fromTime,
      toTime,
      breakMinutes,
      projectId,
      description,
      status,
      workDate,
      rejectReason,
    } = body as {
      fromTime?: string;
      toTime?: string;
      breakMinutes?: number;
      projectId?: number | null;
      description?: string;
      status?: "PENDING" | "APPROVED" | "REJECTED" | "pending" | "approved" | "rejected";
      workDate?: string;
      rejectReason?: string;
    };


    const data: any = {};

    if (fromTime !== undefined) data.fromTime = fromTime;
    if (toTime !== undefined) data.toTime = toTime;
    if (breakMinutes !== undefined) data.breakMinutes = breakMinutes;
    if (projectId !== undefined) data.projectId = projectId;
    if (description !== undefined) data.description = description;
    if (rejectReason !== undefined) data.rejectReason = rejectReason;


    if (status !== undefined) {
      const normalized =
        status === "approved"
          ? "APPROVED"
          : status === "rejected"
            ? "REJECTED"
            : status === "pending"
              ? "PENDING"
              : status;

      data.status = normalized;
      if (normalized === "REJECTED") {
        const reason = String(rejectReason ?? "").trim();
        if (!reason) {
          return NextResponse.json(
            { error: "Reject reason is required" },
            { status: 400 }
          );
        }
        data.rejectReason = reason;
      }

      // Optional cleanup: if not rejected, clear rejectReason when status explicitly changes
      if (normalized !== "REJECTED") {
        data.rejectReason = null;
      }

    }

    if (workDate !== undefined) {
      // treat as local date, no timezone shift
      data.workDate = new Date(workDate + "T00:00:00");
    }
    // Auto-flip: if admin edited anything (without explicitly setting status)
    // and entry was approved → go back to PENDING
    if (status === undefined && Object.keys(data).length > 0) {
      if (existing.status === "APPROVED") {
        data.status = "PENDING";
      }
    }


    const prevStatus = existing.status;
    const nextStatus =
      (data.status ?? existing.status) as "PENDING" | "APPROVED" | "REJECTED";

    const statusChanged = prevStatus !== nextStatus;

    const shouldLog =
      statusChanged &&
      (nextStatus === "APPROVED" ||
        nextStatus === "REJECTED" ||
        (nextStatus === "PENDING" && prevStatus !== "PENDING")); // REOPENED

    if (shouldLog) {
      const isReopened =
        nextStatus === "PENDING" && prevStatus !== "PENDING";


      if (!existing.employee.companyId) {
        throw new Error("Employee has no companyId");
      }


      await createActivityEvent({
        companyId: existing.employee.companyId,

        actorType: "SYSTEM",
        actorId: null,
        actorName: "System",

        entityType: "HOUR_ENTRY",
        entityId: existing.id,

        eventType: isReopened
          ? "HOUR_REOPENED"
          : nextStatus === "APPROVED"
            ? "HOUR_APPROVED"
            : "HOUR_REJECTED",


        summary: isReopened
          ? `Hour entry ${existing.id} reopened (${prevStatus} → PENDING)`
          : `Hour entry ${existing.id} ${prevStatus} → ${nextStatus}`,

        meta: {
          prevStatus,
          newStatus: nextStatus,
          rejectReason:
            nextStatus === "REJECTED"
              ? (data.rejectReason ?? existing.rejectReason ?? null)
              : null,
        },
      });

    }




    // If any of the time-related fields changed, recalc hours
    if (fromTime || toTime || breakMinutes !== undefined) {
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

    return NextResponse.json(updated);
  } catch (err: any) {
    console.error("PATCH /api/admin/hours/[id] error:", err);
    return NextResponse.json(
      { error: err.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/hours/[id]  -> delete an entry
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idParam } = await params;
  const id = Number(idParam);

  if (Number.isNaN(id)) {
    return NextResponse.json(
      { error: `Invalid id (got: ${idParam})` },
      { status: 400 }
    );
  }

  try {
    await prisma.hourEntry.delete({ where: { id } });
    return NextResponse.json({ ok: true });

  } catch (err: any) {
    console.error("DELETE /api/admin/hours/[id] error:", err);
    return NextResponse.json(
      { error: err.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
