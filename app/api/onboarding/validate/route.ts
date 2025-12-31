import { prisma } from "@/lib/prisma";
import { EmployeeStatus } from "@prisma/client";
import crypto from "crypto";
import { rateLimit } from "@/lib/rateLimit";
import { okNext, failNext } from "@/lib/api/nextResponse";
import { withRequestId } from "@/lib/api/withRequestId";
import { log } from "@/lib/log";

function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export const GET = withRequestId(async (req, requestId) => {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      log.warn("ONBOARDING_VALIDATE_MISSING_TOKEN", {
        requestId,
        path: "/api/onboarding/validate",
      });
      return failNext("BAD_REQUEST", "Missing token", 400, undefined, requestId);
    }

    // Safety: reject obviously invalid tokens to reduce brute force / DB load
    if (token.length < 20 || token.length > 200) {
      log.warn("ONBOARDING_VALIDATE_TOKEN_LENGTH_INVALID", {
        requestId,
        path: "/api/onboarding/validate",
      });
      return failNext("NOT_FOUND", "Invalid invite link", 404, undefined, requestId);
    }

    const rl = await rateLimit({
      key: `onboarding:validate:${sha256Hex(token).slice(0, 32)}`,
      windowSeconds: 300,
      limit: 20,
    });

    if (!rl.ok) {
      log.warn("ONBOARDING_VALIDATE_RATE_LIMIT", {
        requestId,
        path: "/api/onboarding/validate",
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

    const tokenHash = sha256Hex(token);

    const employee = await prisma.employee.findFirst({
      where: {
        inviteTokenHash: tokenHash,
      },
      include: {
        company: true,
      },
    });

    if (!employee) {
      log.warn("ONBOARDING_VALIDATE_NOT_FOUND", {
        requestId,
        path: "/api/onboarding/validate",
      });
      return failNext("NOT_FOUND", "Invalid invite link", 404, undefined, requestId);
    }

    if (employee.status !== EmployeeStatus.INVITED && employee.status !== EmployeeStatus.ACTIVE) {
      log.warn("ONBOARDING_VALIDATE_STATUS_INVALID", {
        requestId,
        path: "/api/onboarding/validate",
        status: employee.status,
      });
      return failNext(
        "BAD_REQUEST",
        "This link is no longer valid for this employee.",
        400,
        undefined,
        requestId,
      );
    }

    if (employee.inviteExpiresAt && employee.inviteExpiresAt.getTime() < Date.now()) {
      log.warn("ONBOARDING_VALIDATE_EXPIRED", {
        requestId,
        path: "/api/onboarding/validate",
      });
      return failNext("BAD_REQUEST", "Invite link has expired", 400, undefined, requestId);
    }

    log.info("ONBOARDING_VALIDATE_OK", {
      requestId,
      path: "/api/onboarding/validate",
      companyId: employee.companyId,
      employeeId: employee.id,
    });

    return okNext(
      {
        invite: {
          companyName: employee.company?.name ?? null,
          status: employee.status,
        },
      },
      undefined,
      requestId,
    );
  } catch (err: unknown) {
    log.error("ONBOARDING_VALIDATE_FAILED", {
      requestId,
      path: "/api/onboarding/validate",
      err,
    });
    return failNext("INTERNAL", "Internal server error", 500, undefined, requestId);
  }
});
