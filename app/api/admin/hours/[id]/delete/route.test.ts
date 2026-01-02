import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { POST } from "./route";
import { createHash, randomBytes } from "crypto";

const SESSION_COOKIE = "cph_session";

function sha256Hex(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

describe("/api/admin/hours/[id]/delete — admin happy path", () => {
  let companyId: number | null = null;
  let adminUserId: number | null = null;
  let adminEmployeeId: number | null = null;
  let entryId: number | null = null;

  afterEach(async () => {
    if (entryId) {
      await prisma.activityEvent.deleteMany({ where: { entityId: entryId } }).catch(() => { });
      await prisma.hourEntry.deleteMany({ where: { id: entryId } }).catch(() => { });
    }
    if (adminEmployeeId) {
      await prisma.session.deleteMany({ where: { employeeId: adminEmployeeId } });
      await prisma.employee.deleteMany({ where: { id: adminEmployeeId } });
    }

    if (adminUserId) await prisma.user.deleteMany({ where: { id: adminUserId } });

    if (companyId) await prisma.company.deleteMany({ where: { id: companyId } });

    companyId = adminUserId = adminEmployeeId = entryId = null;

  });

  it("soft-deletes an entry in same company (admin-only) -> deletedAt set + activityEvent + requestId", async () => {
    const company = await prisma.company.create({ data: { name: "Admin Delete Co" } });
    companyId = company.id;

    const adminUser = await prisma.user.create({
      data: { email: `admin.delete+${Date.now()}@test.com`, passwordHash: "x" },
    });
    adminUserId = adminUser.id;

    const adminEmployee = await prisma.employee.create({
      data: {
        userId: adminUser.id,
        companyId: company.id,
        role: "ADMIN",
        status: "ACTIVE",
        isActive: true,
        name: "Admin Deleter",
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



    const entry = await prisma.hourEntry.create({
      data: {
        companyId: company.id,
        employeeId: adminEmployee.id,
        projectId: null,
        workDate: new Date("2026-01-01"),
        fromTime: "08:00",
        toTime: "16:00",
        breakMinutes: 30,
        hoursNet: 7.5,
        hoursBrut: 7.5,
        description: "Delete me",
        status: "PENDING",
      },
    });
    entryId = entry.id;

    const req = new Request(`http://test/api/admin/hours/${entry.id}/delete`, {
      method: "POST",
      headers: { cookie: `${SESSION_COOKIE}=${token}` },
    });

    const res = await POST(req as any, {
      params: Promise.resolve({ id: String(entry.id) }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("x-request-id")).toBeTruthy();

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.entry.deletedAt).toBeTruthy();

    const db = await prisma.hourEntry.findUnique({ where: { id: entry.id } });
    expect(db?.deletedAt).toBeTruthy();

    const ev = await prisma.activityEvent.findFirst({
      where: {
        companyId: company.id,
        entityType: "HOUR_ENTRY",
        entityId: entry.id,
        eventType: "HOUR_DELETED",
      },
    });

    expect(ev).toBeTruthy();
    expect(ev!.actorType).toBe("ADMIN");
    expect(ev!.actorId).toBe(adminEmployee.id);
  });
});
