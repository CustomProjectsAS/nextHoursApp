import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth";
import { okNext, failNext } from "@/lib/api/nextResponse";
import { getOrCreateRequestId } from "@/lib/requestId";
import { log } from "@/lib/log";

export async function GET(req: Request) {
  const requestId = getOrCreateRequestId(req);

  try {
    const ctx = await getAuthContext(req);
    if (!ctx) {
      log.warn("AUTH_REQUIRED: admin/dashboard", { requestId });
      return failNext("AUTH_REQUIRED", "Unauthorized", 401, undefined, requestId);

    }

    if (ctx.role !== "ADMIN" && ctx.role !== "OWNER") {
      log.warn("FORBIDDEN: admin/dashboard", { requestId, role: ctx.role });
      return failNext("FORBIDDEN", "Forbidden", 403, undefined, requestId);

    }

    const companyId = ctx.companyId;

    const [
      hoursPendingCount,
      hoursRejectedCount,
      activeEmployeesCount,
      activeProjectsCount,
    ] = await Promise.all([
      prisma.hourEntry.count({
        where: { companyId, deletedAt: null, status: "PENDING" },
      }),
      prisma.hourEntry.count({
        where: { companyId, deletedAt: null, status: "REJECTED" },
      }),
      prisma.employee.count({
        where: { companyId, isActive: true, status: "ACTIVE" },
      }),
      prisma.project.count({
        where: { companyId, isActive: true },
      }),
    ]);

    return okNext(
      {
        hoursPendingCount,
        hoursRejectedCount,
        activeEmployeesCount,
        activeProjectsCount,
      },
      undefined,
      requestId
    );


  } catch (err: any) {
    log.error("INTERNAL: admin/dashboard", {
      requestId,
      errorName: err?.name,
      errorMessage: err?.message,
    });
    return failNext("INTERNAL", "Internal error", 500, undefined, requestId);

  }
}

