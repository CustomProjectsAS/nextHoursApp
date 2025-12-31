import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth";
import { okNext, failNext } from "@/lib/api/nextResponse";

export async function GET(req: Request) {
  const ctx = await getAuthContext(req);
  if (!ctx) return failNext("AUTH_REQUIRED", "Unauthorized", 401);

  if (ctx.role !== "ADMIN" && ctx.role !== "OWNER") {
    return failNext("FORBIDDEN", "Forbidden", 403);
  }


  try {
    const projects = await prisma.project.findMany({
      where: { companyId: ctx.companyId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true, isActive: true, createdAt: true },
    });

    return okNext({ projects });

    } catch (err: any) {
    console.error("GET /api/admin/projects error:", err);
    return failNext("INTERNAL", "Failed to load projects", 500);
  }
}


export async function POST(req: Request) {
  const ctx = await getAuthContext(req);
  if (!ctx) return failNext("AUTH_REQUIRED", "Unauthorized", 401);

  if (ctx.role !== "ADMIN" && ctx.role !== "OWNER") {
  return failNext("FORBIDDEN", "Forbidden", 403);
}


  try {
    const body = await req.json();
    const nameRaw = String(body?.name ?? "").trim();
    const colorRaw = body?.color;

    if (!nameRaw || nameRaw.length < 2) {
      return failNext("VALIDATION", "Name is required", 400);

    }

    const project = await prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          companyId: ctx.companyId,
          name: nameRaw,
          color: typeof colorRaw === "string" ? colorRaw : null,
          isActive: true,
        },
        select: { id: true, name: true, color: true, isActive: true, createdAt: true },
      });

      await tx.activityEvent.create({
        data: {
          companyId: ctx.companyId,
          actorType: "EMPLOYEE",
          actorId: ctx.employeeId,
          actorName: ctx.name ?? null,
          entityType: "PROJECT",
          entityId: created.id,
          eventType: "PROJECT_CREATED",
          summary: `Created project #${created.id}`,
          meta: { name: created.name, color: created.color },
        },
      });

      return created;
    });

    return okNext({ project });

  
  } catch (err: any) {
    console.error("POST /api/admin/projects error:", err);
    if (err?.code === "P2002") {
      return failNext("BAD_REQUEST", "Project already exists", 409);
    }
    return failNext("INTERNAL", "Failed to create project", 500);
  }
}
