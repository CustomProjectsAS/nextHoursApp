// lib/api/response.ts
type ApiErrorCode =
  | "BAD_REQUEST"
  | "VALIDATION"
  | "AUTH_REQUIRED"
  | "FORBIDDEN"
  | "INVALID_CREDENTIALS"
  | "NOT_FOUND"
  | "RATE_LIMIT"
  | "INTERNAL";

export type ApiError = {
  code: ApiErrorCode;
  message: string;
  requestId?: string;
};

export type ApiOk<T> = {
  ok: true;
  data: T;
  requestId?: string;
};

export type ApiFail = {
  ok: false;
  error: ApiError;
};

export type ApiResponse<T> = ApiOk<T> | ApiFail;

export function ok<T>(data: T, init?: ResponseInit, requestId?: string) {
  const headers = new Headers(init?.headers);
  if (requestId) headers.set("x-request-id", requestId);

  const body: ApiOk<T> = { ok: true, data };
  return Response.json(body, { ...(init ?? {}), headers });
}


export function fail(
  code: ApiErrorCode,
  message: string,
  status: number,
  init?: ResponseInit,
  requestId?: string
) {
  const headers = new Headers(init?.headers);
  if (requestId) headers.set("x-request-id", requestId);

  const body: ApiFail = {
    ok: false,
    error: { code, message, ...(requestId ? { requestId } : {}) },
  };
  return Response.json(body, { status, ...(init ?? {}), headers });
}

