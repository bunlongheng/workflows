import { test, expect } from '@playwright/test';
import { installMocks } from './_mocks';

// Connections are managed from the desktop builder's integration sidebar.
test.use({ viewport: { width: 1280, height: 800 } });

test.describe('Connections panel', () => {
  test('shows connected account details for a focused connected integration', async ({ page }) => {
    await installMocks(page);
    await page.goto('/automations/new');

    await page.getByRole('button', { name: 'Use YouTube' }).click();
    await expect(page.getByRole('heading', { name: 'YouTube' })).toBeVisible();
    // Focused-detail account row + the youtube.readonly scope chip.
    await expect(page.getByText('My Channel').first()).toBeVisible();
    await expect(page.getByText('youtube.readonly').first()).toBeVisible();
  });

  test('Disconnect on a connected integration sends DELETE and flips to Connect', async ({ page }) => {
    const mocks = await installMocks(page);
    await page.goto('/automations/new');

    await page.getByRole('button', { name: 'Use YouTube' }).click();
    await page.getByRole('button', { name: 'Disconnect' }).click();

    await expect.poll(() => mocks.find('/api/connections', 'DELETE')?.body).toMatchObject({ integrationId: 'youtube' });
    // Now a Connect button is shown for YouTube in the focused panel.
    await expect(page.getByRole('button', { name: 'Connect YouTube' })).toBeVisible();
  });

  test('Connect on a non-OAuth integration POSTs and flips to Disconnect', async ({ page }) => {
    const mocks = await installMocks(page);
    await page.goto('/automations/new');

    // Hue is non-OAuth (DB-connect path), and not in the mocked connections.
    // Open the panel via the sidebar card (a div[role=button]).
    await page.getByRole('button', { name: 'Connect Philips Hue' }).click();
    await expect(page.getByRole('heading', { name: 'Philips Hue' })).toBeVisible();
    // The panel's own <button> (full-width) triggers the connect POST.
    await page.locator('button', { hasText: 'Connect Philips Hue' }).click();

    await expect.poll(() => mocks.find('/api/connections', 'POST')?.body).toMatchObject({ integrationId: 'hue' });
    await expect(page.getByRole('button', { name: 'Disconnect' })).toBeVisible();
  });

  test('Done button closes the panel', async ({ page }) => {
    await installMocks(page);
    await page.goto('/automations/new');

    await page.getByRole('button', { name: 'Use Gmail' }).click();
    await expect(page.getByRole('heading', { name: 'Gmail' })).toBeVisible();
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByRole('heading', { name: 'Gmail' })).toHaveCount(0);
  });
});
