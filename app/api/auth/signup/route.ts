import { prisma } from "@/lib/prisma";
import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { rateLimit } from "@/lib/rateLimit";
import { okNext, failNext } from "@/lib/api/nextResponse";
import { withRequestId } from "@/lib/api/withRequestId";
import { log } from "@/lib/log";

const SESSION_COOKIE = "cph_session";
const SESSION_DAYS = 30;

function sha256Hex(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

function expiresAtDate() {
  return new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
}

export const POST = withRequestId(async (req, requestId) => {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      log.warn("SIGNUP_BAD_JSON", { requestId, path: "/api/auth/signup" });
      return failNext("BAD_REQUEST", "Invalid JSON body", 400, undefined, requestId);
    }

    const bodyObj = (body ?? {}) as Record<string, unknown>;

    const name = String(bodyObj.name ?? "").trim();
    const companyName = String(bodyObj.companyName ?? "").trim();
    const email = String(bodyObj.email ?? "").trim().toLowerCase();
    const password = String(bodyObj.password ?? "");

    const ipRaw =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";
    const ip = ipRaw.slice(0, 64);

    // IP-based: 10 signups / 15 minutes
    {
      const ipKey = `auth:signup:ip:${ip}`;
      const ipLimit = await rateLimit({ key: ipKey, windowSeconds: 900, limit: 10 });
      if (!ipLimit.ok) {
        log.warn("SIGNUP_RATE_LIMIT_IP", { requestId, path: "/api/auth/signup" });

        return failNext(
          "RATE_LIMIT",
          "Too many signups. Try again later.",
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

    // Email-based: 3 signups / 24h
    if (email) {
      const emailKey = `auth:signup:email:${sha256Hex(email).slice(0, 32)}`;
      const emailLimit = await rateLimit({
        key: emailKey,
        windowSeconds: 86400,
        limit: 3,
      });
      if (!emailLimit.ok) {
        log.warn("SIGNUP_RATE_LIMIT_EMAIL", { requestId, path: "/api/auth/signup" });

        return failNext(
          "RATE_LIMIT",
          "Too many signups. Try again later.",
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

    if (!companyName || companyName.length < 2) {
      return failNext("BAD_REQUEST", "Company name is required", 400, undefined, requestId);
    }

    if (!name || name.length < 2) {
      return failNext("BAD_REQUEST", "Name is required", 400, undefined, requestId);
    }

    if (!email || !email.includes("@")) {
      return failNext("BAD_REQUEST", "Valid email is required", 400, undefined, requestId);
    }

    if (!password || password.length < 8) {
      return failNext(
        "BAD_REQUEST",
        "Password must be at least 8 characters",
        400,
        undefined,
        requestId,
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      return failNext("BAD_REQUEST", "Email already exists", 409, undefined, requestId);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const expiresAt = expiresAtDate();

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email, passwordHash },
        select: { id: true },
      });

      const company = await tx.company.create({
        data: { name: companyName },
      });

      const employee = await tx.employee.create({
        data: {
          name,
          email,
          passwordHash,
          userId: user.id,
          companyId: company.id,
          status: "ACTIVE",
          role: "OWNER",
          onboardedAt: new Date(),
          lastLoginAt: new Date(),
          isActive: true,
        },
      });

      const rawToken = randomBytes(32).toString("hex");
      const tokenHash = sha256Hex(rawToken);

      await tx.session.create({
        data: {
          tokenHash,
          employeeId: employee.id,
          companyId: company.id,
          expiresAt,
        },
      });

      return { company, employee, rawToken };
    });

  

    const res = okNext(
      {
        user: {
          employeeId: result.employee.id,
          companyId: result.company.id,
          role: result.employee.role,
          name: result.employee.name,
          companyName: result.company.name,
        },
      },
      undefined,
      requestId,
    );

    res.cookies.set(SESSION_COOKIE, result.rawToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DAYS * 24 * 60 * 60,
    });

    log.info("SIGNUP_OK", {
      requestId,
      path: "/api/auth/signup",
      employeeId: result.employee.id,
      companyId: result.company.id,
    });

    return res;
  } catch (err: unknown) {
    // Best-effort prisma unique constraint handling (do not rely on `any`)
    if (err instanceof Error && err.message.includes("P2002")) {
      return failNext("BAD_REQUEST", "Email already exists", 409, undefined, requestId);
    }

    log.error("SIGNUP_FAILED", { requestId, path: "/api/auth/signup", err });
    return failNext("INTERNAL", "Internal server error", 500, undefined, requestId);
  }
});
