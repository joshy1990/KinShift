/**
 * E2E tests — Auth flow (Web)
 *
 * Tests the login and signup screens rendered by Expo web.
 * Requires `npx expo start --web` running on port 8081.
 */

import { test, expect } from '@playwright/test';

test.describe('Auth Flow', () => {
  test('login page renders correctly', async ({ page }) => {
    await page.goto('/');

    // Should see the login screen or auth screen
    await expect(
      page.getByText(/sign in|log in|welcome/i).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('displays email and password inputs', async ({ page }) => {
    await page.goto('/');

    // Wait for form to render
    await page.waitForTimeout(3000);

    // Look for email/password inputs
    const emailInput = page.getByPlaceholder(/email/i).first();
    const passwordInput = page.getByPlaceholder(/password/i).first();

    await expect(emailInput).toBeVisible({ timeout: 10_000 });
    await expect(passwordInput).toBeVisible();
  });

  test('shows validation error on empty submit', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(3000);

    // Find and click sign in button
    const signInButton = page.getByRole('button', { name: /sign in/i }).first();
    if (await signInButton.isVisible()) {
      await signInButton.click();

      // Should show some validation error
      await expect(
        page.getByText(/required|invalid|enter|please/i).first(),
      ).toBeVisible({ timeout: 5_000 });
    }
  });

  test('navigate to signup screen', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(3000);

    // Look for "Sign Up" or "Create Account" link/button
    const signUpLink = page.getByText(/sign up|create account|register/i).first();
    if (await signUpLink.isVisible()) {
      await signUpLink.click();

      // Should show signup form
      await expect(
        page.getByText(/create|sign up|register/i).first(),
      ).toBeVisible({ timeout: 5_000 });
    }
  });

  test('navigate to forgot password', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(3000);

    const forgotLink = page.getByText(/forgot/i).first();
    if (await forgotLink.isVisible()) {
      await forgotLink.click();

      await expect(
        page.getByText(/reset|forgot|recover/i).first(),
      ).toBeVisible({ timeout: 5_000 });
    }
  });
});
