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
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => { });

        const req = new Request("http://localhost/api/projects", {
            method: "GET",
            headers: {}, // no cookie => unauth
        });

        const res = await GET(req);
        expect(res.status).toBe(401);

        expect(warnSpy).toHaveBeenCalled();

        const calls = warnSpy.mock.calls
            .map(c => c[0])
            .filter(v => typeof v === "string")
            .map(v => JSON.parse(v as string));

        const rec = calls.find(
            r => r.message === "AUTH_REQUIRED: projects GET"
        );

        expect(rec).toBeTruthy();


        expect(rec.level).toBe("warn");
        expect(rec.message).toContain("AUTH_REQUIRED");
        expect(rec.ctx).toBeTruthy();
        expect(rec.ctx.requestId).toBeTruthy();
        expect(rec.ctx.route).toBe("GET /api/projects");
        expect(rec.ctx.errorCode).toBe("AUTH_REQUIRED");
                const rawLines = warnSpy.mock.calls
            .map(c => c[0])
            .filter(v => typeof v === "string")
            .join("\n")
            .toLowerCase();

        // Gate 5.3: secrets must never appear in logs
        expect(rawLines).not.toContain("authorization");
        expect(rawLines).not.toContain("bearer ");
        expect(rawLines).not.toContain("cookie");
        expect(rawLines).not.toContain("set-cookie");
        expect(rawLines).not.toContain("invitetoken");
        expect(rawLines).not.toContain("access_token");
        expect(rawLines).not.toContain("refresh_token");
        expect(rawLines).not.toContain("id_token");
        expect(rawLines).not.toContain("client_secret");
        expect(rawLines).not.toContain("auth_secret");
        expect(rawLines).not.toContain("database_url");

    });
});
