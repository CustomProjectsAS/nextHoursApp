import { describe, it, expect, vi } from "vitest";
import { log } from "./log";

describe("log redaction", () => {
  it("redacts known sensitive keys in context", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});

    log.info("TEST", {
      password: "secret123",
      token: "abc",
      authorization: "Bearer xyz",
      nested: {
        sessionToken: "sess",
        ok: "value",
      },
    });

    expect(spy).toHaveBeenCalledTimes(1);

    const output = spy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);

    expect(parsed.ctx.password).toBe("[REDACTED]");
    expect(parsed.ctx.token).toBe("[REDACTED]");
    expect(parsed.ctx.authorization).toBe("[REDACTED]");
    expect(parsed.ctx.nested.sessionToken).toBe("[REDACTED]");
    expect(parsed.ctx.nested.ok).toBe("value");

    spy.mockRestore();
  });
});
