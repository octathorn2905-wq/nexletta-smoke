import { defineConfig, devices } from '@playwright/test';
import { loadEnv } from './tests/helpers/env';

loadEnv();

const headed = process.env.SMOKE_HEADLESS !== '1';

export default defineConfig({
  testDir: './tests',
  timeout: 180_000,
  expect: { timeout: 25_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: false,
  outputDir: 'reports/artifacts',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'reports/playwright-html', open: 'never' }],
    ['./tests/reporters/stability-reporter.ts'],
  ],
  use: {
    headless: !headed,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 25_000,
    navigationTimeout: 45_000,
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
