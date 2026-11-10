import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./__tests__/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "html",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  expect: { timeout: 10000 },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.CI
    ? {
        // output: standalone + monorepo tracing root → server at apps/web/ subpath
        command: "node .next/standalone/apps/web/server.js",
        url: "http://localhost:3000",
        reuseExistingServer: false,
        timeout: 120000,
        env: {
          PORT: "3000",
          HOSTNAME: "0.0.0.0",
          AUTH_TRUST_HOST: "true",
        },
      }
    : undefined,
});
