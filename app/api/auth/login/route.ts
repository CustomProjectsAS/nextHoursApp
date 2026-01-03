import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { randomBytes, createHash } from "crypto";
import { createLoginChallenge } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import { okNext, failNext } from "@/lib/api/nextResponse";
import { withRequestId } from "@/lib/api/withRequestId";
import { log } from "@/lib/log";
import { setSessionCookie, SESSION_DAYS } from "@/lib/auth";

// Used to equalize timing when user is not found (prevents email enumeration via timing)
const DUMMY_PASSWORD_HASH =
  "$2a$10$CwTycUXWue0Thq9StjUM0uJ8JvK6Jp2cR3sZkJQZK0r8Qk5t5l9e2"; // bcrypt hash of "dummy-password"

function sha256Hex(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

function newSessionToken() {
  return randomBytes(32).toString("hex"); // store ONLY hash in DB
}

export const POST = withRequestId(async (req, requestId) => {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      log.warn("LOGIN_BAD_JSON", { requestId, path: "/api/auth/login" });
      return failNext("BAD_REQUEST", "Invalid JSON body", 400, undefined, requestId);
    }

    const bodyObj = (body ?? {}) as Record<string, unknown>;

    const emailRaw = String(bodyObj.email ?? "").trim().toLowerCase();
    const password = String(bodyObj.password ?? "");

    const ipRaw =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";
    const ip = ipRaw.slice(0, 64);

    if (!emailRaw || !password) {
      log.warn("LOGIN_MISSING_FIELDS", { requestId, path: "/api/auth/login" });
      return failNext("BAD_REQUEST", "Email and password are required", 400, undefined, requestId);
    }

    // Email-based: 10 attempts / 5 minutes
    {
      const emailKey = `auth:login:email:${sha256Hex(emailRaw).slice(0, 32)}`;
      const emailLimit = await rateLimit({
        key: emailKey,
        windowSeconds: 300,
        limit: 10,
      });

      if (!emailLimit.ok) {
        log.warn("LOGIN_RATE_LIMIT_EMAIL", { requestId, path: "/api/auth/login" });

        return failNext(
          "RATE_LIMIT",
          "Too many attempts. Try again later.",
          429,
          {
            headers: {
              "Retry-After": String(
                Math.ceil((emailLimit.resetAt.getTime() - Date.now()) / 1000),
              ),
            },
          },
          requestId,
        );
      }
    }

    // IP-based: 20 attempts / 5 minutes
    {
      const ipKey = `auth:login:ip:${ip}`;
      const ipLimit = await rateLimit({
        key: ipKey,
        windowSeconds: 300,
        limit: 20,
      });

      if (!ipLimit.ok) {
        log.warn("LOGIN_RATE_LIMIT_IP", { requestId, path: "/api/auth/login" });

        return failNext(
          "RATE_LIMIT",
          "Too many attempts. Try again later.",
          429,
          {
            headers: {
              "Retry-After": String(
                Math.ceil((ipLimit.resetAt.getTime() - Date.now()) / 1000),
              ),
            },
          },
          requestId,
        );
      }
    }

    // 1) Authenticate against global User (email is unique)
    const user = await prisma.user.findUnique({
      where: { email: emailRaw },
      select: { id: true, passwordHash: true },
    });

    if (!user) {
      // comparable work even when user doesn't exist (timing hardening)
      await bcrypt.compare(password, DUMMY_PASSWORD_HASH);

      log.warn("LOGIN_INVALID_CREDENTIALS", { requestId, path: "/api/auth/login" });
      return failNext("INVALID_CREDENTIALS", "Invalid credentials", 401, undefined, requestId);
    }

    const passOk = await bcrypt.compare(password, user.passwordHash);
    if (!passOk) {
      log.warn("LOGIN_INVALID_CREDENTIALS", { requestId, path: "/api/auth/login" });
      return failNext("INVALID_CREDENTIALS", "Invalid credentials", 401, undefined, requestId);
    }

    // 2) Load company memberships (Employees) for this User
    const matches = await prisma.employee.findMany({
      where: {
        userId: user.id,
        isActive: true,
        status: "ACTIVE",
        companyId: { not: null },
      },
      include: { company: true },
      take: 5,
    });

    if (matches.length === 0) {
      log.warn("LOGIN_NO_MATCHES", { requestId, path: "/api/auth/login" });
      return failNext("INVALID_CREDENTIALS", "Invalid credentials", 401, undefined, requestId);
    }

    // If user belongs to multiple companies, return challenge (NO session yet)
    if (matches.length > 1) {
      const challengeToken = createLoginChallenge({
        email: emailRaw,
        employeeIds: matches.map((e) => e.id),
        ttlMinutes: 5,
      });

      log.info("LOGIN_NEEDS_COMPANY_PICK", {
        requestId,
        path: "/api/auth/login",
        companiesCount: matches.length,
      });

      return okNext(
        {
          needsCompanyPick: true,
          challengeToken,
          companies: matches.map((e) => ({
            companyId: e.companyId!,
            companyName: e.company?.name ?? "—",
          })),
        },
        undefined,
        requestId,
      );
    }

    const employee = matches[0];

    const token = newSessionToken();
    const tokenHash = sha256Hex(token);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);

    await prisma.session.create({
      data: {
        tokenHash,
        employeeId: employee.id,
        companyId: employee.companyId!,
        expiresAt,
        lastUsedAt: now,
      },
    });

    await prisma.employee.update({
      where: { id: employee.id },
      data: { lastLoginAt: now },
    });

    const actorType =
      employee.role === "OWNER" ? "OWNER" : employee.role === "ADMIN" ? "ADMIN" : "EMPLOYEE";

    await prisma.activityEvent.create({
      data: {
        companyId: employee.companyId!,
        actorType,
        actorId: employee.id,
        actorName: employee.name ?? null,
        entityType: "AUTH",
        entityId: null,
        eventType: "LOGIN",
        summary: `Login: employee #${employee.id}`,
        meta: {
          companyId: employee.companyId!,
          requestId,
        },
      },
    });

    const res = okNext(
      {
        user: {
          employeeId: employee.id,
          companyId: employee.companyId!,
          role: employee.role,
          name: employee.name,
          companyName: employee.company?.name ?? "",
        },
      },
      undefined,
      requestId,
    );

    setSessionCookie(res, token);

    log.info("LOGIN_OK", {
      requestId,
      path: "/api/auth/login",
      employeeId: employee.id,
      companyId: employee.companyId!,
      role: employee.role,
    });

    return res;
  } catch (err: unknown) {
    log.error("LOGIN_FAILED", { requestId, path: "/api/auth/login", err });
    return failNext("INTERNAL", "Internal server error", 500, undefined, requestId);
  }
});
