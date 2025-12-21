import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";

const SESSION_COOKIE = "cph_session";
const SESSION_DAYS = 30;

function sha256Hex(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

function sessionExpiryDate() {
  return new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");

    if (!email || !password) {
      return NextResponse.json(
        { ok: false, error: "Email and password are required" },
        { status: 400 },
      );
    }

    // Find all employees with this email (can exist in multiple companies)
    const candidates = await prisma.employee.findMany({
      where: {
        email,
        isActive: true,
        status: "ACTIVE",
      },
      include: {
        company: true,
      },
    });

    if (candidates.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Invalid credentials" },
        { status: 401 },
      );
    }

    // Verify password against any candidate that has passwordHash
    const matches: typeof candidates = [];
    for (const e of candidates) {
      if (!e.passwordHash) continue;
      const ok = await bcrypt.compare(password, e.passwordHash);
      if (ok) matches.push(e);
    }

    if (matches.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Invalid credentials" },
        { status: 401 },
      );
    }

    // If multiple companies match, return list for choose-company step
    if (matches.length > 1) {
      return NextResponse.json({
        ok: true,
        needsCompanyPick: true,
        companies: matches.map((e) => ({
          companyId: e.companyId,
          companyName: e.company?.name ?? "—",
        })),
      });
    }

    // Exactly one match -> create session + set cookie
    const employee = matches[0];
    if (!employee.companyId) {
      return NextResponse.json(
        { ok: false, error: "Employee has no companyId" },
        { status: 500 },
      );
    }

    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = sha256Hex(rawToken);
    const expiresAt = sessionExpiryDate();

    await prisma.session.create({
      data: {
        tokenHash,
        employeeId: employee.id,
        companyId: employee.companyId,
        expiresAt,
        // ip/userAgent optional; skip for now
      },
    });

    const res = NextResponse.json({
      ok: true,
      needsCompanyPick: false,
      user: {
        employeeId: employee.id,
        companyId: employee.companyId,
        role: employee.role,
        name: employee.name,
        companyName: employee.company?.name ?? "—",
      },
    });

    res.cookies.set(SESSION_COOKIE, rawToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DAYS * 24 * 60 * 60,
    });

    return res;
  } catch (err: any) {
    console.error("POST /api/auth/login error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Internal server error" },
      { status: 500 },
    );
  }
}
