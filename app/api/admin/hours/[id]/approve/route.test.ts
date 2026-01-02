import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { POST } from "./route";
import { createHash, randomBytes } from "crypto";

const SESSION_COOKIE = "cph_session";

function sha256Hex(input: string) {
    return createHash("sha256").update(input).digest("hex");
}

describe("/api/admin/hours/[id]/approve — admin happy path", () => {
    let companyId: number | null = null;
    let adminUserId: number | null = null;
    let adminEmployeeId: number | null = null;
    let workerUserId: number | null = null;
    let workerEmployeeId: number | null = null;
    let entryId: number | null = null;

    // Company B (attacker admin)
    let companyIdB: number | null = null;
    let adminUserIdB: number | null = null;
    let adminEmployeeIdB: number | null = null;


    afterEach(async () => {
        if (entryId) {
            await prisma.activityEvent
                .deleteMany({ where: { entityId: entryId } })
                .catch(() => { });
            await prisma.hourEntry
                .deleteMany({ where: { id: entryId } })
                .catch(() => { });
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
        if (adminEmployeeIdB) {
            await prisma.session.deleteMany({ where: { employeeId: adminEmployeeIdB } });
            await prisma.employee.deleteMany({ where: { id: adminEmployeeIdB } });
        }
        if (adminUserIdB) {
            await prisma.user.deleteMany({ where: { id: adminUserIdB } });
        }
        if (companyIdB) {
            await prisma.company.deleteMany({ where: { id: companyIdB } });
        }


        companyId = null;
        adminUserId = null;
        adminEmployeeId = null;
        workerUserId = null;
        workerEmployeeId = null;
        entryId = null;
        companyIdB = null;
        adminUserIdB = null;
        adminEmployeeIdB = null;

    });

    it("approves a PENDING entry in same company (admin-only) -> status APPROVED + requestId + activityEvent", async () => {
        const company = await prisma.company.create({
            data: { name: "Admin Approve Co" },
        });
        companyId = company.id;

        // admin identity (must satisfy ctx.role === ADMIN/OWNER)
        const adminUser = await prisma.user.create({
            data: {
                email: `admin.approve+${Date.now()}@test.com`,
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
                name: "Admin Approver",
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
                email: `worker.approve+${Date.now()}@test.com`,
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
                description: "Needs approval",
                status: "PENDING",
            },
        });
        entryId = existing.id;

        const req = new Request(`http://test/api/admin/hours/${existing.id}/approve`, {
            method: "POST",
            headers: {
                cookie: `${SESSION_COOKIE}=${adminToken}`,
            },
        });

        const res = await POST(req as any, {
            params: Promise.resolve({ id: String(existing.id) }),
        });

        expect(res.status).toBe(200);

        const requestId = res.headers.get("x-request-id");
        expect(requestId).toBeTruthy();

        const body = await res.json();
        expect(body.ok).toBe(true);
        expect(body.data?.entry).toBeTruthy();

        const entry = body.data.entry;
        expect(entry.id).toBe(existing.id);
        expect(entry.companyId).toBe(company.id);
        expect(entry.status).toBe("APPROVED");

        const db = await prisma.hourEntry.findUnique({ where: { id: existing.id } });
        if (!db) throw new Error("Expected hourEntry to exist in DB");
        expect(db.companyId).toBe(company.id);
        expect(db.status).toBe("APPROVED");
        expect(db.rejectReason).toBeNull();

        const ev = await prisma.activityEvent.findFirst({
            where: {
                companyId: company.id,
                entityType: "HOUR_ENTRY",
                entityId: existing.id,
                eventType: "HOUR_APPROVED",
            },
        });

        expect(ev).toBeTruthy();
        expect(ev!.actorType).toBe("ADMIN");
        expect(ev!.actorId).toBe(adminEmployee.id);

    });
    it("forbidden: EMPLOYEE cannot approve -> 403 FORBIDDEN + requestId, no DB change, no activityEvent", async () => {
        const company = await prisma.company.create({
            data: { name: "Approve Forbidden Co" },
        });
        companyId = company.id;

        // Non-admin identity (role EMPLOYEE)
        const user = await prisma.user.create({
            data: {
                email: `employee.forbidden.approve+${Date.now()}@test.com`,
                passwordHash: "not-used",
            },
        });
        workerUserId = user.id;

        const employee = await prisma.employee.create({
            data: {
                userId: user.id,
                companyId: company.id,
                role: "EMPLOYEE",
                status: "ACTIVE",
                isActive: true,
                name: "Not Admin",
            },
        });
        workerEmployeeId = employee.id;

        const token = randomBytes(32).toString("hex");
        await prisma.session.create({
            data: {
                tokenHash: sha256Hex(token),
                employeeId: employee.id,
                companyId: company.id,
                expiresAt: new Date(Date.now() + 60_000),
            },
        });

        // Create a PENDING entry in same company
        const entry = await prisma.hourEntry.create({
            data: {
                companyId: company.id,
                employeeId: employee.id,
                projectId: null,
                workDate: new Date("2026-01-01"),
                fromTime: "08:00",
                toTime: "16:00",
                breakMinutes: 30,
                hoursNet: 7.5,
                hoursBrut: 7.5,
                description: "Forbidden approve attempt",
                status: "PENDING",
            },
        });
        entryId = entry.id;

        const req = new Request(`http://test/api/admin/hours/${entry.id}/approve`, {
            method: "POST",
            headers: {
                cookie: `${SESSION_COOKIE}=${token}`,
            },
        });

        const res = await POST(req as any, {
            params: Promise.resolve({ id: String(entry.id) }),
        });

        expect(res.status).toBe(403);
        expect(res.headers.get("x-request-id")).toBeTruthy();

        const body = await res.json();
        expect(body.ok).toBe(false);
        expect(body.error?.code).toBe("FORBIDDEN");

        // No status mutation
        const db = await prisma.hourEntry.findUnique({ where: { id: entry.id } });
        if (!db) throw new Error("Expected hourEntry to exist in DB");
        expect(db.status).toBe("PENDING");

        // No audit event
        const ev = await prisma.activityEvent.findFirst({
            where: {
                companyId: company.id,
                entityType: "HOUR_ENTRY",
                entityId: entry.id,
                eventType: "HOUR_APPROVED",
            },
        });
        expect(ev).toBeNull();
    });
    it("cross-tenant approve denied: Company B admin cannot approve Company A entry by id (no mutation, no activityEvent)", async () => {
        // Company A
        const companyA = await prisma.company.create({ data: { name: "Tenant A Approve Co" } });
        companyId = companyA.id;

        // Admin A (not used for request; exists only to match cleanup pattern if needed)
        const adminAUser = await prisma.user.create({
            data: { email: `adminA.approve+${Date.now()}@test.com`, passwordHash: "not-used" },
        });
        adminUserId = adminAUser.id;

        const adminAEmployee = await prisma.employee.create({
            data: {
                userId: adminAUser.id,
                companyId: companyA.id,
                role: "ADMIN",
                status: "ACTIVE",
                isActive: true,
                name: "Admin A",
            },
        });
        adminEmployeeId = adminAEmployee.id;

        // Worker A owns entry
        const workerAUser = await prisma.user.create({
            data: { email: `workerA.approve+${Date.now()}@test.com`, passwordHash: "not-used" },
        });
        workerUserId = workerAUser.id;

        const workerAEmployee = await prisma.employee.create({
            data: {
                userId: workerAUser.id,
                companyId: companyA.id,
                role: "EMPLOYEE",
                status: "ACTIVE",
                isActive: true,
                name: "Worker A",
            },
        });
        workerEmployeeId = workerAEmployee.id;

        const entryA = await prisma.hourEntry.create({
            data: {
                companyId: companyA.id,
                employeeId: workerAEmployee.id,
                projectId: null,
                workDate: new Date("2026-01-01"),
                fromTime: "08:00",
                toTime: "16:00",
                breakMinutes: 30,
                hoursNet: 7.5,
                hoursBrut: 7.5,
                description: "A pending",
                status: "PENDING",
            },
        });
        entryId = entryA.id;

        // Snapshot before
        const before = await prisma.hourEntry.findUnique({ where: { id: entryA.id } });
        if (!before) throw new Error("Expected entryA to exist");
        const auditBefore = await prisma.activityEvent.count({
            where: { companyId: companyA.id, entityType: "HOUR_ENTRY", entityId: entryA.id },
        });

        // Company B (attacker admin)
        const companyB = await prisma.company.create({ data: { name: "Tenant B Approve Co" } });
        companyIdB = companyB.id;

        const adminBUser = await prisma.user.create({
            data: { email: `adminB.approve+${Date.now()}@test.com`, passwordHash: "not-used" },
        });
        adminUserIdB = adminBUser.id;

        const adminBEmployee = await prisma.employee.create({
            data: {
                userId: adminBUser.id,
                companyId: companyB.id,
                role: "ADMIN",
                status: "ACTIVE",
                isActive: true,
                name: "Admin B",
            },
        });
        adminEmployeeIdB = adminBEmployee.id;

        const adminBToken = randomBytes(32).toString("hex");
        await prisma.session.create({
            data: {
                tokenHash: sha256Hex(adminBToken),
                employeeId: adminBEmployee.id,
                companyId: companyB.id,
                expiresAt: new Date(Date.now() + 60_000),
            },
        });

        // Attack: B tries to approve A's entry
        const req = new Request(`http://test/api/admin/hours/${entryA.id}/approve`, {
            method: "POST",
            headers: { cookie: `${SESSION_COOKIE}=${adminBToken}` },
        });

        const res = await POST(req as any, { params: Promise.resolve({ id: String(entryA.id) }) });

        expect([403, 404]).toContain(res.status);

        const requestId = res.headers.get("x-request-id");
        expect(requestId).toBeTruthy();

        const body = await res.json();
        expect(body.ok).toBe(false);
        expect(body.error?.requestId).toBe(requestId);

        // No mutation
        const after = await prisma.hourEntry.findUnique({ where: { id: entryA.id } });
        if (!after) throw new Error("Expected entryA to still exist");
        expect(after.status).toBe(before.status);

        // No audit event created for approve
        const auditAfter = await prisma.activityEvent.count({
            where: { companyId: companyA.id, entityType: "HOUR_ENTRY", entityId: entryA.id },
        });
        expect(auditAfter).toBe(auditBefore);

        const ev = await prisma.activityEvent.findFirst({
            where: {
                companyId: companyA.id,
                entityType: "HOUR_ENTRY",
                entityId: entryA.id,
                eventType: "HOUR_APPROVED",
            },
        });
        expect(ev).toBeNull();
    });

});
