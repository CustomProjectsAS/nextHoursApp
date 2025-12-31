// app/api/projects/route.ts
import { okNext, failNext } from "@/lib/api/nextResponse";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth";

export async function GET(req: Request) {
  const ctx = await getAuthContext(req);
  if (!ctx) {
    return failNext("AUTH_REQUIRED", "Unauthorized", 401);
  }

  try {
    const projects = await prisma.project.findMany({
      where: {
        companyId: ctx.companyId,
        isActive: true,
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        color: true,
      },
    });

        return okNext({ projects });

    } catch (error: any) {
    console.error("GET /api/projects error:", error);
    return failNext("INTERNAL", "Failed to load projects", 500);
  }

}

// Public creation is not allowed in SaaS (must be admin-scoped)
export async function POST() {
    return failNext("FORBIDDEN", "Forbidden", 403);

}
