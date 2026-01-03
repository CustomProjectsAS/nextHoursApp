import { describe, it, expect, vi } from "vitest";
import { withRequestId } from "./withRequestId";
import { log } from "@/lib/log";

describe("withRequestId — unhandled error logging", () => {
  it("logs requestId + path + errorCode and does not leak secrets", async () => {
    const errorSpy = vi.spyOn(log, "error").mockImplementation(() => {});

    const throwingHandler = async () => {
      throw new Error("DB exploded");
    };

    const wrapped = withRequestId(throwingHandler);

    const req = new Request("http://test/api/onboarding/validate?token=SECRET_TOKEN", {
      headers: { "x-request-id": "test-request-id-123" },
    });

    const res = await wrapped(req);

    expect(res.status).toBe(500);
    expect(errorSpy).toHaveBeenCalledTimes(1);

    const [message, ctx] = errorSpy.mock.calls[0];

    expect(message).toBe("UNHANDLED_ROUTE_ERROR");

    expect(ctx).toMatchObject({
      requestId: "test-request-id-123",
      path: "/api/onboarding/validate",
    });

    // must not leak secrets
    const ctxString = JSON.stringify(ctx);
    expect(ctxString).not.toMatch(/SECRET_TOKEN/i);
    expect(ctxString).not.toMatch(/authorization/i);
    expect(ctxString).not.toMatch(/cookie/i);

    errorSpy.mockRestore();
  });
});
