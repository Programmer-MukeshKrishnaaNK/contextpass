import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` throws outside a React Server environment; tests run server code directly.
      "server-only": fileURLToPath(new URL("./src/lib/server/__tests__/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["supabase/tests/**/*.test.ts", "src/**/*.test.ts"],
    testTimeout: 30_000,
  },
});
