// NOTE: Legacy route. Use POST /api/admin/invite instead.

import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth";
import { okNext, failNext } from "@/lib/api/nextResponse";


export async function POST(req: Request) {

  const ctx = await getAuthContext(req);
  if (!ctx) {
    return failNext("AUTH_REQUIRED", "Unauthorized", 401);

  }
  if (ctx.role !== "ADMIN" && ctx.role !== "OWNER") {
    return failNext("FORBIDDEN", "Forbidden", 403);
  }
  return failNext(
    "BAD_REQUEST",
    "Legacy endpoint disabled. Use POST /api/admin/invite.",
    410,
  );

}
