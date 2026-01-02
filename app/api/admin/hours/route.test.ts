import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { GET } from "./route";
import { createHash, randomBytes } from "crypto";

const SESSION_COOKIE = "cph_session";

function sha256Hex(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

describe("/api/admin/hours — tenant-safe read (employeeId filter)", () => {
  let companyAId: number | null = null;
  let userAId: number | null = null;
  let adminAId: number | null = null;

  let companyBId: number | null = null;
  let userBId: number | null = null;
  let adminBId: number | null = null;

  let employeeAId: number | null = null;

  afterEach(async () => {
    if (adminAId) await prisma.session.deleteMany({ where: { employeeId: adminAId } });
    if (adminBId) await prisma.session.deleteMany({ where: { employeeId: adminBId } });

    if (employeeAId) await prisma.employee.deleteMany({ where: { id: employeeAId } });

    if (adminAId) await prisma.employee.deleteMany({ where: { id: adminAId } });
    if (adminBId) await prisma.employee.deleteMany({ where: { id: adminBId } });

    if (userAId) await prisma.user.deleteMany({ where: { id: userAId } });
    if (userBId) await prisma.user.deleteMany({ where: { id: userBId } });

    if (companyAId) await prisma.company.deleteMany({ where: { id: companyAId } });
    if (companyBId) await prisma.company.deleteMany({ where: { id: companyBId } });

    companyAId = userAId = adminAId = null;
    companyBId = userBId = adminBId = null;
    employeeAId = null;
  });

  it("cross-tenant employeeId denied: Company B cannot query admin/hours with Company A employeeId", async () => {
    // Company A
    const companyA = await prisma.company.create({ data: { name: "AdminHours Tenant A" } });
    companyAId = companyA.id;

    const userA = await prisma.user.create({
      data: {
        email: `adminhours.a+${Date.now()}@test.com`,
        passwordHash: "not-used",
      },
    });
    userAId = userA.id;

    // Admin A (not used to call route, but establishes tenant realism)
    const adminA = await prisma.employee.create({
      data: {
        userId: userA.id,
        companyId: companyA.id,
        role: "ADMIN",
        status: "ACTIVE",
        isActive: true,
        name: "Admin A",
      },
    });
    adminAId = adminA.id;

    // A normal employee in A whose id will be attacked
    const employeeA = await prisma.employee.create({
      data: {
        userId: userA.id,
        companyId: companyA.id,
        role: "EMPLOYEE",
        status: "ACTIVE",
        isActive: true,
        name: "Employee A",
      },
    });
    employeeAId = employeeA.id;

    // Company B (attacker admin)
    const companyB = await prisma.company.create({ data: { name: "AdminHours Tenant B" } });
    companyBId = companyB.id;

    const userB = await prisma.user.create({
      data: {
        email: `adminhours.b+${Date.now()}@test.com`,
        passwordHash: "not-used",
      },
    });
    userBId = userB.id;

    const adminB = await prisma.employee.create({
      data: {
        userId: userB.id,
        companyId: companyB.id,
        role: "ADMIN",
        status: "ACTIVE",
        isActive: true,
        name: "Admin B",
      },
    });
    adminBId = adminB.id;

    const tokenB = randomBytes(32).toString("hex");
    await prisma.session.create({
      data: {
        tokenHash: sha256Hex(tokenB),
        employeeId: adminB.id,
        companyId: companyB.id,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    // month required by route
    const month = "2026-01";

    // Attack: employeeId belongs to Company A
    const req = new Request(
      `http://test/api/admin/hours?month=${encodeURIComponent(month)}&employeeId=${employeeA.id}`,
      {
        method: "GET",
        headers: {
          cookie: `${SESSION_COOKIE}=${tokenB}`,
        },
      }
    );

    const res = await GET(req as any);

    // should be denied/validation (no leak, no data)
    expect(res.status).toBe(400);

    const requestId = res.headers.get("x-request-id");
    expect(requestId).toBeTruthy();

    const body = await res.json();
    expect(body.ok).toBe(false);

    // error shape should include requestId and match header
    expect(body.error?.requestId).toBe(requestId);
    expect(body.error?.code).toBe("VALIDATION");
  });
});
