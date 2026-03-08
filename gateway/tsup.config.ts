import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    external: ["react", "react-dom"],
    outDir: "dist",
  },
  {
    entry: { "server/index": "src/server/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    splitting: false,
    sourcemap: true,
    platform: "node",
    outDir: "dist",
  },
  // Types-only bundle (safe for server-side import — no React)
  {
    entry: { "types/index": "src/types-only.ts" },
    format: ["esm", "cjs"],
    dts: true,
    splitting: false,
    sourcemap: false,
    outDir: "dist",
  },
]);
