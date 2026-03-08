const { defineConfig } = require("vitest/config");

module.exports = defineConfig({
  test: {
    environment: "node",
    globals: true,
    server: {
      deps: {
        inline: [/pinata\/src\/.*/],
      },
    },
  },
});
