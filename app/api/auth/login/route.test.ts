import { describe, it, expect, afterEach } from "vitest";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

describe("POST /api/auth/login — HAPPY PATH (single company)", () => {
  afterEach(async () => {
    await prisma.session.deleteMany();
    await prisma.hourEntry.deleteMany();
    await prisma.employee.deleteMany();
    await prisma.user.deleteMany();
    await prisma.company.deleteMany();
  });

  it("returns 200, sets session cookie, and returns user payload", async () => {
    // --- Arrange (minimal fixture) ---
    const password = "correct-password";
    const passwordHash = await bcrypt.hash(password, 10);

    const company = await prisma.company.create({
      data: {
        name: "Test Company",
      },
    });

    const user = await prisma.user.create({
      data: {
        email: `login.success+${Date.now()}@test.com`,
        passwordHash,
      },
    });

    const employee = await prisma.employee.create({
      data: {
        userId: user.id,
        companyId: company.id,
        role: "EMPLOYEE",
        status: "ACTIVE",
        isActive: true,
        name: "Test Employee",
      },
    });

    // --- Act ---
    const res = await fetch("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: user.email,
        password,
      }),
    });

    // --- Assert: HTTP + headers ---
    expect(res.status).toBe(200);

    const requestId = res.headers.get("x-request-id");
    expect(requestId).toBeTruthy();

    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toContain("cph_session=");

    // --- Assert: body ---
    const body = await res.json();

    expect(body).toEqual({
      ok: true,
      data: {
        user: {
          employeeId: employee.id,
          companyId: company.id,
          role: "EMPLOYEE",
          name: "Test Employee",
          companyName: "Test Company",
        },
      },
    });

    // --- Assert: DB side effect ---
    const sessions = await prisma.session.findMany({
      where: {
        employeeId: employee.id,
        companyId: company.id,
      },
    });

    expect(sessions.length).toBe(1);
  });
});
