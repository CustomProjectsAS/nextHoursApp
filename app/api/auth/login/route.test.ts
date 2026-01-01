import { describe, it, expect, afterEach } from "vitest";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

describe("POST /api/auth/login — HAPPY PATH (single company)", () => {
  let createdCompanyId: number | null = null;
  let createdUserId: number | null = null;
  let createdEmployeeId: number | null = null;

  afterEach(async () => {
    if (createdEmployeeId) {
      await prisma.session.deleteMany({ where: { employeeId: createdEmployeeId } });
      await prisma.hourEntry.deleteMany({ where: { employeeId: createdEmployeeId } });
      await prisma.employee.deleteMany({ where: { id: createdEmployeeId } });
    }

    if (createdUserId) {
      await prisma.user.deleteMany({ where: { id: createdUserId } });
    }

    if (createdCompanyId) {
      await prisma.company.deleteMany({ where: { id: createdCompanyId } });
    }

    createdCompanyId = null;
    createdUserId = null;
    createdEmployeeId = null;
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
    createdCompanyId = company.id;

    const user = await prisma.user.create({
      data: {
        email: `login.success+${Date.now()}@test.com`,
        passwordHash,
      },
    });
    createdUserId = user.id;

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
    createdEmployeeId = employee.id;

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

  });
});
