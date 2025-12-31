import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api/response";

export async function GET() {
  const version = process.env.APP_VERSION ?? "unknown";
  const timestamp = new Date().toISOString();

  try {
    await prisma.$queryRaw`SELECT 1`;

    return ok({
      version,
      db: { ok: true },
      timestamp,
    });
  } catch {
    return fail(
      "INTERNAL",
      "Service unavailable",
      503
    );
  }
}
