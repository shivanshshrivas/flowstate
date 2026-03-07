import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      include: [
        "src/services/**",
        "src/routes/**",
        "src/queue/**",
        "src/ws/**",
        "src/cron/**",
      ],
    },
  },
});
