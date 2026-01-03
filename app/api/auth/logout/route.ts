import { prisma } from "@/lib/prisma";
import { createHash } from "crypto";
import { okNext } from "@/lib/api/nextResponse";
import { withRequestId } from "@/lib/api/withRequestId";
import { log } from "@/lib/log";
import { SESSION_COOKIE, clearSessionCookie } from "@/lib/auth";

function sha256Hex(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

function parseCookie(cookieHeader: string, name: string) {
  const parts = cookieHeader.split(";").map((p) => p.trim());
  const match = parts.find((p) => p.startsWith(name + "="));
  if (!match) return null;
  const value = match.slice(name.length + 1);
  return value ? decodeURIComponent(value) : null;
}

export const POST = withRequestId(async (req, requestId) => {
  try {
    const cookieHeader = req.headers.get("cookie") ?? "";
    const token = parseCookie(cookieHeader, SESSION_COOKIE);

    // Always return ok:true (logout should be idempotent)
    const res = okNext({}, undefined, requestId);

    // Clear cookie no matter what
    clearSessionCookie(res);

    if (!token) {
      log.info("LOGOUT_NO_TOKEN", { requestId, path: "/api/auth/logout" });
      return res;
    }

    const tokenHash = sha256Hex(token);
    const now = new Date();

    const revoked = await prisma.session.updateMany({
      where: {
        tokenHash,
        revokedAt: null,
      },
      data: {
        revokedAt: now,
        lastUsedAt: now,
      },
    });

    if (revoked.count === 0) {
      log.info("LOGOUT_NOTHING_TO_REVOKE", { requestId, path: "/api/auth/logout" });
      return res;
    }

    log.info("LOGOUT_REVOKED", {
      requestId,
      path: "/api/auth/logout",
      revokedCount: revoked.count,
    });

    // Log only if we actually revoked an active session
    const sessionForLog = await prisma.session.findFirst({
      where: { tokenHash },
      include: { employee: true },
      orderBy: { id: "desc" },
    });

    if (!sessionForLog) return res;

    const actorType =
      sessionForLog.employee.role === "OWNER"
        ? "OWNER"
        : sessionForLog.employee.role === "ADMIN"
          ? "ADMIN"
          : "EMPLOYEE";

    await prisma.activityEvent.create({
      data: {
        companyId: sessionForLog.companyId,
        actorType,
        actorId: sessionForLog.employeeId,
        actorName: sessionForLog.employee.name ?? null,
        entityType: "AUTH",
        entityId: null,
        eventType: "LOGOUT",
        summary: `Logout: employee #${sessionForLog.employeeId}`,
        meta: {
          companyId: sessionForLog.companyId,
          requestId,
        },
      },
    });

    return res;
  } catch (err: unknown) {
    log.error("LOGOUT_FAILED", { requestId, path: "/api/auth/logout", err });

    // Still clear cookie even if DB update failed
    const res = okNext({}, undefined, requestId);
    clearSessionCookie(res);

    return res;
  }
});
