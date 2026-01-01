import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { PATCH, DELETE } from "./route";
import { createHash, randomBytes } from "crypto";

const SESSION_COOKIE = "cph_session";

function sha256Hex(input: string) {
    return createHash("sha256").update(input).digest("hex");
}

describe("/api/employee/hours/[id] — employee happy paths", () => {

    let companyId: number | null = null;
    let userId: number | null = null;
    let employeeId: number | null = null;
    let entryId: number | null = null;

    afterEach(async () => {
        if (entryId) {
            await prisma.activityEvent
                .deleteMany({ where: { entityId: entryId } })
                .catch(() => { });
            await prisma.hourEntry
                .deleteMany({ where: { id: entryId } })
                .catch(() => { });
        }

        if (employeeId) {
            await prisma.session.deleteMany({ where: { employeeId } });
            await prisma.hourEntry.deleteMany({ where: { employeeId } });
            await prisma.employee.deleteMany({ where: { id: employeeId } });
        }

        if (userId) {
            await prisma.user.deleteMany({ where: { id: userId } });
        }

        if (companyId) {
            await prisma.company.deleteMany({ where: { id: companyId } });
        }

        companyId = null;
        userId = null;
        employeeId = null;
        entryId = null;
    });

    it("updates employee-owned entry and returns updated row (tenant-safe)", async () => {
        const company = await prisma.company.create({
            data: { name: "Hours Patch Co" },
        });
        companyId = company.id;

        const user = await prisma.user.create({
            data: {
                email: `hours.patch+${Date.now()}@test.com`,
                passwordHash: "not-used",
            },
        });
        userId = user.id;

        const employee = await prisma.employee.create({
            data: {
                userId: user.id,
                companyId: company.id,
                role: "EMPLOYEE",
                status: "ACTIVE",
                isActive: true,
                name: "Patch Employee",
            },
        });
        employeeId = employee.id;

        const token = randomBytes(32).toString("hex");
        await prisma.session.create({
            data: {
                tokenHash: sha256Hex(token),
                employeeId: employee.id,
                companyId: company.id,
                expiresAt: new Date(Date.now() + 60_000),
            },
        });

        const existing = await prisma.hourEntry.create({
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
                description: "Before",
                status: "PENDING",
            },
        });
        entryId = existing.id;

        const req = new Request(`http://test/api/employee/hours/${existing.id}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                cookie: `${SESSION_COOKIE}=${token}`,
            },
            body: JSON.stringify({
                description: "After",
                breakMinutes: 60,
            }),
        });

        const res = await PATCH(req as any, {
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
        expect(entry.employeeId).toBe(employee.id);
        expect(entry.description).toBe("After");
        expect(entry.breakMinutes).toBe(60);

        // 08:00–16:00 = 8h, break 60m => 7.0h (Decimal serialized to string)
        expect(entry.hoursNet).toBe("7");
        expect(entry.hoursBrut).toBe("7");

        const db = await prisma.hourEntry.findUnique({ where: { id: existing.id } });
        if (!db) throw new Error("Expected updated hourEntry to exist in DB");

        expect(db.description).toBe("After");
        expect(db.breakMinutes).toBe(60);
        expect(db.companyId).toBe(company.id);
        expect(db.employeeId).toBe(employee.id);
        expect(db.hoursNet.toString()).toBe("7");
        if (db.hoursBrut === null) {
            throw new Error("Expected hoursBrut to be computed, got null");
        }
        expect(db.hoursBrut.toString()).toBe("7");

    });
    it("deletes PENDING employee-owned entry (tenant-safe) -> { deleted: true } + requestId", async () => {
        const company = await prisma.company.create({
            data: { name: "Hours Delete Co" },
        });
        companyId = company.id;

        const user = await prisma.user.create({
            data: {
                email: `hours.delete+${Date.now()}@test.com`,
                passwordHash: "not-used",
            },
        });
        userId = user.id;

        const employee = await prisma.employee.create({
            data: {
                userId: user.id,
                companyId: company.id,
                role: "EMPLOYEE",
                status: "ACTIVE",
                isActive: true,
                name: "Delete Employee",
            },
        });
        employeeId = employee.id;

        const token = randomBytes(32).toString("hex");
        await prisma.session.create({
            data: {
                tokenHash: sha256Hex(token),
                employeeId: employee.id,
                companyId: company.id,
                expiresAt: new Date(Date.now() + 60_000),
            },
        });

        const existing = await prisma.hourEntry.create({
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
                description: "To delete",
                status: "PENDING",
            },
        });
        entryId = existing.id;

        const req = new Request(`http://test/api/employee/hours/${existing.id}`, {
            method: "DELETE",
            headers: {
                cookie: `${SESSION_COOKIE}=${token}`,
            },
        });

        const res = await DELETE(req as any, {
            params: Promise.resolve({ id: String(existing.id) }),
        });

        expect(res.status).toBe(200);

        const requestId = res.headers.get("x-request-id");
        expect(requestId).toBeTruthy();

        const body = await res.json();
        expect(body.ok).toBe(true);
        expect(body.data?.deleted).toBe(true);

        const db = await prisma.hourEntry.findUnique({ where: { id: existing.id } });
        expect(db).toBeNull();

        // prevent cleanup from trying to delete already-deleted row
        entryId = null;
    });

});

