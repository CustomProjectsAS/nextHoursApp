import { describe, it, expect } from "vitest";

describe("env validation", () => {
  it("throws when DATABASE_URL is missing", async () => {
    const prev = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;

    await expect(import("./env")).rejects.toThrowError(/ENV_MISSING: DATABASE_URL/);

    if (prev !== undefined) process.env.DATABASE_URL = prev;
  });
});
