import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { POST } from "./route";
import { createHash, randomBytes } from "crypto";

const SESSION_COOKIE = "cph_session";

function sha256Hex(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

describe("/api/admin/invite — admin happy path", () => {
  let companyId: number | null = null;
  let adminUserId: number | null = null;
  let adminEmployeeId: number | null = null;
  let invitedEmployeeId: number | undefined = undefined;

  afterEach(async () => {
    if (invitedEmployeeId) {
      await prisma.activityEvent
        .deleteMany({ where: { entityId: invitedEmployeeId } })
        .catch(() => { });
      await prisma.employee
        .deleteMany({ where: { id: invitedEmployeeId } })
        .catch(() => { });
    }

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
    invitedEmployeeId = undefined;

  });

  it("ADMIN can invite employee -> employee INVITED + audit event + requestId", async () => {
    // company
    const company = await prisma.company.create({
      data: { name: "Invite Test Co" },
    });
    companyId = company.id;

    // admin identity
    const adminUser = await prisma.user.create({
      data: {
        email: `admin.invite+${Date.now()}@test.com`,
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
        name: "Admin Inviter",
      },
    });
    adminEmployeeId = adminEmployee.id;

    const adminToken = randomBytes(32).toString("hex");
    await prisma.session.create({
      data: {
        tokenHash: sha256Hex(adminToken),
        employeeId: adminEmployee.id,
        companyId: company.id,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    // request
    const inviteEmail = `invited.user+${Date.now()}@test.com`;

    const req = new Request("http://test/api/admin/invite", {
      method: "POST",
      headers: {
        cookie: `${SESSION_COOKIE}=${adminToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: inviteEmail,
        role: "EMPLOYEE",
        name: "Invited User",
      }),
    });

    const res = await POST(req as any);

    // HTTP + headers
    expect(res.status).toBe(200);
    const requestId = res.headers.get("x-request-id");
    expect(requestId).toBeTruthy();

    // response contract
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data?.employeeId).toBeTypeOf("number");
    expect(body.data?.inviteLink).toContain("/onboarding?token=");
    expect(body.data?.expiresAt).toBeTruthy();

    invitedEmployeeId = body.data.employeeId as number;


    // DB: employee
    const employee = await prisma.employee.findUnique({
      where: { id: invitedEmployeeId },
    });
    if (!employee) throw new Error("Expected invited employee to exist");

    expect(employee.companyId).toBe(company.id);
    expect(employee.email).toBe(inviteEmail);
    expect(employee.status).toBe("INVITED");
    expect(employee.inviteTokenHash).toBeTruthy();

    // token is hashed (never raw)
    expect(employee.inviteTokenHash).not.toContain("token");

    // DB: audit event
    const ev = await prisma.activityEvent.findFirst({
      where: {
        companyId: company.id,
        entityType: "EMPLOYEE",
        entityId: invitedEmployeeId,
        eventType: "EMPLOYEE_INVITED",
      },
    });

    expect(ev).toBeTruthy();
    expect(ev!.actorType).toBe("ADMIN");
    expect(ev!.actorId).toBe(adminEmployee.id);
  });
  it("rate limit (actor) -> 429 RATE_LIMIT + no DB side effects", async () => {
    // company
    const company = await prisma.company.create({
      data: { name: "Invite RateLimit Co" },
    });
    companyId = company.id;

    // admin identity
    const adminUser = await prisma.user.create({
      data: {
        email: `admin.ratelimit+${Date.now()}@test.com`,
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
        name: "Admin Inviter",
      },
    });
    adminEmployeeId = adminEmployee.id;

    const adminToken = randomBytes(32).toString("hex");
    await prisma.session.create({
      data: {
        tokenHash: sha256Hex(adminToken),
        employeeId: adminEmployee.id,
        companyId: company.id,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    const makeReq = (i: number) =>
      new Request("http://test/api/admin/invite", {
        method: "POST",
        headers: {
          cookie: `${SESSION_COOKIE}=${adminToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          email: `invited+${i}@test.com`,
          role: "EMPLOYEE",
          name: "Invited User",
        }),
      });


    // Hit limit (20 allowed)
    for (let i = 0; i < 20; i++) {
      const res = await POST(makeReq(i) as any);
      expect(res.status).toBe(200);
    }


    // Snapshot BEFORE 429 attempt
    const before = {
      employees: await prisma.employee.count(),
      events: await prisma.activityEvent.count(),
    };

    // 21st → rate limited
    const res = await POST(makeReq(999) as any);

    expect(res.status).toBe(429);

    const requestId = res.headers.get("x-request-id");
    expect(requestId).toBeTruthy();

    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error?.code).toBe("RATE_LIMIT");
    expect(body.error?.requestId).toBe(requestId);

    // Snapshot AFTER 429 attempt
    const after = {
      employees: await prisma.employee.count(),
      events: await prisma.activityEvent.count(),
    };

    expect(after).toEqual(before);
  });

});
