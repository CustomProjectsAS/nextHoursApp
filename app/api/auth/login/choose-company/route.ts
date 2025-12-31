import { prisma } from "@/lib/prisma";
import { randomBytes, createHash } from "crypto";
import { verifyLoginChallenge } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import { okNext, failNext } from "@/lib/api/nextResponse";
import { withRequestId } from "@/lib/api/withRequestId";
import { log } from "@/lib/log";

const SESSION_COOKIE = "cph_session";
const SESSION_DAYS = 30;

function sha256Hex(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

function sessionExpiryDate() {
  return new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
}

export const POST = withRequestId(async (req, requestId) => {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      log.warn("CHOOSE_COMPANY_BAD_JSON", {
        requestId,
        path: "/api/auth/login/choose-company",
      });
      return failNext("BAD_REQUEST", "Invalid JSON body", 400, undefined, requestId);
    }

    const bodyObj = (body ?? {}) as Record<string, unknown>;
    const challengeToken = String(bodyObj.challengeToken ?? "");
    const companyId = Number(bodyObj.companyId);

    if (!challengeToken || Number.isNaN(companyId)) {
      log.warn("CHOOSE_COMPANY_MISSING_FIELDS", {
        requestId,
        path: "/api/auth/login/choose-company",
      });
      return failNext(
        "BAD_REQUEST",
        "challengeToken and companyId are required",
        400,
        undefined,
        requestId,
      );
    }

    const ipRaw =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";
    const ip = ipRaw.slice(0, 64);

    // IP-based: 20 attempts / 5 minutes (keyed by IP + token hash prefix)
    const tokenKey = sha256Hex(challengeToken).slice(0, 16);
    const ipKey = `auth:choose-company:ip:${sha256Hex(ip).slice(0, 32)}:t:${tokenKey}`;

    const ipLimit = await rateLimit({
      key: ipKey,
      windowSeconds: 300,
      limit: 20,
    });

    if (!ipLimit.ok) {
      log.warn("CHOOSE_COMPANY_RATE_LIMIT_IP", {
        requestId,
        path: "/api/auth/login/choose-company",
      });

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

    let payload: { employeeIds: number[] };
    try {
      payload = verifyLoginChallenge(challengeToken);
    } catch {
      log.warn("CHOOSE_COMPANY_INVALID_CHALLENGE", {
        requestId,
        path: "/api/auth/login/choose-company",
      });
      return failNext("BAD_REQUEST", "Invalid company selection", 400, undefined, requestId);
    }

    const employee = await prisma.employee.findFirst({
      where: {
        id: { in: payload.employeeIds },
        companyId,
        isActive: true,
        status: "ACTIVE",
      },
      include: { company: true },
    });

    if (!employee || !employee.companyId) {
      log.warn("CHOOSE_COMPANY_INVALID_SELECTION", {
        requestId,
        path: "/api/auth/login/choose-company",
      });
      return failNext("BAD_REQUEST", "Invalid company selection", 400, undefined, requestId);
    }

    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = sha256Hex(rawToken);
    const expiresAt = sessionExpiryDate();
    const now = new Date();

    await prisma.session.create({
      data: {
        tokenHash,
        employeeId: employee.id,
        companyId: employee.companyId,
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
        companyId: employee.companyId,
        actorType,
        actorId: employee.id,
        actorName: employee.name ?? null,
        entityType: "AUTH",
        entityId: null,
        eventType: "LOGIN",
        summary: `Login: employee #${employee.id} (choose-company)`,
        meta: {
          companyId: employee.companyId,
          requestId,
        },
      },
    });

    const res = okNext(
      {
        user: {
          employeeId: employee.id,
          companyId: employee.companyId,
          role: employee.role,
          name: employee.name,
          companyName: employee.company?.name ?? "—",
        },
      },
      undefined,
      requestId,
    );

    res.cookies.set(SESSION_COOKIE, rawToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DAYS * 24 * 60 * 60,
    });

    log.info("CHOOSE_COMPANY_OK", {
      requestId,
      path: "/api/auth/login/choose-company",
      employeeId: employee.id,
      companyId: employee.companyId,
      role: employee.role,
    });

    return res;
  } catch (err: unknown) {
    log.error("CHOOSE_COMPANY_FAILED", {
      requestId,
      path: "/api/auth/login/choose-company",
      err,
    });
    return failNext("INTERNAL", "Internal server error", 500, undefined, requestId);
  }
});
