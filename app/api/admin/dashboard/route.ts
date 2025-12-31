import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth";
import { okNext, failNext } from "@/lib/api/nextResponse";


export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext(req);
    if (!ctx) {
            return failNext("AUTH_REQUIRED", "Unauthorized", 401);
    }

    if (ctx.role !== "ADMIN" && ctx.role !== "OWNER") {
            return failNext("FORBIDDEN", "Forbidden", 403);
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

        return okNext({
      hoursPendingCount,
      hoursRejectedCount,
      activeEmployeesCount,
      activeProjectsCount,
    });

  } catch (err: any) {
    console.error("GET /api/admin/dashboard error:", err);
    return failNext("INTERNAL", "Internal error", 500);
  }
}
