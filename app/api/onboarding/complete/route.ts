import { prisma } from "@/lib/prisma";
import { EmployeeStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes, createHash } from "crypto";
import { rateLimit } from "@/lib/rateLimit";
import { okNext, failNext } from "@/lib/api/nextResponse";
import { withRequestId } from "@/lib/api/withRequestId";
import { log } from "@/lib/log";
import { env } from "@/lib/env";


const SESSION_COOKIE = "cph_session";
const SESSION_DAYS = 30;

function sha256Hex(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

function newSessionToken() {
  return randomBytes(32).toString("hex"); // store ONLY hash in DB
}

function cleanName(input: unknown) {
  if (typeof input !== "string") return null;
  const name = input.trim();
  if (name.length < 2) return null;
  if (name.length > 80) return name.slice(0, 80);
  return name;
}

function cleanPassword(input: unknown) {
  if (typeof input !== "string") return null;
  const pw = input.trim();
  if (pw.length < 10) return null; // V1 baseline; tighten later if needed
  if (pw.length > 200) return pw.slice(0, 200);
  return pw;
}

export const POST = withRequestId(async (req, requestId) => {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      log.warn("ONBOARDING_COMPLETE_BAD_JSON", {
        requestId,
        path: "/api/onboarding/complete",
      });
      return failNext("BAD_REQUEST", "Invalid JSON body", 400, undefined, requestId);
    }

    const bodyObj = (body ?? {}) as Record<string, unknown>;

    const token = typeof bodyObj.token === "string" ? bodyObj.token : null;
    const nameClean = cleanName(bodyObj.name);
    const passwordClean = cleanPassword(bodyObj.password);

    if (!token) {
      return failNext("BAD_REQUEST", "Missing token", 400, undefined, requestId);
    }

    const rl = await rateLimit({
      key: `onboarding:complete:${sha256Hex(token).slice(0, 32)}`,
      windowSeconds: 300,
      limit: 10,
    });

    if (!rl.ok) {
      log.warn("ONBOARDING_COMPLETE_RATE_LIMIT", {
        requestId,
        path: "/api/onboarding/complete",
      });

      return failNext(
        "RATE_LIMIT",
        "Too many attempts. Try again later.",
        429,
        {
          headers: {
            "Retry-After": String(
              Math.ceil((rl.resetAt.getTime() - Date.now()) / 1000),
            ),
          },
        },
        requestId,
      );
    }

    if (!passwordClean) {
      return failNext(
        "BAD_REQUEST",
        "Password must be at least 10 characters",
        400,
        undefined,
        requestId,
      );
    }

    const inviteTokenHash = sha256Hex(token);
    const employee = await prisma.employee.findFirst({
      where: {
        inviteTokenHash,
      },
      select: {
        id: true,
        companyId: true,
        name: true,
        email: true,
        status: true,
        inviteExpiresAt: true,
      },
    });

    if (!employee || !employee.companyId) {
      return failNext("NOT_FOUND", "Invalid invite token", 404, undefined, requestId);
    }

    if (employee.status !== EmployeeStatus.INVITED) {
      return failNext(
        "BAD_REQUEST",
        "This invite is no longer valid",
        400,
        undefined,
        requestId,
      );
    }

    if (employee.inviteExpiresAt && employee.inviteExpiresAt.getTime() < Date.now()) {
      return failNext("BAD_REQUEST", "Invite link has expired", 400, undefined, requestId);
    }

    const companyId = employee.companyId;
    const ua = req.headers.get("user-agent") ?? null;
    const ipRaw = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const ip = ipRaw ? ipRaw.slice(0, 64) : null;

    const tokenRaw = newSessionToken();
    const tokenHash = sha256Hex(tokenRaw);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);

    await prisma.$transaction(async (tx) => {
      const passwordHash = await bcrypt.hash(passwordClean, 12);

      const updated = await tx.employee.update({
        where: { id: employee.id },
        data: {
          name: nameClean ?? employee.name,
          passwordHash,
          status: EmployeeStatus.ACTIVE,
          onboardedAt: now,
          lastLoginAt: now,
          inviteTokenHash: null,
          inviteExpiresAt: null,
        },
        select: { id: true },
      });

      await tx.session.create({
        data: {
          tokenHash,
          employeeId: updated.id,
          companyId,
          expiresAt,
          lastUsedAt: now,
          ip,
          userAgent: ua,
        },
      });

      if (!employee.email) {
        throw new Error("ONBOARDING_INVARIANT_MISSING_EMAIL");
      }

      const user = await tx.user.upsert({
        where: { email: employee.email },
        create: { email: employee.email, passwordHash },
        update: { passwordHash },
        select: { id: true },
      });

      await tx.employee.update({
        where: { id: updated.id },
        data: { userId: user.id },
      });

      await tx.activityEvent.create({
        data: {
          companyId,
          actorType: "SYSTEM",
          actorId: null,
          actorName: "SYSTEM",
          entityType: "EMPLOYEE",
          entityId: updated.id,
          eventType: "EMPLOYEE_ACTIVATED",
          summary: `Employee activated via invite #${updated.id}`,
          meta: {
            via: "onboarding.complete",
            sessionCreated: true,
            requestId,
          },
        },
      });
    });

    log.info("ONBOARDING_COMPLETE_OK", {
      requestId,
      path: "/api/onboarding/complete",
      companyId,
      employeeId: employee.id,
    });

    const res = okNext({}, undefined, requestId);
    res.cookies.set(SESSION_COOKIE, tokenRaw, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DAYS * 24 * 60 * 60,
    });

    return res;
  } catch (err: unknown) {
    log.error("ONBOARDING_COMPLETE_FAILED", {
      requestId,
      path: "/api/onboarding/complete",
      err,
    });
    return failNext("INTERNAL", "Internal server error", 500, undefined, requestId);
  }
});
