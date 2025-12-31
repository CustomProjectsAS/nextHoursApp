// lib/requestId.ts
import { randomUUID } from "crypto";

export function getOrCreateRequestId(req: Request): string {
  // Prefer upstream-provided IDs (reverse proxy / load balancer), otherwise generate.
  const incoming =
    req.headers.get("x-request-id") ??
    req.headers.get("x-correlation-id") ??
    req.headers.get("x-amzn-trace-id");

  if (incoming && incoming.trim().length > 0) return incoming.trim();
  return randomUUID();
}
