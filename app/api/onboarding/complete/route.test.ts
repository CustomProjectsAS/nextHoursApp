import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { POST } from "./route";
import { createHash } from "crypto";
import { EmployeeStatus } from "@prisma/client";

function sha256Hex(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

async function resetDb() {
  // Order matters because of FKs
  await prisma.session.deleteMany();
  await prisma.activityEvent.deleteMany();
  await prisma.hourEntry.deleteMany();
  await prisma.project.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.user.deleteMany();
  await prisma.authEvent.deleteMany();
  await prisma.rateLimitBucket.deleteMany();
  await prisma.company.deleteMany();
}

describe("POST /api/onboarding/complete", () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  it("happy path -> 200 ok, sets session cookie, includes x-request-id", async () => {
    const company = await prisma.company.create({
      data: { name: "TestCo" },
      select: { id: true },
    });

    const token = "invite-token-happy";
    const inviteTokenHash = sha256Hex(token);

    const employee = await prisma.employee.create({
      data: {
        companyId: company.id,
        name: "Invited Person",
        email: "invited@test.no",
        status: EmployeeStatus.INVITED,
        inviteTokenHash,
        inviteExpiresAt: new Date(Date.now() + 60_000),
      },
      select: { id: true },
    });

    const req = new Request("http://localhost/api/onboarding/complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token,
        name: "Activated Person",
        password: "very-strong-password",
      }),
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("x-request-id")).toBeTruthy();

    const json = await res.json();
    expect(json).toEqual({ ok: true, data: {} });

    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toBeTruthy();
    expect(setCookie).toContain("cph_session=");

    const updated = await prisma.employee.findUnique({
      where: { id: employee.id },
      select: {
        status: true,
        inviteTokenHash: true,
        inviteExpiresAt: true,
        onboardedAt: true,
        lastLoginAt: true,
        userId: true,
      },
    });

    expect(updated?.status).toBe(EmployeeStatus.ACTIVE);
    expect(updated?.inviteTokenHash).toBeNull();
    expect(updated?.inviteExpiresAt).toBeNull();
    expect(updated?.onboardedAt).toBeTruthy();
    expect(updated?.lastLoginAt).toBeTruthy();
    expect(updated?.userId).toBeTruthy();
  });

  it("invalid token -> 404 NOT_FOUND + error.requestId + x-request-id", async () => {
    const req = new Request("http://localhost/api/onboarding/complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token: "definitely-not-a-real-invite",
        name: "Someone",
        password: "very-strong-password",
      }),
    });

    const res = await POST(req);

    expect(res.status).toBe(404);
    expect(res.headers.get("x-request-id")).toBeTruthy();

    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error?.code).toBe("NOT_FOUND");
    expect(typeof json.error?.requestId).toBe("string");
    expect(json.error.requestId.length).toBeGreaterThan(0);
  });

  it("expired token -> 400 BAD_REQUEST + error.requestId + x-request-id", async () => {
    const company = await prisma.company.create({
      data: { name: "TestCo" },
      select: { id: true },
    });

    const token = "invite-token-expired";
    const inviteTokenHash = sha256Hex(token);

    await prisma.employee.create({
      data: {
        companyId: company.id,
        name: "Invited Person",
        email: "expired@test.no",
        status: EmployeeStatus.INVITED,
        inviteTokenHash,
        inviteExpiresAt: new Date(Date.now() - 60_000),
      },
      select: { id: true },
    });

    const req = new Request("http://localhost/api/onboarding/complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token,
        name: "Someone",
        password: "very-strong-password",
      }),
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(res.headers.get("x-request-id")).toBeTruthy();

    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error?.code).toBe("BAD_REQUEST");
    expect(typeof json.error?.requestId).toBe("string");
    expect(json.error.requestId.length).toBeGreaterThan(0);
  });

    it("already active -> 400 BAD_REQUEST (invite no longer valid) + requestId", async () => {
    const company = await prisma.company.create({
      data: { name: "TestCo" },
      select: { id: true },
    });

    const token = "invite-token-already-active";
    const inviteTokenHash = sha256Hex(token);

    // Employee is already ACTIVE, but token hash still exists (simulates reuse)
    await prisma.employee.create({
      data: {
        companyId: company.id,
        name: "Already Active",
        email: "active@test.no",
        status: EmployeeStatus.ACTIVE,
        inviteTokenHash,
        inviteExpiresAt: new Date(Date.now() + 60_000),
      },
      select: { id: true },
    });

    const req = new Request("http://localhost/api/onboarding/complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token,
        name: "DoesntMatter",
        password: "very-strong-password",
      }),
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(res.headers.get("x-request-id")).toBeTruthy();

    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error?.code).toBe("BAD_REQUEST");
    expect(json.error?.message).toBe("This invite is no longer valid");
    expect(typeof json.error?.requestId).toBe("string");
    expect(json.error.requestId.length).toBeGreaterThan(0);
  });

});
