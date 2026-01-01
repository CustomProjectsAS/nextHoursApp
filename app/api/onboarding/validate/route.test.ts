import { describe, it, expect, afterEach } from "vitest";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { GET } from "./route";

function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

describe("GET /api/onboarding/validate", () => {
  let createdCompanyId: number | null = null;
  let createdUserId: number | null = null;
  let createdEmployeeId: number | null = null;

  afterEach(async () => {
    if (createdEmployeeId) {
      await prisma.session.deleteMany({ where: { employeeId: createdEmployeeId } });
      await prisma.hourEntry.deleteMany({ where: { employeeId: createdEmployeeId } });
      await prisma.employee.deleteMany({ where: { id: createdEmployeeId } });
    }

    if (createdUserId) {
      await prisma.user.deleteMany({ where: { id: createdUserId } });
    }

    if (createdCompanyId) {
      await prisma.company.deleteMany({ where: { id: createdCompanyId } });
    }

    createdCompanyId = null;
    createdUserId = null;
    createdEmployeeId = null;
  });

  it("valid token → 200 ok + x-request-id, returns companyName + status", async () => {
    // --- Arrange ---
    const token = `valid-${crypto.randomUUID()}-${Date.now()}`; // length > 20
    const tokenHash = sha256Hex(token);

    const company = await prisma.company.create({
      data: { name: "Onboarding Test Co" },
    });
    createdCompanyId = company.id;

    const user = await prisma.user.create({
      data: {
        email: `onboarding.validate+${Date.now()}@test.com`,
        passwordHash: "x", // not used by validate, just satisfies schema
      },
    });
    createdUserId = user.id;

    const employee = await prisma.employee.create({
      data: {
        userId: user.id,
        companyId: company.id,
        role: "EMPLOYEE",
        status: "INVITED",
        isActive: true,
        name: "Invitee",
        inviteTokenHash: tokenHash,
        inviteExpiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1h in future
      },
    });
    createdEmployeeId = employee.id;

    // --- Act ---
    const req = new Request(`http://test/api/onboarding/validate?token=${encodeURIComponent(token)}`, {
      method: "GET",
    });

    const res = await GET(req);

    const text = await res.text();
    if (res.status !== 200) {
      console.log("validate status:", res.status);
      console.log("validate body:", text);
    }
    const body = JSON.parse(text);

    // --- Assert ---
    expect(res.status).toBe(200);

    const requestId = res.headers.get("x-request-id");
    expect(requestId).toBeTruthy();

    expect(body).toEqual({
      ok: true,
      data: {
        invite: {
          companyName: "Onboarding Test Co",
          status: "INVITED",
        },
      },
    });
  });

  it("expired token → 400 BAD_REQUEST + requestId", async () => {
    // --- Arrange ---
    const token = `expired-${crypto.randomUUID()}-${Date.now()}`; // length > 20
    const tokenHash = sha256Hex(token);

    const company = await prisma.company.create({
      data: { name: "Expired Co" },
    });
    createdCompanyId = company.id;

    const user = await prisma.user.create({
      data: {
        email: `onboarding.expired+${Date.now()}@test.com`,
        passwordHash: "x",
      },
    });
    createdUserId = user.id;

    const employee = await prisma.employee.create({
      data: {
        userId: user.id,
        companyId: company.id,
        role: "EMPLOYEE",
        status: "INVITED",
        isActive: true,
        name: "Expired Invitee",
        inviteTokenHash: tokenHash,
        inviteExpiresAt: new Date(Date.now() - 60 * 1000), // expired 1 min ago
      },
    });
    createdEmployeeId = employee.id;

    // --- Act ---
    const req = new Request(`http://test/api/onboarding/validate?token=${encodeURIComponent(token)}`, {
      method: "GET",
    });

    const res = await GET(req);

    const text = await res.text();
    if (res.status !== 400) {
      console.log("expired validate status:", res.status);
      console.log("expired validate body:", text);
    }
    const body = JSON.parse(text);

    // --- Assert ---
    expect(res.status).toBe(400);

    const requestId = res.headers.get("x-request-id");
    expect(requestId).toBeTruthy();

    expect(body).toEqual({
      ok: false,
      error: {
        code: "BAD_REQUEST",
        message: "Invite link has expired",
        requestId: expect.any(String),
      },
    });
  });

  it("invalid token (not in DB) → 404 NOT_FOUND + requestId", async () => {
    // --- Arrange ---
    const token = `missing-${crypto.randomUUID()}-${Date.now()}`; // length > 20, passes length guard

    // --- Act ---
    const req = new Request(
      `http://test/api/onboarding/validate?token=${encodeURIComponent(token)}`,
      { method: "GET" },
    );

    const res = await GET(req);

    const text = await res.text();
    if (res.status !== 404) {
      console.log("invalid validate status:", res.status);
      console.log("invalid validate body:", text);
    }
    const body = JSON.parse(text);

    // --- Assert ---
    expect(res.status).toBe(404);

    const requestId = res.headers.get("x-request-id");
    expect(requestId).toBeTruthy();

    expect(body).toEqual({
      ok: false,
      error: {
        code: "NOT_FOUND",
        message: "Invalid invite link",
        requestId: expect.any(String),
      },
    });
  });

  it("missing token → 400 BAD_REQUEST + requestId", async () => {
    // --- Act ---
    const req = new Request("http://test/api/onboarding/validate", {
      method: "GET",
    });

    const res = await GET(req);

    const text = await res.text();
    if (res.status !== 400) {
      console.log("missing token status:", res.status);
      console.log("missing token body:", text);
    }
    const body = JSON.parse(text);

    // --- Assert ---
    expect(res.status).toBe(400);

    const requestId = res.headers.get("x-request-id");
    expect(requestId).toBeTruthy();

    expect(body).toEqual({
      ok: false,
      error: {
        code: "BAD_REQUEST",
        message: "Missing token",
        requestId: expect.any(String),
      },
    });
  });

  it("token length invalid → 404 NOT_FOUND + requestId", async () => {
    // --- Arrange ---
    const token = "short-token"; // length < 20 triggers length guard

    // --- Act ---
    const req = new Request(
      `http://test/api/onboarding/validate?token=${encodeURIComponent(token)}`,
      { method: "GET" },
    );

    const res = await GET(req);

    const text = await res.text();
    if (res.status !== 404) {
      console.log("length invalid status:", res.status);
      console.log("length invalid body:", text);
    }
    const body = JSON.parse(text);

    // --- Assert ---
    expect(res.status).toBe(404);

    const requestId = res.headers.get("x-request-id");
    expect(requestId).toBeTruthy();

    expect(body).toEqual({
      ok: false,
      error: {
        code: "NOT_FOUND",
        message: "Invalid invite link",
        requestId: expect.any(String),
      },
    });
  });
});
