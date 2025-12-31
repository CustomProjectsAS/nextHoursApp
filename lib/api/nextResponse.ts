import { NextResponse } from "next/server";

type ApiErrorCode =
  | "BAD_REQUEST"
  | "VALIDATION"
  | "AUTH_REQUIRED"
  | "FORBIDDEN"
  | "INVALID_CREDENTIALS"
  | "NOT_FOUND"
  | "RATE_LIMIT"
  | "INTERNAL";

export function okNext<T>(data: T, init?: ResponseInit, requestId?: string) {
  const headers = new Headers(init?.headers);
  if (requestId) headers.set("x-request-id", requestId);

  const body = { ok: true as const, data };
  return NextResponse.json(body, { ...(init ?? {}), headers });
}


export function failNext(
  code: ApiErrorCode,
  message: string,
  status: number,
  init?: ResponseInit,
  requestId?: string
) {
  const headers = new Headers(init?.headers);
  if (requestId) headers.set("x-request-id", requestId);

  const body = {
    ok: false as const,
    error: { code, message, ...(requestId ? { requestId } : {}) },
  };
  return NextResponse.json(body, { status, ...(init ?? {}), headers });
}

