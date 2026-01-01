import { okNext, failNext } from "@/lib/api/nextResponse";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth";
import { getOrCreateRequestId } from "@/lib/requestId";
import { log } from "@/lib/log";


export async function GET(req: Request) {
  const requestId = getOrCreateRequestId(req);

  try {
    const ctx = await getAuthContext(req);

    if (!ctx) {
      log.warn("AUTH_REQUIRED: employees GET", { requestId });
      return failNext("AUTH_REQUIRED", "Unauthorized", 401, undefined, requestId);

    }

    const employees = await prisma.employee.findMany({
      where: {
        companyId: ctx.companyId,
        isActive: true,
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, status: true },
    });

    return okNext({ employees }, undefined, requestId);

    } catch (error: any) {
    log.error("INTERNAL: employees GET", {
      requestId,
      errorName: error?.name,
      errorMessage: error?.message,
    });
    return failNext("INTERNAL", "Failed to load employees", 500, undefined, requestId);
  }
}