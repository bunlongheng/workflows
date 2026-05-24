import { test, expect } from '@playwright/test';
import { installMocks } from './_mocks';

test.describe('Auth callback page', () => {
  test('renders the signing-in loader', async ({ page }) => {
    await installMocks(page);
    // Supabase client init may throw without env; the loader markup still renders.
    await page.goto('/auth/callback');
    await expect(page.getByText('Signing you in...')).toBeVisible();
  });
});
