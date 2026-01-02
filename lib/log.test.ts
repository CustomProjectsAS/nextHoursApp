import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { log } from "./log";

function parseLastCall(spy: ReturnType<typeof vi.spyOn>) {
  expect(spy).toHaveBeenCalled();
  const arg = spy.mock.calls[0]?.[0];
  expect(typeof arg).toBe("string");
  return JSON.parse(arg as string);
}

describe("lib/log", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emits JSON with required top-level keys: ts, level, message, ctx", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    log.warn("hello", {
      requestId: "req_1",
      route: "GET /api/health",
      statusCode: 401,
    });

    const rec = parseLastCall(warnSpy);

    expect(rec).toHaveProperty("ts");
    expect(rec).toHaveProperty("level", "warn");
    expect(rec).toHaveProperty("message", "hello");
    expect(rec).toHaveProperty("ctx");
    expect(typeof rec.ctx).toBe("object");
  });

  it("redacts sensitive keys recursively", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    log.error("boom", {
      requestId: "req_2",
      route: "POST /api/auth/login",
      errorCode: "INVALID_CREDENTIALS",
      password: "secret",
      Authorization: "Bearer abc",
      headers: {
        cookie: "cph_session=RAW_TOKEN",
        "set-cookie": "cph_session=RAW_TOKEN",
      },
      nested: {
        inviteToken: "INVITE_RAW",
        token: "TOKEN_RAW",
      },
    });

    const rec = parseLastCall(errorSpy);

    expect(rec.ctx.password).toBe("[REDACTED]");
    expect(rec.ctx.Authorization).toBe("[REDACTED]");
    expect(rec.ctx.headers.cookie).toBe("[REDACTED]");
    expect(rec.ctx.headers["set-cookie"]).toBe("[REDACTED]");
    expect(rec.ctx.nested.inviteToken).toBe("[REDACTED]");
    expect(rec.ctx.nested.token).toBe("[REDACTED]");
  });
});
