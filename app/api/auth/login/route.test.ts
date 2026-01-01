import { describe, it, expect, afterEach } from "vitest";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { POST } from "./route";


describe("POST /api/auth/login — HAPPY PATH (single company)", () => {
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


  it("returns 200, sets session cookie, and returns user payload", async () => {
    // --- Arrange (minimal fixture) ---
    const password = "correct-password";
    const passwordHash = await bcrypt.hash(password, 10);

    const company = await prisma.company.create({
      data: {
        name: "Test Company",
      },
    });
    createdCompanyId = company.id;

    const user = await prisma.user.create({
      data: {
        email: `login.success+${Date.now()}@test.com`,
        passwordHash,
      },
    });
    createdUserId = user.id;

    const employee = await prisma.employee.create({
      data: {
        userId: user.id,
        companyId: company.id,
        role: "EMPLOYEE",
        status: "ACTIVE",
        isActive: true,
        name: "Test Employee",
      },
    });
    createdEmployeeId = employee.id;

    // --- Act ---
    const req = new Request("http://test/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.email, password }),
    });
    const res = await POST(req);


    const text = await res.text();
    if (res.status !== 200) {
      console.log("login status:", res.status);
      console.log("login body:", text);
    }
    const body = JSON.parse(text);

    // --- Assert: HTTP + headers ---
    expect(res.status).toBe(200);


    const requestId = res.headers.get("x-request-id");
    expect(requestId).toBeTruthy();

    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toContain("cph_session=");

    // --- Assert: body ---
    expect(body).toEqual({
      ok: true,
      data: {
        user: {
          employeeId: employee.id,
          companyId: company.id,
          role: "EMPLOYEE",
          name: "Test Employee",
          companyName: "Test Company",
        },
      },
    });

  });
  it("returns 401 INVALID_CREDENTIALS and does not set session cookie (wrong password)", async () => {
    // --- Arrange (minimal fixture) ---
    const correctPassword = "correct-password";
    const wrongPassword = "wrong-password";
    const passwordHash = await bcrypt.hash(correctPassword, 10);

    const company = await prisma.company.create({
      data: { name: "Test Company" },
    });
    createdCompanyId = company.id;

    const user = await prisma.user.create({
      data: {
        email: "wrong-pass@test.com",
        passwordHash,
      },
    });
    createdUserId = user.id;

    const employee = await prisma.employee.create({
      data: {
        userId: user.id,
        companyId: company.id,
        role: "EMPLOYEE",
        status: "ACTIVE",
        isActive: true,
        name: "Test Employee",
      },
    });
    createdEmployeeId = employee.id;

    // --- Act ---
    const req = new Request("http://test/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.email, password: wrongPassword }),
    });
    const res = await POST(req);

    const text = await res.text();
    const body = JSON.parse(text);

    // --- Assert: HTTP + headers ---
    expect(res.status).toBe(401);
    const requestId = res.headers.get("x-request-id");
    expect(requestId).toBeTruthy();

    const setCookie = res.headers.get("set-cookie");
    expect(setCookie ?? "").not.toContain("cph_session=");

    // --- Assert: body ---
    expect(body.ok).toBe(false);
    expect(body.error?.code).toBe("INVALID_CREDENTIALS");
    expect(body.error?.requestId).toBe(requestId);
  });
  it("returns 401 INVALID_CREDENTIALS and does not set session cookie (unknown email)", async () => {
    // --- Arrange ---
    const password = "any-password";

    // --- Act ---
    const req = new Request("http://test/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `no-such-user+${Date.now()}@test.com`,
        password,
      }),
    });
    const res = await POST(req);


    const text = await res.text();
    const body = JSON.parse(text);

    // --- Assert: HTTP + headers ---
    expect(res.status).toBe(401);

    const requestId = res.headers.get("x-request-id");
    expect(requestId).toBeTruthy();

    const setCookie = res.headers.get("set-cookie");
    expect(setCookie ?? "").not.toContain("cph_session=");

    // --- Assert: body ---
    expect(body.ok).toBe(false);
    expect(body.error?.code).toBe("INVALID_CREDENTIALS");
    expect(body.error?.requestId).toBe(requestId);
  });
  it("rate-limit (email) -> 429 RATE_LIMIT + Retry-After + requestId", async () => {
    const email = `rate-limit-email+${Date.now()}@test.com`;
    const password = "wrong-password";

    for (let i = 0; i < 11; i++) {
      const req = new Request("http://test/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const res = await POST(req);

      if (i < 10) {
        // unknown email path => INVALID_CREDENTIALS (still consumes attempts)
        expect(res.status).toBe(401);
      } else {
        expect(res.status).toBe(429);

        const requestId = res.headers.get("x-request-id");
        expect(requestId).toBeTruthy();

        const retryAfter = res.headers.get("Retry-After");
        expect(retryAfter).toBeTruthy();

        const text = await res.text();
        const body = JSON.parse(text);

        expect(body.ok).toBe(false);
        expect(body.error?.code).toBe("RATE_LIMIT");
        expect(body.error?.requestId).toBe(requestId);

        return; // stop once we hit the limiter
      }
    }

    throw new Error("Expected login email rate-limit to trigger on attempt #11");
  }, 30_000);
});
