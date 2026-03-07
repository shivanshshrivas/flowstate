import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "src/routes/**/*.test.ts",
      "src/queue/**/*.test.ts",
      "src/ws/**/*.test.ts",
      "src/cron/**/*.test.ts",
    ],
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      include: [
        "src/routes/**",
        "src/queue/**",
        "src/ws/**",
        "src/cron/**",
      ],
    },
  },
});
