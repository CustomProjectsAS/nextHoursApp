import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { EmployeeStatus } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { error: "Missing token" },
        { status: 400 },
      );
    }

    const employee = await prisma.employee.findFirst({
      where: {
        inviteToken: token,
      },
      include: {
        company: true,
      },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Invalid invite link" },
        { status: 404 },
      );
    }

    if (
        employee.status !== EmployeeStatus.INVITED &&
        employee.status !== EmployeeStatus.ACTIVE
      ) {
        return NextResponse.json(
          { error: "This link is no longer valid for this employee." },
          { status: 400 },
        );
      }


    if (
      employee.inviteExpiresAt &&
      employee.inviteExpiresAt.getTime() < Date.now()
    ) {
      return NextResponse.json(
        { error: "Invite link has expired" },
        { status: 400 },
      );
    }

   return NextResponse.json({
      ok: true,
      employee: {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        companyName: employee.company?.name ?? null,
        status: employee.status,
      },
    });

  } catch (error: any) {
    console.error("GET /api/onboarding/validate error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Internal server error" },
      { status: 500 },
    );
  }
}
