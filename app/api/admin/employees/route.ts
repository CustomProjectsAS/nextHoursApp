import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { EmployeeStatus } from "@prisma/client";
import crypto from "crypto";


function generateInviteToken() {
  return crypto.randomBytes(32).toString("hex");
}

const INVITE_EXPIRATION_DAYS = 7;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 },
      );
    }

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 },
      );
    }

    // TODO: replace with real company from authenticated admin
    

    const now = new Date();
    const inviteToken = generateInviteToken();
    const inviteExpiresAt = new Date(
      now.getTime() + INVITE_EXPIRATION_DAYS * 24 * 60 * 60 * 1000,
    );

        // Ensure there is a company to attach this employee to
    let company = await prisma.company.findFirst();
    if (!company) {
      company = await prisma.company.create({
        data: {
          name: "Default Company",
        },
      });
    }


    const employee = await prisma.employee.create({
        data: {
            name,
            email,
            status: EmployeeStatus.INVITED,
            inviteToken,
            invitedAt: now,
            inviteExpiresAt,
            company: {
            connect: { id: company.id },
            },
        },
        });



    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      process.env.APP_URL ??
      "http://localhost:3000";

    const inviteUrl = `${baseUrl}/onboarding?token=${employee.inviteToken}`;

    return NextResponse.json({ employee, inviteUrl });
  } catch (error: any) {
    console.error("POST /api/admin/employees error:", error);

    // Prisma unique constraint on email or inviteToken
    if (error?.code === "P2002") {
      return NextResponse.json(
        { error: "Employee with this email already exists." },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: error?.message ?? "Internal server error" },
      { status: 500 },
    );
  }
}
