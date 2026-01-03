import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { log } from "./log";

function lastConsoleArg(spy: any): string {
  expect(spy).toHaveBeenCalled();
  const calls = spy.mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  return calls[calls.length - 1][0];
}

describe("structured logging + redaction", () => {
  let infoSpy: any;
  let warnSpy: any;
  let errorSpy: any;
  let logSpy: any;

  beforeEach(() => {
    infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emits one JSON line with predictable schema (ctx always exists)", () => {
    log.info("hello");

    const raw = lastConsoleArg(infoSpy);
    const rec = JSON.parse(raw);

    expect(rec).toHaveProperty("ts");
    expect(typeof rec.ts).toBe("string");

    expect(rec).toMatchObject({
      level: "info",
      message: "hello",
    });

    expect(rec).toHaveProperty("ctx");
    expect(rec.ctx).toEqual({});
  });

  it("redacts known sensitive keys recursively (object nesting)", () => {
    log.warn("test", {
      password: "p@ss",
      token: "tok",
      sessionToken: "sess",
      inviteToken: "inv",
      authorization: "Bearer abc",
      cookie: "c=1",
      "set-cookie": "c=1; HttpOnly",
      nested: {
        passwordHash: "hash",
        ok: "safe",
      },
    });

    const raw = lastConsoleArg(warnSpy);
    const rec = JSON.parse(raw);

    expect(rec.ctx.password).toBe("[REDACTED]");
    expect(rec.ctx.token).toBe("[REDACTED]");
    expect(rec.ctx.sessionToken).toBe("[REDACTED]");
    expect(rec.ctx.inviteToken).toBe("[REDACTED]");
    expect(rec.ctx.authorization).toBe("[REDACTED]");
    expect(rec.ctx.cookie).toBe("[REDACTED]");
    expect(rec.ctx["set-cookie"]).toBe("[REDACTED]");

    expect(rec.ctx.nested.passwordHash).toBe("[REDACTED]");
    expect(rec.ctx.nested.ok).toBe("safe");
  });

  it("redacts inside arrays", () => {
    log.error("arr", {
      items: [
        { token: "tok1" },
        { ok: true, nested: { password: "p" } },
        "just-a-string",
      ],
    });

    const raw = lastConsoleArg(errorSpy);
    const rec = JSON.parse(raw);

    expect(rec.ctx.items[0].token).toBe("[REDACTED]");
    expect(rec.ctx.items[1].nested.password).toBe("[REDACTED]");
    expect(rec.ctx.items[2]).toBe("just-a-string");
  });

  it("MUST redact common secret key variants (this should drive Gate 5.3 hardening)", () => {
    log.debug("secrets", {
      secret: "s",
      AUTH_SECRET: "a",
      apiKey: "k",
      apikey: "k2",
      access_token: "at",
      refresh_token: "rt",
      id_token: "it",
      client_secret: "cs",
      privateKey: "pk",
      DATABASE_URL: "postgres://user:pass@host/db",
      headers: {
        Authorization: "Bearer xyz",
      },
    });

    const raw = lastConsoleArg(logSpy);
    const rec = JSON.parse(raw);

    expect(rec.ctx.secret).toBe("[REDACTED]");
    expect(rec.ctx.AUTH_SECRET).toBe("[REDACTED]");
    expect(rec.ctx.apiKey).toBe("[REDACTED]");
    expect(rec.ctx.apikey).toBe("[REDACTED]");
    expect(rec.ctx.access_token).toBe("[REDACTED]");
    expect(rec.ctx.refresh_token).toBe("[REDACTED]");
    expect(rec.ctx.id_token).toBe("[REDACTED]");
    expect(rec.ctx.client_secret).toBe("[REDACTED]");
    expect(rec.ctx.privateKey).toBe("[REDACTED]");
    expect(rec.ctx.DATABASE_URL).toBe("[REDACTED]");

    expect(rec.ctx.headers.Authorization).toBe("[REDACTED]");
  });
});
