import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { POST } from "./route";
import { createHash, randomBytes } from "crypto";
import { PATCH } from "./[id]/route";
import { POST as DISABLE } from "./[id]/disable/route";
import { GET } from "./route";


const SESSION_COOKIE = "cph_session";

function sha256Hex(input: string) {
    return createHash("sha256").update(input).digest("hex");
}

describe("/api/admin/projects — create happy path", () => {
    let companyId: number | null = null;
    let adminUserId: number | null = null;
    let adminEmployeeId: number | null = null;
    let projectId: number | null = null;
    let companyIdB: number | null = null;
    let projectIdsB: number[] = [];


    afterEach(async () => {
        if (projectId) {
            await prisma.activityEvent
                .deleteMany({ where: { entityId: projectId } })
                .catch(() => { });
            await prisma.project.deleteMany({ where: { id: projectId } }).catch(() => { });
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

        if (projectIdsB.length) {
            await prisma.project.deleteMany({ where: { id: { in: projectIdsB } } }).catch(() => { });
        }

        if (companyIdB) {
            await prisma.company.deleteMany({ where: { id: companyIdB } });
        }

        projectIdsB = [];
        companyIdB = null;
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
    it("ADMIN can update project -> ok + requestId + DB mutation + activityEvent", async () => {
        const company = await prisma.company.create({
            data: { name: "Projects Update Co" },
        });
        companyId = company.id;

        const adminUser = await prisma.user.create({
            data: {
                email: `admin.projects.update+${Date.now()}@test.com`,
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
                name: "Admin Project Updater",
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

        // create initial project to update
        const created = await prisma.project.create({
            data: {
                companyId: company.id,
                name: "Alpha Project",
                color: "#111111",
                isActive: true,
            },
            select: { id: true },
        });
        projectId = created.id;

        const req = new Request(`http://test/api/admin/projects/${created.id}`, {
            method: "PATCH",
            headers: {
                cookie: `${SESSION_COOKIE}=${token}`,
                "content-type": "application/json",
            },
            body: JSON.stringify({
                name: "Beta Project",
                color: "#222222",
            }),
        });

        const res = await PATCH(req as any, {
            params: Promise.resolve({ id: String(created.id) }),
        });

        expect(res.status).toBe(200);
        expect(res.headers.get("x-request-id")).toBeTruthy();

        const body = await res.json();
        expect(body.ok).toBe(true);
        expect(body.data?.project).toBeTruthy();

        const project = body.data.project;
        expect(project.id).toBe(created.id);
        expect(project.name).toBe("Beta Project");
        expect(project.color).toBe("#222222");
        expect(project.isActive).toBe(true);

        const db = await prisma.project.findUnique({ where: { id: created.id } });
        if (!db) throw new Error("Expected project to exist in DB");
        expect(db.companyId).toBe(company.id);
        expect(db.name).toBe("Beta Project");
        expect(db.color).toBe("#222222");

        const ev = await prisma.activityEvent.findFirst({
            where: {
                companyId: company.id,
                entityType: "PROJECT",
                entityId: created.id,
                eventType: "PROJECT_UPDATED",
            },
        });

        expect(ev).toBeTruthy();
        expect(ev!.actorType).toBe("EMPLOYEE"); // assert current behavior
        expect(ev!.actorId).toBe(adminEmployee.id);
    });
    it("ADMIN can disable project -> ok + requestId + DB mutation + activityEvent", async () => {
        const company = await prisma.company.create({
            data: { name: "Projects Disable Co" },
        });
        companyId = company.id;

        const adminUser = await prisma.user.create({
            data: {
                email: `admin.projects.disable+${Date.now()}@test.com`,
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
                name: "Admin Project Disabler",
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

        // create active project to disable
        const created = await prisma.project.create({
            data: {
                companyId: company.id,
                name: "Gamma Project",
                color: "#333333",
                isActive: true,
            },
            select: { id: true },
        });
        projectId = created.id;

        const req = new Request(`http://test/api/admin/projects/${created.id}/disable`, {
            method: "POST",
            headers: {
                cookie: `${SESSION_COOKIE}=${token}`,
            },
        });

        const res = await DISABLE(req as any, {
            params: Promise.resolve({ id: String(created.id) }),
        });

        expect(res.status).toBe(200);
        expect(res.headers.get("x-request-id")).toBeTruthy();

        const body = await res.json();
        expect(body.ok).toBe(true);
        expect(body.data?.project).toBeTruthy();

        const project = body.data.project;
        expect(project.id).toBe(created.id);
        expect(project.name).toBe("Gamma Project");
        expect(project.isActive).toBe(false);

        const db = await prisma.project.findUnique({ where: { id: created.id } });
        if (!db) throw new Error("Expected project to exist in DB");
        expect(db.companyId).toBe(company.id);
        expect(db.isActive).toBe(false);

        const ev = await prisma.activityEvent.findFirst({
            where: {
                companyId: company.id,
                entityType: "PROJECT",
                entityId: created.id,
                eventType: "PROJECT_DISABLED",
            },
        });

        expect(ev).toBeTruthy();
        expect(ev!.actorType).toBe("EMPLOYEE"); // assert current behavior
        expect(ev!.actorId).toBe(adminEmployee.id);
    });
    it("admin GET /api/admin/projects returns only caller company projects (no cross-tenant leak)", async () => {
        // Company A
        const companyA = await prisma.company.create({ data: { name: "Projects List A" } });
        companyId = companyA.id;

        const adminUserA = await prisma.user.create({
            data: { email: `admin.listA+${Date.now()}@test.com`, passwordHash: "not-used" },
        });
        adminUserId = adminUserA.id;

        const adminEmployeeA = await prisma.employee.create({
            data: {
                userId: adminUserA.id,
                companyId: companyA.id,
                role: "ADMIN",
                status: "ACTIVE",
                isActive: true,
                name: "Admin A",
            },
        });
        adminEmployeeId = adminEmployeeA.id;

        const tokenA = randomBytes(32).toString("hex");
        await prisma.session.create({
            data: {
                tokenHash: sha256Hex(tokenA),
                employeeId: adminEmployeeA.id,
                companyId: companyA.id,
                expiresAt: new Date(Date.now() + 60_000),
            },
        });

        const projectA1 = await prisma.project.create({
            data: { companyId: companyA.id, name: "A1", isActive: true },
        });
        const projectA2 = await prisma.project.create({
            data: { companyId: companyA.id, name: "A2", isActive: true },
        });
        projectId = projectA1.id; // reuse existing cleanup path

        // Company B
        const companyB = await prisma.company.create({ data: { name: "Projects List B" } });
        companyIdB = companyB.id;

        const projectB1 = await prisma.project.create({
            data: { companyId: companyB.id, name: "B1", isActive: true },
        });
        const projectB2 = await prisma.project.create({
            data: { companyId: companyB.id, name: "B2", isActive: true },
        });
        projectIdsB.push(projectB1.id, projectB2.id);

        // Call GET as Company A admin
        const req = new Request("http://test/api/admin/projects", {
            method: "GET",
            headers: { cookie: `${SESSION_COOKIE}=${tokenA}` },
        });

        const res = await GET(req as any);

        expect(res.status).toBe(200);
        const requestId = res.headers.get("x-request-id");
        expect(requestId).toBeTruthy();

        const body = await res.json();
        expect(body.ok).toBe(true);

        const ids = body.data.projects.map((p: any) => p.id);

        expect(ids).toContain(projectA1.id);
        expect(ids).toContain(projectA2.id);
        expect(ids).not.toContain(projectB1.id);
        expect(ids).not.toContain(projectB2.id);
    });

});
