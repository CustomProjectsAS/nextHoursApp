import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { POST } from "./route";
import { createHash, randomBytes } from "crypto";

const SESSION_COOKIE = "cph_session";

function sha256Hex(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

describe("/api/admin/projects — create happy path", () => {
  let companyId: number | null = null;
  let adminUserId: number | null = null;
  let adminEmployeeId: number | null = null;
  let projectId: number | null = null;

  afterEach(async () => {
    if (projectId) {
      await prisma.activityEvent
        .deleteMany({ where: { entityId: projectId } })
        .catch(() => {});
      await prisma.project.deleteMany({ where: { id: projectId } }).catch(() => {});
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
    projectId = null;
  });

  it("ADMIN can create project -> ok + requestId + DB row + activityEvent", async () => {
    const company = await prisma.company.create({
      data: { name: "Projects Create Co" },
    });
    companyId = company.id;

    const adminUser = await prisma.user.create({
      data: {
        email: `admin.projects.create+${Date.now()}@test.com`,
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
        name: "Admin Project Creator",
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

    const req = new Request("http://test/api/admin/projects", {
      method: "POST",
      headers: {
        cookie: `${SESSION_COOKIE}=${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "Alpha Project",
        color: "#ff0000",
      }),
    });

    const res = await POST(req as any);

    expect(res.status).toBe(200);

    const requestId = res.headers.get("x-request-id");
    expect(requestId).toBeTruthy();

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data?.project).toBeTruthy();

    const project = body.data.project;
    expect(project.id).toBeTypeOf("number");
    expect(project.name).toBe("Alpha Project");
    expect(project.isActive).toBe(true);

    projectId = project.id;

    const db = await prisma.project.findUnique({ where: { id: project.id } });
    if (!db) throw new Error("Expected project to exist in DB");
    expect(db.companyId).toBe(company.id);
    expect(db.name).toBe("Alpha Project");
    expect(db.isActive).toBe(true);

    const ev = await prisma.activityEvent.findFirst({
      where: {
        companyId: company.id,
        entityType: "PROJECT",
        entityId: project.id,
        eventType: "PROJECT_CREATED",
      },
    });

    expect(ev).toBeTruthy();
    // Assert what the code actually writes today (even if we dislike it)
    expect(ev!.actorType).toBe("EMPLOYEE");
    expect(ev!.actorId).toBe(adminEmployee.id);
  });
});
