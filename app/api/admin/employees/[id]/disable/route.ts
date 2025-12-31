import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth";
import { okNext, failNext } from "@/lib/api/nextResponse";
import { EmployeeStatus } from "@prisma/client";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext(req);
  if (!ctx) {
        return failNext("AUTH_REQUIRED", "Unauthorized", 401);

  }
  if (ctx.role !== "ADMIN" && ctx.role !== "OWNER") {
        return failNext("FORBIDDEN", "Forbidden", 403);
  }

  const { id: idParam } = await params;
  const employeeId = Number(idParam);
    if (!Number.isFinite(employeeId) || employeeId <= 0) {
    return failNext("VALIDATION", `Invalid id (got: ${idParam})`, 400);
  }


  try {
    // Only disable employees inside the same company
    const existing = await prisma.employee.findFirst({
      where: { id: employeeId, companyId: ctx.companyId },
      select: { id: true, status: true, isActive: true, email: true, name: true },
    });

        if (!existing) {
      return failNext("NOT_FOUND", "Employee not found", 404);
    }


    // Do not allow disabling yourself (simple safety rule)
       if (existing.id === ctx.employeeId) {
      return failNext("FORBIDDEN", "You cannot disable your own account", 400);
    }


        if (existing.status === EmployeeStatus.DISABLED || existing.isActive === false) {
      return okNext({ alreadyDisabled: true });
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

        return okNext({ employee: result });

    } catch (err: any) {
    console.error("POST /api/admin/employees/[id]/disable error:", err);
    return failNext("INTERNAL", "Internal error", 500);
  }

}
