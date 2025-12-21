import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      employeeId,
      projectId,
      date,
      fromTime,
      toTime,
      breakMinutes = 0,
      description,
    } = body;

    // basic presence check
    if (!employeeId || !date || !fromTime || !toTime) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const fromMinutes = parseTimeToMinutes(fromTime);
    const toMinutes = parseTimeToMinutes(toTime);

    if (fromMinutes === null || toMinutes === null) {
      return NextResponse.json(
        { error: "Invalid time format. Use HH:MM." },
        { status: 400 },
      );
    }

    const breakM =
      typeof breakMinutes === "number"
        ? breakMinutes
        : parseInt(String(breakMinutes || "0"), 10);

    if (Number.isNaN(breakM) || breakM < 0) {
      return NextResponse.json(
        { error: "Break minutes must be a non-negative number." },
        { status: 400 },
      );
    }

    const totalMinutes = toMinutes - fromMinutes;

    if (totalMinutes <= 0) {
      return NextResponse.json(
        { error: "End time must be after start time." },
        { status: 400 },
      );
    }

    const netMinutes = totalMinutes - breakM;

    if (netMinutes <= 0) {
      return NextResponse.json(
        {
          error:
            "Break is too long. Net time must be greater than zero minutes.",
        },
        { status: 400 },
      );
    }

    const hoursNet = netMinutes / 60;

    const workDate = new Date(date);

    const entry = await prisma.hourEntry.create({
      data: {
        employeeId,
        projectId: projectId ?? null,
        workDate,
        fromTime,
        toTime,
        breakMinutes: breakM,
        hoursNet,
        hoursBrut: hoursNet, // same for now
        description: description ?? "",
        status: "PENDING",
      },
    });

    return NextResponse.json({ ok: true, entry });
  } catch (err: any) {
    console.error("POST /api/employee/hours error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Unknown error" },
      { status: 500 },
    );
  }
}
