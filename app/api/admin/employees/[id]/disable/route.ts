import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth";
import { okNext, failNext } from "@/lib/api/nextResponse";
import { EmployeeStatus } from "@prisma/client";
import { getOrCreateRequestId } from "@/lib/requestId";
import { log } from "@/lib/log";


export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getOrCreateRequestId(req);
  const ctx = await getAuthContext(req);
  if (!ctx) {
    log.warn("AUTH_REQUIRED: admin/employees/[id]/disable POST", { requestId });
    return failNext("AUTH_REQUIRED", "Unauthorized", 401, undefined, requestId);
  }
  if (ctx.role !== "ADMIN" && ctx.role !== "OWNER") {
    log.warn("FORBIDDEN: admin/employees/[id]/disable POST", { requestId, role: ctx.role });
    return failNext("FORBIDDEN", "Forbidden", 403, undefined, requestId);
  }

  const { id: idParam } = await params;
  const employeeId = Number(idParam);
  if (!Number.isFinite(employeeId) || employeeId <= 0) {
    return failNext("VALIDATION", `Invalid id (got: ${idParam})`, 400, undefined, requestId);
  }



  try {
    // Only disable employees inside the same company
    const existing = await prisma.employee.findFirst({
      where: { id: employeeId, companyId: ctx.companyId },
      select: { id: true, status: true, isActive: true, email: true, name: true },
    });

    if (!existing) {
      return failNext("NOT_FOUND", "Employee not found", 404, undefined, requestId);
    }



    // Do not allow disabling yourself (simple safety rule)
    if (existing.id === ctx.employeeId) {
      log.warn("FORBIDDEN: self-disable attempt", {
        requestId,
        employeeId: existing.id,
      });
      return failNext(
        "FORBIDDEN",
        "You cannot disable your own account",
        400,
        undefined,
        requestId
      );
    }



    if (existing.status === EmployeeStatus.DISABLED || existing.isActive === false) {
      return okNext({ alreadyDisabled: true }, undefined, requestId);
    }



    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.employee.update({
        where: { id: existing.id },
        data: {
          status: EmployeeStatus.DISABLED,
          isActive: false,
        },
        select: { id: true, email: true, name: true, status: true, isActive: true },
      });

      await tx.activityEvent.create({
        data: {
          companyId: ctx.companyId,
          actorType: "EMPLOYEE",
          actorId: ctx.employeeId,
          actorName: ctx.name ?? null,
          entityType: "EMPLOYEE",
          entityId: updated.id,
          eventType: "EMPLOYEE_DISABLED",
          summary: `Disabled employee #${updated.id}`,
          meta: {
            prevStatus: existing.status,
            nextStatus: updated.status,
            prevIsActive: existing.isActive,
            nextIsActive: updated.isActive,
          },
        },
      });

      return updated;
    });

        return okNext({ employee: result }, undefined, requestId);

  } catch (err: any) {
    log.error("INTERNAL: admin/employees/[id]/disable POST", {
      requestId,
      errorName: err?.name,
      errorMessage: err?.message,
    });
    return failNext("INTERNAL", "Internal error", 500, undefined, requestId);
  }
}
