import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Create some employees
    const kaspars = await prisma.employee.create({
      data: {
        name: "Kaspars",
        email: "kaspars@example.com",
      },
    });

    const testMan = await prisma.employee.create({
      data: {
        name: "testMan",
        email: "testman@example.com",
      },
    });

    // Create some projects
    const accounting = await prisma.project.create({
      data: {
        name: "Accounting",
        color: "#F4C542",
      },
    });

    const colorProject = await prisma.project.create({
      data: {
        name: "Color Project",
        color: "#6366F1",
      },
    });

    // Insert example hours
    await prisma.hourEntry.create({
      data: {
        employeeId: kaspars.id,
        projectId: accounting.id,
        workDate: new Date("2025-12-04"),
        fromTime: "17:30",
        toTime: "18:30",
        breakMinutes: 0,
        hoursNet: 1.0,
        hoursBrut: 1.0,
        description: "Example entry",
        status: "APPROVED",
      },
    });

    await prisma.hourEntry.create({
      data: {
        employeeId: testMan.id,
        projectId: colorProject.id,
        workDate: new Date("2025-12-05"),
        fromTime: "19:00",
        toTime: "20:00",
        breakMinutes: 0,
        hoursNet: 1.0,
        hoursBrut: 1.0,
        description: "Another entry",
        status: "PENDING",
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
