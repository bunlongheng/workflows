import { defineConfig, devices } from '@playwright/test';

/**
 * E2E config. All backend `/api/**` calls are mocked in-test via page.route()
 * (see tests/e2e/_mocks.ts), so the dev server never needs live VPS/OAuth deps.
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  // Next.js dev compiles routes on-demand (single-threaded); running specs
  // serially keeps the dev server from choking under a parallel request storm.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3008',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3008/automations',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
