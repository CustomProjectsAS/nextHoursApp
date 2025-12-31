import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth";
import { okNext, failNext } from "@/lib/api/nextResponse";
import { getOrCreateRequestId } from "@/lib/requestId";
import { log } from "@/lib/log";


function parseMonth(month: string) {
  // Expect YYYY-MM
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return null;
  const year = Number(m[1]);
  const mon = Number(m[2]); // 1-12
  if (!Number.isFinite(year) || !Number.isFinite(mon) || mon < 1 || mon > 12) return null;

  const start = new Date(Date.UTC(year, mon - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, mon, 1, 0, 0, 0, 0));
  return { start, end, label: `${year}-${String(mon).padStart(2, "0")}` };
}

function normalizeStatus(s: string) {
  const x = String(s || "").trim().toUpperCase();
  if (x === "PENDING" || x === "APPROVED" || x === "REJECTED") return x;
  return null;
}

export async function GET(req: Request) {
  const requestId = getOrCreateRequestId(req);

  try {

    const ctx = await getAuthContext(req);

    if (!ctx) {
      log.warn("AUTH_REQUIRED: admin/hours", { requestId });
      return failNext("AUTH_REQUIRED", "Unauthorized", 401, undefined, requestId);
    }

    if (ctx.role !== "ADMIN" && ctx.role !== "OWNER") {
      log.warn("FORBIDDEN: admin/hours", { requestId, role: ctx.role });
      return failNext("FORBIDDEN", "Forbidden", 403, undefined, requestId);
    }

    const { searchParams } = new URL(req.url);

    const monthParam = String(searchParams.get("month") ?? "").trim();
    const parsed = parseMonth(monthParam);
    if (!parsed) {
      return failNext("VALIDATION", "month is required in YYYY-MM format", 400, undefined, requestId);
    }


    const employeeIdParam = searchParams.get("employeeId");
    const employeeId =
      employeeIdParam == null || employeeIdParam === ""
        ? null
        : Number(employeeIdParam);

    if (employeeIdParam != null && employeeIdParam !== "") {
      if (!Number.isFinite(employeeId!) || employeeId! <= 0) {
        return failNext("VALIDATION", "Invalid employeeId", 400, undefined, requestId);
      }
    }

    // If employeeId is provided, ensure it belongs to this company
    if (employeeId) {
      const exists = await prisma.employee.findFirst({
        where: { id: employeeId, companyId: ctx.companyId, isActive: true },
        select: { id: true },
      });

      if (!exists) {
        return failNext("VALIDATION", "Invalid employeeId", 400);

      }
    }


    const statusParam = searchParams.get("status");
    const status = statusParam ? normalizeStatus(statusParam) : null;
    if (statusParam && !status) {
      return failNext("VALIDATION", "Invalid status. Use PENDING|APPROVED|REJECTED", 400, undefined, requestId);
    }


    const where: any = {
      companyId: ctx.companyId,
      deletedAt: null,
      workDate: { gte: parsed.start, lt: parsed.end },
    };


    // default: pending+rejected
    if (status) {
      where.status = status;
    } else {
      where.status = { in: ["PENDING", "REJECTED"] };
    }

    // optional employee filter
    if (employeeId) {
      where.employeeId = employeeId;
    }

    const [entries, employees] = await Promise.all([
      prisma.hourEntry.findMany({
        where,
        orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
        include: {
          employee: { select: { id: true, name: true, role: true } },
          project: { select: { id: true, name: true, color: true } },
        },
      }),
      prisma.employee.findMany({
        where: { companyId: ctx.companyId, isActive: true, status: "ACTIVE" },
        select: { id: true, name: true, role: true, status: true, isActive: true },
        orderBy: { name: "asc" },
      }),
    ]);

    const totalNet = entries.reduce((sum, e) => sum + Number(e.hoursNet), 0);
    const totalBrut = entries.reduce(
      (sum, e) => sum + (e.hoursBrut == null ? 0 : Number(e.hoursBrut)),
      0,
    );

    return okNext(
      {
        month: parsed.label,
        filters: {
          employeeId: employeeId ?? null,
          status: status ?? "PENDING+REJECTED",
        },
        totals: {
          entriesCount: entries.length,
          totalNet,
          totalBrut,
        },
        employees,
        entries,
      },
      undefined,
      requestId
    );


    } catch (err: any) {
    log.error("INTERNAL: admin/hours", {
      requestId,
      errorName: err?.name,
      errorMessage: err?.message,
    });
    return failNext("INTERNAL", "Internal error", 500, undefined, requestId);
  }

}
