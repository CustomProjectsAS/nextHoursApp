// lib/env.ts
type AppEnv = "development" | "test" | "production";

function required(name: string): string {
    const v = process.env[name];
    if (!v || v.trim().length === 0) {
        throw new Error(`ENV_MISSING: ${name}`);
    }
    return v;
}

function optional(name: string): string | undefined {
    const v = process.env[name];
    if (!v || v.trim().length === 0) return undefined;
    return v;
}

export const env = (() => {
    const nodeEnvRaw = optional("NODE_ENV") ?? "development";
    const nodeEnv = nodeEnvRaw as AppEnv;

    if (!["development", "test", "production"].includes(nodeEnv)) {
        throw new Error(`ENV_INVALID: NODE_ENV (got: ${nodeEnvRaw})`);
    }

    return {
        NODE_ENV: nodeEnv,
        DATABASE_URL: required("DATABASE_URL"),
        AUTH_SECRET: required("AUTH_SECRET"),

        // Optional runtime config (must still be centralized here to satisfy Gate 5.1)
        NEXT_PUBLIC_APP_URL: optional("NEXT_PUBLIC_APP_URL"),
        APP_URL: optional("APP_URL"),
        APP_VERSION: optional("APP_VERSION"),
    } as const;


})();
