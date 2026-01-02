import { describe, it, expect, afterEach } from "vitest";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { POST } from "./route";


const SESSION_COOKIE = "cph_session";

function sha256Hex(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

describe("POST /api/auth/logout — happy path", () => {
  afterEach(async () => {
    await prisma.session.deleteMany();
    await prisma.hourEntry.deleteMany();
    await prisma.employee.deleteMany();
    await prisma.user.deleteMany();
    await prisma.company.deleteMany();
  });

  it("revokes session and clears cookie", async () => {
    // --- Arrange ---
    const password = "pw";
    const passwordHash = await bcrypt.hash(password, 10);

    const company = await prisma.company.create({
      data: { name: "Logout Test Co" },
    });

    const user = await prisma.user.create({
      data: {
        email: `logout.test+${Date.now()}@test.com`,
        passwordHash,
      },
    });

    const employee = await prisma.employee.create({
      data: {
        userId: user.id,
        companyId: company.id,
        role: "EMPLOYEE",
        status: "ACTIVE",
        isActive: true,
        name: "Logout User",
      },
    });

    const token = randomBytes(32).toString("hex");
    const tokenHash = sha256Hex(token);

    await prisma.session.create({
      data: {
        tokenHash,
        employeeId: employee.id,
        companyId: company.id,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    // --- Act ---
    const req = new Request("http://localhost/api/auth/logout", {
      method: "POST",
      headers: {
        cookie: `${SESSION_COOKIE}=${token}`,
      },
    });

    const res = await POST(req);


    // --- Assert: response ---
    expect(res.status).toBe(200);

    const requestId = res.headers.get("x-request-id");
    expect(requestId).toBeTruthy();

    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toContain(`${SESSION_COOKIE}=`);
    // session must be revoked (deleted) for this token
    const stillThere = await prisma.session.findFirst({
      where: { tokenHash },
    });
    expect(stillThere).toBeTruthy();
    expect(stillThere?.revokedAt).toBeTruthy();


    // cookie must be cleared (expires / max-age=0)
    expect(setCookie).toMatch(/Max-Age=0|Expires=/);


    const body = await res.json();
    expect(body).toEqual({ ok: true, data: {} });


  });
});
