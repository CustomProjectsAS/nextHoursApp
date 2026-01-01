import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import dotenv from "dotenv";

dotenv.config({ path: ".env.test" });

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["**/*.test.ts"],

    // Deterministic DB tests (no parallel mutation)
    fileParallelism: false,
    sequence: {
      concurrent: false,
    },

    pool: "forks",
  },
});
