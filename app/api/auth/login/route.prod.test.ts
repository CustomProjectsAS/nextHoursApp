import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

(process.env as any).NODE_ENV = "production";


describe("POST /api/auth/login — PRODUCTION cookie flags", () => {
  beforeEach(() => {
    vi.resetModules();
  });

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

  it("sets Secure on session cookie (unconditional)", async () => {
    const { POST } = await import("./route");

    // --- Arrange ---
    const password = "correct-password";
    const passwordHash = await bcrypt.hash(password, 10);

    const company = await prisma.company.create({
      data: { name: "Test Company" },
    });
    createdCompanyId = company.id;

    const user = await prisma.user.create({
      data: {
        email: `login.prod.secure+${Date.now()}@test.com`,
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
    const req = new Request("http://test/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.email, password }),
    });
    const res = await POST(req);

    // --- Assert ---
    expect(res.status).toBe(200);

    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toBeTruthy();

    expect(setCookie).toContain("cph_session=");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure"); // <-- the entire point of Gate 5.2
    expect(setCookie!).toMatch(/samesite=lax/i);
    expect(setCookie).toContain("Path=/");
  });
});
