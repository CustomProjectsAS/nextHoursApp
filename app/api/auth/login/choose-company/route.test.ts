import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { createLoginChallenge } from "@/lib/auth";
import { POST } from "./route";


describe("POST /api/auth/login/choose-company — happy path", () => {
    // scoped cleanup IDs to avoid cross-test nuking
    let companyId: number | null = null;
    let userId: number | null = null;
    let employeeId: number | null = null;




    afterEach(async () => {
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
    });

    it("returns 200, sets session cookie, and returns user payload", async () => {
        const prevSecret = process.env.AUTH_SECRET;
        process.env.AUTH_SECRET =
            "9f6c7c7a0bbd4f0f9e0f2d6a4c9b1f3a8d7c6b5a4e3d2c1b0a9f8e7d6c5b4a3";

        // --- Arrange (minimal fixture) ---
        const company = await prisma.company.create({
            data: { name: "ChooseCo Test Co" },
        });
        companyId = company.id;

        const user = await prisma.user.create({
            data: {
                email: `chooseco.test+${Date.now()}@test.com`,
                passwordHash: "not-used-here",
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
                name: "ChooseCo Employee",
            },
        });
        employeeId = employee.id;

        const challengeToken = createLoginChallenge({
            email: user.email,
            employeeIds: [employee.id],
            ttlMinutes: 5,
        });

        // --- Act ---
        const req = new Request("http://test/api/auth/login/choose-company", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                challengeToken,
                companyId: company.id,
            }),
        });

        const res = await POST(req);

        const text = await res.text();
        if (res.status !== 200) {
            console.log("choose-company status:", res.status);
            console.log("choose-company body:", text);
        }
        const body = JSON.parse(text);


        // --- Assert ---
        expect(res.status).toBe(200);

        const requestId = res.headers.get("x-request-id");
        expect(requestId).toBeTruthy();

        const setCookie = res.headers.get("set-cookie");
        expect(setCookie).toContain("cph_session=");

        expect(body).toEqual({
            ok: true,
            data: {
                user: {
                    employeeId: employee.id,
                    companyId: company.id,
                    role: "EMPLOYEE",
                    name: "ChooseCo Employee",
                    companyName: "ChooseCo Test Co",
                },
            },
        });
        process.env.AUTH_SECRET = prevSecret;

    });
    it("rate-limit (IP+token) -> 429 RATE_LIMIT + requestId + Retry-After + no DB side effects", async () => {
        const prevSecret = process.env.AUTH_SECRET;
        process.env.AUTH_SECRET =
            "9f6c7c7a0bbd4f0f9e0f2d6a4c9b1f3a8d7c6b5a4e3d2c1b0a9f8e7d6c5b4a3";

        // Arrange
        const company = await prisma.company.create({ data: { name: "ChooseCo RateLimit Co" } });
        companyId = company.id;

        const user = await prisma.user.create({
            data: {
                email: `chooseco.ratelimit+${Date.now()}@test.com`,
                passwordHash: "not-used-here",
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
                name: "ChooseCo Employee",
            },
        });
        employeeId = employee.id;

        const challengeToken = createLoginChallenge({
            email: user.email,
            employeeIds: [employee.id],
            ttlMinutes: 5,
        });

        // Fixed IP so limiter key is deterministic
        const ip = "203.0.113.10";

        // Use an INVALID companyId so route never creates sessions/events during warmup
        const invalidCompanyId = company.id + 999999;

        // Warm up: 20 attempts (limit is 20)
        for (let i = 0; i < 20; i++) {
            const req = new Request("http://test/api/auth/login/choose-company", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-forwarded-for": ip,
                },
                body: JSON.stringify({
                    challengeToken,
                    companyId: invalidCompanyId,
                }),
            });

            const res = await POST(req as any);
            // invalid selection should be 400 until limiter trips
            expect(res.status).toBe(400);
        }

        // Snapshot BEFORE 429 attempt
        const before = {
            sessions: await prisma.session.count(),
            events: await prisma.activityEvent.count(),
            employee: await prisma.employee.findUnique({
                where: { id: employee.id },
                select: { lastLoginAt: true },
            }),
        };

        // 21st -> rate limited
        const req429 = new Request("http://test/api/auth/login/choose-company", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-forwarded-for": ip,
            },
            body: JSON.stringify({
                challengeToken,
                companyId: invalidCompanyId,
            }),
        });

        const res429 = await POST(req429 as any);
        expect(res429.status).toBe(429);

        const requestId = res429.headers.get("x-request-id");
        expect(requestId).toBeTruthy();

        const retryAfter = res429.headers.get("Retry-After");
        expect(retryAfter).toBeTruthy();

        const body = await res429.json();
        expect(body.ok).toBe(false);
        expect(body.error?.code).toBe("RATE_LIMIT");
        expect(body.error?.requestId).toBe(requestId);

        // Snapshot AFTER 429 attempt
        const after = {
            sessions: await prisma.session.count(),
            events: await prisma.activityEvent.count(),
            employee: await prisma.employee.findUnique({
                where: { id: employee.id },
                select: { lastLoginAt: true },
            }),
        };

        expect(after).toEqual(before);

        process.env.AUTH_SECRET = prevSecret;
    });

});
