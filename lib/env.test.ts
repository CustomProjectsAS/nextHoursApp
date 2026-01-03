import { describe, it, expect, beforeEach, vi } from "vitest";

describe("env validation", () => {
  beforeEach(() => {
    // Ensure env.ts re-evaluates per test
    vi.resetModules();
  });

  it("throws when DATABASE_URL is missing", async () => {
    const prevDb = process.env.DATABASE_URL;
    const prevSecret = process.env.AUTH_SECRET;

    delete process.env.DATABASE_URL;
    process.env.AUTH_SECRET = "test-secret";

    await expect(import("./env")).rejects.toThrowError(/ENV_MISSING: DATABASE_URL/);

    if (prevDb !== undefined) process.env.DATABASE_URL = prevDb;
    else delete process.env.DATABASE_URL;

    if (prevSecret !== undefined) process.env.AUTH_SECRET = prevSecret;
    else delete process.env.AUTH_SECRET;
  });

  it("throws when AUTH_SECRET is missing", async () => {
    const prevDb = process.env.DATABASE_URL;
    const prevSecret = process.env.AUTH_SECRET;

    process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/db";
    delete process.env.AUTH_SECRET;

    // IMPORTANT: bust module cache by importing with a query
    await expect(import("./env")).rejects.toThrowError(/ENV_MISSING: AUTH_SECRET/);

    if (prevDb !== undefined) process.env.DATABASE_URL = prevDb;
    else delete process.env.DATABASE_URL;

    if (prevSecret !== undefined) process.env.AUTH_SECRET = prevSecret;
    else delete process.env.AUTH_SECRET;
  });
});

