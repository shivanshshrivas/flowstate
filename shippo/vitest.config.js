import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    server: {
      deps: {
        // Force local source files through vite-node so vi.mock() intercepts CJS require()
        inline: [/src\//],
      },
    },
  },
});
