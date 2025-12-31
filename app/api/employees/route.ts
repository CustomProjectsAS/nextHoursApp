import { okNext, failNext } from "@/lib/api/nextResponse";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const ctx = await getAuthContext(req);
    if (!ctx) {
      return failNext("AUTH_REQUIRED", "Unauthorized", 401);

    }

    const employees = await prisma.employee.findMany({
      where: {
        companyId: ctx.companyId,
        isActive: true,
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, status: true },
    });

   return okNext({ employees });

  } catch (error) {
  console.error("[GET /api/employees] Error:", error);
  return failNext("INTERNAL", "Failed to load employees", 500);
}

}
