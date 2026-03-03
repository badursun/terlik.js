import { defineConfig } from "vitest/config";

const isCI = !!process.env.CI;

export default defineConfig({
  test: {
    testTimeout: 30_000,
    include: ["tests/**/*.test.ts"],
    // CI runners (especially Node 18) run out of memory when multiple
    // workers compile regex patterns with coverage instrumentation.
    ...(isCI && {
      pool: "forks",
      poolOptions: { forks: { maxForks: 1, minForks: 1 } },
    }),
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "json-summary"],
      include: ["src/**/*.ts"],
      exclude: ["src/lang/*/config.ts"],
    },
  },
});
