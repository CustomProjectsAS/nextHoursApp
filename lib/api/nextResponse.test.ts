import { describe, it, expect } from "vitest";
import { okNext, failNext } from "./nextResponse";

describe("okNext / failNext contract", () => {
  it("okNext returns { ok:true, data } without requestId in body", async () => {
    const res = okNext({ hello: "world" }, undefined, "test-request-id");

    const json = await res.json();
    expect(json).toEqual({
      ok: true,
      data: { hello: "world" },
    });

    expect(res.headers.get("x-request-id")).toBe("test-request-id");
  });

  it("failNext returns { ok:false, error:{ code, message, requestId } }", async () => {
    const res = failNext(
      "AUTH_REQUIRED",
      "Unauthorized",
      401,
      undefined,
      "test-request-id"
    );

    const json = await res.json();
    expect(json).toEqual({
      ok: false,
      error: {
        code: "AUTH_REQUIRED",
        message: "Unauthorized",
        requestId: "test-request-id",
      },
    });

    expect(res.headers.get("x-request-id")).toBe("test-request-id");
  });
});
