import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


export async function GET(req: Request) {

  try {
    const { searchParams } = new URL(req.url);
const monthOffset = Number(searchParams.get("monthOffset") ?? "0") || 0;

// Compute target month in UTC to avoid timezone weirdness
const now = new Date();
const y = now.getUTCFullYear();
const m = now.getUTCMonth(); // 0-11

// first day of target month (UTC)
const start = new Date(Date.UTC(y, m + monthOffset, 1, 0, 0, 0));
// first day of next month (UTC)
const end = new Date(Date.UTC(y, m + monthOffset + 1, 1, 0, 0, 0));

const month = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`;
const monthLabel = start.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });


    // Get all hour entries for that month with employee + project info
    const entries = await prisma.hourEntry.findMany({
      where: {
        workDate: {
          gte: start,
          lt: end,
        },
      },
      include: {
        employee: true,
        project: true,
      },
      orderBy: [
        { employee: { name: "asc" } },
        { workDate: "asc" },
      ],
    });

    // Group by employee
    const byEmployee = new Map<
      number,
      {
        id: number;
        name: string;
        totalNet: number;
        totalBrut: number;
        entries: any[];
      }
    >();

    let totalNet = 0;
    let totalBrut = 0;

    for (const e of entries) {
      const empId = e.employeeId;
      if (!byEmployee.has(empId)) {
        byEmployee.set(empId, {
          id: e.employee.id,
          name: e.employee.name,
          totalNet: 0,
          totalBrut: 0,
          entries: [],
        });
      }

      const group = byEmployee.get(empId)!;

      const net = Number(e.hoursNet ?? 0);
      const brut = Number(e.hoursBrut ?? e.hoursNet ?? 0);

      group.totalNet += net;
      group.totalBrut += brut;
      totalNet += net;
      totalBrut += brut;

      const status =
        e.status === "APPROVED" ? "approved" :
          e.status === "REJECTED" ? "rejected" :
            "pending";

      group.entries.push({
        id: e.id,
        date: e.workDate.toLocaleDateString("en-CA"), // YYYY-MM-DD (local)

        from: e.fromTime,
        to: e.toTime,
        breakLabel: e.breakMinutes ? `${e.breakMinutes} min` : "—",
        hoursNet: net,
        projectName: e.project?.name ?? "—",
        projectColor: e.project?.color ?? "#6B7280",
        description: e.description ?? "",
        status: status,
      });
    }

    const employees = Array.from(byEmployee.values());

    const responseBody = {
      month,
      monthLabel,
      totalNet,
      totalBrut,
      entriesCount: entries.length,
      employees,
    };

    return NextResponse.json(responseBody);
  } catch (err: any) {
    console.error("admin/hours error:", err);
    return NextResponse.json(
      { error: err.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
