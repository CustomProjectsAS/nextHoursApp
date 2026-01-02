import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pkg from "pg";

const { Pool } = pkg;

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const isProd = process.env.NODE_ENV === "production";

// Safer default: in production, require TLS with normal certificate verification.
// In dev/test, default to no SSL (local Postgres), unless DATABASE_URL demands otherwise.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProd ? true : undefined,
});


const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
