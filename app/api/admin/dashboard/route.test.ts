import { describe, it, expect } from "vitest";
import { GET } from "./route";

describe("GET /api/admin/dashboard (unauthorized)", () => {
  it("returns 401 AUTH_REQUIRED and includes x-request-id + error.requestId", async () => {
    const req = new Request("http://localhost/api/admin/dashboard", {
      method: "GET",
    });

    const res = await GET(req);

    expect(res.status).toBe(401);

    const requestIdHeader = res.headers.get("x-request-id");
    expect(requestIdHeader).toBeTruthy();

    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error?.code).toBe("AUTH_REQUIRED");
    expect(json.error?.requestId).toBe(requestIdHeader);
  });
});
