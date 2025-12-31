import { prisma } from "@/lib/prisma";

export type RateLimitResult = {
  ok: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
};

function windowStart(now: Date, windowSeconds: number) {
  const ms = windowSeconds * 1000;
  return new Date(Math.floor(now.getTime() / ms) * ms);
}

/**
 * DB-backed fixed-window rate limit.
 * - key should include route + dimension (ip/email/etc.)
 * - windowSeconds fixed bucket size (e.g. 60)
 * - limit max hits per window
 */
export async function rateLimit(params: {
  key: string;
  windowSeconds: number;
  limit: number;
}): Promise<RateLimitResult> {
  const now = new Date();
  const ws = windowStart(now, params.windowSeconds);
  const resetAt = new Date(ws.getTime() + params.windowSeconds * 1000);

  // atomic increment via upsert + increment
  const row = await prisma.rateLimitBucket.upsert({
    where: { key_windowStart: { key: params.key, windowStart: ws } },
    create: { key: params.key, windowStart: ws, count: 1 },
    update: { count: { increment: 1 } },
    select: { count: true },
  });

  const remaining = Math.max(0, params.limit - row.count);
  const ok = row.count <= params.limit;

  return { ok, limit: params.limit, remaining, resetAt };
}
