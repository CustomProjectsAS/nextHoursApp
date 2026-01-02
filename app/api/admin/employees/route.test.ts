import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { POST } from "./route";
import { createHash, randomBytes } from "crypto";

const SESSION_COOKIE = "cph_session";

function sha256Hex(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

describe("/api/admin/employees (legacy) — returns 410", () => {
  let companyId: number | null = null;
  let adminUserId: number | null = null;
  let adminEmployeeId: number | null = null;

  afterEach(async () => {
    if (adminEmployeeId) {
      await prisma.session.deleteMany({ where: { employeeId: adminEmployeeId } });
      await prisma.employee.deleteMany({ where: { id: adminEmployeeId } });
    }

    if (adminUserId) {
      await prisma.user.deleteMany({ where: { id: adminUserId } });
    }

    if (companyId) {
      await prisma.company.deleteMany({ where: { id: companyId } });
    }

    companyId = null;
    adminUserId = null;
    adminEmployeeId = null;
  });

  it("ADMIN calling legacy endpoint -> 410 BAD_REQUEST + requestId + x-request-id", async () => {
    const company = await prisma.company.create({
      data: { name: "Legacy Employees Co" },
    });
    companyId = company.id;

    const adminUser = await prisma.user.create({
      data: {
        email: `admin.legacy.employees+${Date.now()}@test.com`,
        passwordHash: "not-used",
      },
    });
    adminUserId = adminUser.id;

    const adminEmployee = await prisma.employee.create({
      data: {
        userId: adminUser.id,
        companyId: company.id,
        role: "ADMIN",
        status: "ACTIVE",
        isActive: true,
        name: "Admin Legacy",
      },
    });
    adminEmployeeId = adminEmployee.id;

    const token = randomBytes(32).toString("hex");
    await prisma.session.create({
      data: {
        tokenHash: sha256Hex(token),
        employeeId: adminEmployee.id,
        companyId: company.id,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    const req = new Request("http://test/api/admin/employees", {
      method: "POST",
      headers: {
        cookie: `${SESSION_COOKIE}=${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    });

    const res = await POST(req as any);

    expect(res.status).toBe(410);

    const requestId = res.headers.get("x-request-id");
    expect(requestId).toBeTruthy();

    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error?.code).toBe("BAD_REQUEST");
    expect(body.error?.message).toContain("Legacy endpoint disabled");
    expect(body.error?.requestId).toBe(requestId);
  });
});
