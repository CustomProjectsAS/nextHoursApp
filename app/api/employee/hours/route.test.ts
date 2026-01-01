import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { POST } from "./route";
import { createHash, randomBytes } from "crypto";

const SESSION_COOKIE = "cph_session";

function sha256Hex(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

describe("POST /api/employee/hours — happy path", () => {
  let companyId: number | null = null;
  let userId: number | null = null;
  let employeeId: number | null = null;
  let sessionToken: string | null = null;

  afterEach(async () => {
    if (employeeId) {
      await prisma.activityEvent.deleteMany({ where: { actorId: employeeId } });
      await prisma.hourEntry.deleteMany({ where: { employeeId } });
      await prisma.session.deleteMany({ where: { employeeId } });
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
    sessionToken = null;
  });

  it("creates hour entry for authenticated employee (tenant-safe)", async () => {
    // --- Arrange: company + employee + session ---
    const company = await prisma.company.create({
      data: { name: "Hours HappyPath Co" },
    });
    companyId = company.id;

    const user = await prisma.user.create({
      data: {
        email: `hours.create+${Date.now()}@test.com`,
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
        name: "Hours Employee",
      },
    });
    employeeId = employee.id;

    const token = randomBytes(32).toString("hex");
    sessionToken = token;

    await prisma.session.create({
      data: {
        tokenHash: sha256Hex(token),
        employeeId: employee.id,
        companyId: company.id,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    // --- Act ---
    const req = new Request("http://test/api/employee/hours", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: `${SESSION_COOKIE}=${token}`,
      },
      body: JSON.stringify({
        date: "2026-01-01",
        fromTime: "08:00",
        toTime: "16:00",
        breakMinutes: 30,
        description: "Regular shift",
      }),
    });

    const res = await POST(req);
    const text = await res.text();
    const body = JSON.parse(text);

    // --- Assert: HTTP ---
    expect(res.status).toBe(200);

    const requestId = res.headers.get("x-request-id");
    expect(requestId).toBeTruthy();

    // --- Assert: body contract ---
    expect(body.ok).toBe(true);
    expect(body.data?.entry).toBeTruthy();

    const entry = body.data.entry;

    expect(entry.companyId).toBe(company.id);
    expect(entry.employeeId).toBe(employee.id);
    expect(entry.status).toBe("PENDING");
    expect(entry.hoursNet).toBe("7.5");

    // --- Assert: DB side-effect ---
    const dbEntry = await prisma.hourEntry.findUnique({
      where: { id: entry.id },
    });

    expect(dbEntry).not.toBeNull();
    expect(dbEntry!.companyId).toBe(company.id);
    expect(dbEntry!.employeeId).toBe(employee.id);
    expect(dbEntry!.hoursNet.toString()).toBe("7.5");

  });
});
