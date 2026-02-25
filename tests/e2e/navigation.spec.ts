/**
 * E2E tests — App navigation (Web)
 *
 * Smoke tests for main navigation when running via Expo web.
 */

import { test, expect } from '@playwright/test';

test.describe('App Navigation', () => {
  test('app loads without crashing', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBeLessThan(400);
  });

  test('page has a title', async ({ page }) => {
    await page.goto('/');
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });

  test('no console errors on initial load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForTimeout(5000);

    // Filter out known non-critical errors
    const criticalErrors = errors.filter(
      (e) =>
        !e.includes('Firebase') &&
        !e.includes('Sentry') &&
        !e.includes('net::') &&
        !e.includes('RevenueCat') &&
        !e.includes('AdMob'),
    );

    expect(criticalErrors).toHaveLength(0);
  });
});
