import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { EmployeeStatus } from "@prisma/client";

function cleanName(input: unknown) {
  if (typeof input !== "string") return null;
  const name = input.trim();
  if (name.length < 2) return null;
  if (name.length > 80) return name.slice(0, 80);
  return name;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const token = typeof body?.token === "string" ? body.token : null;
    const nameClean = cleanName(body?.name);

    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    // Prefer findUnique if inviteToken is @unique in Prisma
    const employee = await prisma.employee.findUnique({
      where: { inviteToken: token },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        inviteExpiresAt: true,
      },
    });

    if (!employee) {
      return NextResponse.json({ error: "Invalid invite token" }, { status: 404 });
    }

    if (employee.status !== EmployeeStatus.INVITED) {
      return NextResponse.json({ error: "This invite is no longer valid" }, { status: 400 });
    }

    if (employee.inviteExpiresAt && employee.inviteExpiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: "Invite link has expired" }, { status: 400 });
    }

    const updated = await prisma.employee.update({
      where: { id: employee.id },
      data: {
        name: nameClean ?? employee.name,
        status: EmployeeStatus.ACTIVE,
        onboardedAt: new Date(),

        // SINGLE-USE: invalidate token after onboarding
        inviteToken: null,
        inviteExpiresAt: null,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    return NextResponse.json({
      ok: true,
      employee: updated,
    });
  } catch (error: any) {
    console.error("POST /api/onboarding/complete error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}
