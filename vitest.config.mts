import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: [
      "__tests__/unit/**/*.test.ts",
      "__tests__/unit/**/*.test.tsx",
      "__tests__/integration/**/*.test.ts",
    ],
    env: {
      FIELD_ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      NEXTAUTH_SECRET: "test-secret-for-testing-only",
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        "postgresql://taskuser:taskpass@localhost:5433/taskmanagement_test",
    },
  },
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "."),
    },
  },
});
