import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { POST } from "./route";
import { createHash, randomBytes } from "crypto";

const SESSION_COOKIE = "cph_session";

function sha256Hex(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

describe("/api/admin/hours/[id]/reject — admin happy path", () => {
  let companyId: number | null = null;

  let adminUserId: number | null = null;
  let adminEmployeeId: number | null = null;

  let workerUserId: number | null = null;
  let workerEmployeeId: number | null = null;

  let entryId: number | null = null;

  afterEach(async () => {
    if (entryId) {
      await prisma.activityEvent
        .deleteMany({ where: { entityId: entryId } })
        .catch(() => {});
      await prisma.hourEntry
        .deleteMany({ where: { id: entryId } })
        .catch(() => {});
    }

    if (adminEmployeeId) {
      await prisma.session.deleteMany({ where: { employeeId: adminEmployeeId } });
      await prisma.employee.deleteMany({ where: { id: adminEmployeeId } });
    }
    if (workerEmployeeId) {
      await prisma.session.deleteMany({ where: { employeeId: workerEmployeeId } });
      await prisma.hourEntry.deleteMany({ where: { employeeId: workerEmployeeId } });
      await prisma.employee.deleteMany({ where: { id: workerEmployeeId } });
    }

    if (adminUserId) {
      await prisma.user.deleteMany({ where: { id: adminUserId } });
    }
    if (workerUserId) {
      await prisma.user.deleteMany({ where: { id: workerUserId } });
    }

    if (companyId) {
      await prisma.company.deleteMany({ where: { id: companyId } });
    }

    companyId = null;
    adminUserId = null;
    adminEmployeeId = null;
    workerUserId = null;
    workerEmployeeId = null;
    entryId = null;
  });

  it("rejects a PENDING entry in same company (admin-only) -> status REJECTED + rejectReason + requestId + activityEvent", async () => {
    const company = await prisma.company.create({
      data: { name: "Admin Reject Co" },
    });
    companyId = company.id;

    // admin identity (must satisfy ctx.role === ADMIN/OWNER)
    const adminUser = await prisma.user.create({
      data: {
        email: `admin.reject+${Date.now()}@test.com`,
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
        name: "Admin Rejector",
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

    // worker identity (owns the hour entry)
    const workerUser = await prisma.user.create({
      data: {
        email: `worker.reject+${Date.now()}@test.com`,
        passwordHash: "not-used",
      },
    });
    workerUserId = workerUser.id;

    const workerEmployee = await prisma.employee.create({
      data: {
        userId: workerUser.id,
        companyId: company.id,
        role: "EMPLOYEE",
        status: "ACTIVE",
        isActive: true,
        name: "Worker",
      },
    });
    workerEmployeeId = workerEmployee.id;

    const existing = await prisma.hourEntry.create({
      data: {
        companyId: company.id,
        employeeId: workerEmployee.id,
        projectId: null,
        workDate: new Date("2026-01-01"),
        fromTime: "08:00",
        toTime: "16:00",
        breakMinutes: 30,
        hoursNet: 7.5,
        hoursBrut: 7.5,
        description: "Needs rejection",
        status: "PENDING",
      },
    });
    entryId = existing.id;

    const rejectReason = "Wrong project / hours invalid";

    const req = new Request(`http://test/api/admin/hours/${existing.id}/reject`, {
      method: "POST",
      headers: {
        cookie: `${SESSION_COOKIE}=${adminToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ rejectReason }),
    });

    const res = await POST(req as any, {
      params: Promise.resolve({ id: String(existing.id) }),
    });

    expect(res.status).toBe(200);

    const requestId = res.headers.get("x-request-id");
    expect(requestId).toBeTruthy();

    const bodyJson = await res.json();
    expect(bodyJson.ok).toBe(true);
    expect(bodyJson.data?.entry).toBeTruthy();

    const entry = bodyJson.data.entry;
    expect(entry.id).toBe(existing.id);
    expect(entry.companyId).toBe(company.id);
    expect(entry.status).toBe("REJECTED");
    expect(entry.rejectReason).toBe(rejectReason);

    const db = await prisma.hourEntry.findUnique({ where: { id: existing.id } });
    if (!db) throw new Error("Expected hourEntry to exist in DB");
    expect(db.companyId).toBe(company.id);
    expect(db.status).toBe("REJECTED");
    expect(db.rejectReason).toBe(rejectReason);

    const ev = await prisma.activityEvent.findFirst({
      where: {
        companyId: company.id,
        entityType: "HOUR_ENTRY",
        entityId: existing.id,
        eventType: "HOUR_REJECTED",
      },
    });

    expect(ev).toBeTruthy();
    expect(ev!.actorType).toBe("ADMIN");
    expect(ev!.actorId).toBe(adminEmployee.id);
  });
});
