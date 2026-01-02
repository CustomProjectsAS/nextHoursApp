import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { POST } from "./route";
import { EmployeeStatus } from "@prisma/client";

async function resetDb() {
    // FK order matters
    await prisma.session.deleteMany();
    await prisma.activityEvent.deleteMany();
    await prisma.employee.deleteMany();
    await prisma.user.deleteMany();
    await prisma.company.deleteMany();
    await prisma.rateLimitBucket.deleteMany();
}

describe("POST /api/auth/signup", () => {
    beforeEach(async () => {
        await resetDb();
    });

    afterAll(async () => {
        await resetDb();
        await prisma.$disconnect();
    });

    it("happy path -> 200 ok, creates company + employee + user, sets session cookie, includes requestId", async () => {
        const req = new Request("http://localhost/api/auth/signup", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                companyName: "SignupCo",
                name: "Founder",
                email: "founder@test.no",
                password: "very-strong-password",
            }),
        });

        const res = await POST(req);

        expect(res.status).toBe(200);
        expect(res.headers.get("x-request-id")).toBeTruthy();

        const json = await res.json();
        expect(json.ok).toBe(true);
        expect(json.data?.user).toBeTruthy();
        expect(json.data.user).toMatchObject({
            companyName: "SignupCo",
            name: "Founder",
            role: "OWNER",
        });
        expect(typeof json.data.user.companyId).toBe("number");
        expect(typeof json.data.user.employeeId).toBe("number");


        const setCookie = res.headers.get("set-cookie");
        expect(setCookie).toBeTruthy();
        expect(setCookie).toContain("cph_session=");

        const company = await prisma.company.findFirst({
            where: { name: "SignupCo" },
        });
        expect(company).toBeTruthy();

        const employee = await prisma.employee.findFirst({
            where: { email: "founder@test.no" },
        });
        expect(employee).toBeTruthy();
        expect(employee?.status).toBe(EmployeeStatus.ACTIVE);

        const user = await prisma.user.findUnique({
            where: { email: "founder@test.no" },
        });
        expect(user).toBeTruthy();
    });

    it("duplicate email -> 409 + BAD_REQUEST + error.requestId", async () => {

        await prisma.company.create({
            data: {
                name: "ExistingCo",
                employees: {
                    create: {
                        name: "Existing",
                        email: "dup@test.no",
                        status: EmployeeStatus.ACTIVE,
                        passwordHash: "x",
                        user: {
                            create: {
                                email: "dup@test.no",
                                passwordHash: "x",
                            },
                        },
                    },
                },
            },
        });

        const req = new Request("http://localhost/api/auth/signup", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                companyName: "NewCo",
                name: "Someone",
                email: "dup@test.no",
                password: "very-strong-password",
            }),
        });

        const res = await POST(req);
        expect(res.status).toBe(409);
        expect(res.headers.get("x-request-id")).toBeTruthy();

        const json = await res.json();
        expect(json.ok).toBe(false);
        expect(json.error?.code).toBe("BAD_REQUEST");
        expect(typeof json.error?.requestId).toBe("string");
    });

    it("rate limit exceeded (IP) -> 429 RATE_LIMIT + Retry-After + requestId", async () => {
        const base = {
            companyName: "SpamCo",
            name: "Spammer",
            password: "very-strong-password",
        };




        // Signup route limits by IP: 10 signups / 15 minutes.
        // Keep IP constant, vary email to avoid duplicate-email and email/day limiter.
        for (let i = 0; i < 11; i++) {
            const req = new Request("http://localhost/api/auth/signup", {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "x-forwarded-for": "203.0.113.10",
                },
                body: JSON.stringify({
                    ...base,
                    companyName: `SpamCo-${i}`,
                    email: `spam+${i}@test.no`,
                }),
            });

            const res = await POST(req);

            if (i < 10) {
                expect(res.status).toBe(200);
            } else {
                const before429 = {
                    users: await prisma.user.count(),
                    companies: await prisma.company.count(),
                    employees: await prisma.employee.count(),
                    sessions: await prisma.session.count(),
                };

                expect(res.status).toBe(429);
                expect(res.headers.get("Retry-After")).toBeTruthy();
                expect(res.headers.get("x-request-id")).toBeTruthy();

                const json = await res.json();
                expect(json.ok).toBe(false);
                expect(json.error?.code).toBe("RATE_LIMIT");
                expect(typeof json.error?.requestId).toBe("string");
                expect(json.error.requestId.length).toBeGreaterThan(0);
                const after = {
                    users: await prisma.user.count(),
                    companies: await prisma.company.count(),
                    employees: await prisma.employee.count(),
                    sessions: await prisma.session.count(),
                };

                expect(after).toEqual(before429);

            }
        }

    }, 30_000);
});
