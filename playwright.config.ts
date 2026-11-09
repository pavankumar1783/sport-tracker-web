import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against the real API through the Angular dev server's /api proxy.
 * Start the backend first in Development (https profile, https://localhost:7248) with
 * `Auth:Otp:FixedCode` set (for example "123456"; honoured only in Development), then:
 *   E2E_FIXED_CODE=123456 npx playwright test
 * The signed-in specs register real accounts (example.test emails) and create tournaments in the
 * database the API uses. Without E2E_FIXED_CODE only the read-only guest specs run.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: process.env['CI'] ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm start',
    url: 'http://localhost:4200',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
