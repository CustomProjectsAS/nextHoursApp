import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "./route";

describe("Logging schema (API route): GET /api/projects", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emits warn log with ctx.requestId + ctx.route + errorCode on AUTH_REQUIRED", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const req = new Request("http://localhost/api/projects", {
      method: "GET",
      headers: {}, // no cookie => unauth
    });

    const res = await GET(req);
    expect(res.status).toBe(401);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const payload = warnSpy.mock.calls[0]?.[0];
    expect(typeof payload).toBe("string");

    const rec = JSON.parse(payload as string);

    expect(rec.level).toBe("warn");
    expect(rec.message).toContain("AUTH_REQUIRED");
    expect(rec.ctx).toBeTruthy();
    expect(rec.ctx.requestId).toBeTruthy();
    expect(rec.ctx.route).toBe("GET /api/projects");
    expect(rec.ctx.errorCode).toBe("AUTH_REQUIRED");
  });
});
