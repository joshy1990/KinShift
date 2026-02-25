import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration for KinShift web build.
 *
 * Expo's web target is served by `npx expo start --web` (port 8081 by default).
 * For CI, use `npx expo export:web` and serve the static build instead.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  timeout: 30_000,

  use: {
    baseURL: 'http://localhost:8081',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],

  /* Start Expo web dev server before tests (optional — comment out for CI) */
  // webServer: {
  //   command: 'npx expo start --web --port 8081',
  //   url: 'http://localhost:8081',
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 60_000,
  // },
});
