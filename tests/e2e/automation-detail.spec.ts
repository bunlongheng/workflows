import { test, expect } from '@playwright/test';
import {
  installMocks,
  AUTO_YT,
  AUTO_HUE,
  AUTO_GMAIL_MANUAL,
  LOGS_HUE,
} from './_mocks';

test.describe('Automation detail - header / hero', () => {
  test('renders name, flow description and config chips', async ({ page }) => {
    await installMocks(page);
    await page.goto(`/automations/${AUTO_HUE.id}`);

    await expect(page.getByRole('heading', { name: 'Gmail -> Hue Flash' })).toBeVisible();
    // condition chip from -> boss@company.com
    await expect(page.getByText('boss@company.com')).toBeVisible();
    // action config chip group -> Office
    await expect(page.getByText('Office', { exact: true })).toBeVisible();
  });

  test('back link returns to automations list', async ({ page }) => {
    await installMocks(page);
    await page.goto(`/automations/${AUTO_HUE.id}`);

    await page.getByRole('link', { name: 'Automations' }).click();
    await expect(page).toHaveURL(/\/automations$/);
  });

  test('unknown automation shows not-found state', async ({ page }) => {
    await installMocks(page);
    await page.goto('/automations/does-not-exist');

    await expect(page.getByText('Automation not found')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to automations' })).toBeVisible();
  });

  test('renders run-count stats pills', async ({ page }) => {
    await installMocks(page);
    await page.goto(`/automations/${AUTO_HUE.id}`);
    await expect(page.getByText(`${LOGS_HUE.length} runs`)).toBeVisible();
    await expect(page.getByText('1 successful')).toBeVisible();
  });
});

test.describe('Automation detail - toggle active', () => {
  test('toggling the active switch PATCHes active state', async ({ page }) => {
    const mocks = await installMocks(page);
    await page.goto(`/automations/${AUTO_HUE.id}`); // starts inactive

    // The toggle is the switch button in the hero (no accessible name, last button row).
    const toggle = page.locator('button.w-11.h-6');
    await expect(toggle).toHaveCSS('background-color', 'rgb(51, 51, 51)'); // #333 = off
    await toggle.click();

    await expect.poll(() => mocks.find('/api/automations/', 'PATCH')?.body).toEqual({ active: true });
    await expect(toggle).toHaveCSS('background-color', 'rgb(34, 197, 94)'); // #22c55e = on
  });
});

test.describe('Automation detail - edit / save', () => {
  test('Edit -> change name + condition -> Save sends PATCH with diff', async ({ page }) => {
    const mocks = await installMocks(page);
    await page.goto(`/automations/${AUTO_HUE.id}`);

    await page.getByRole('button', { name: 'Edit' }).click();

    const nameInput = page.locator('input[type="text"]').first();
    await expect(nameInput).toHaveValue('Gmail -> Hue Flash');
    await nameInput.fill('Hue Flash Renamed');

    // The condition input (from) - second text input under Trigger Config.
    const fromInput = page.locator('input[type="text"]').nth(1);
    await fromInput.fill('ceo@company.com');

    await page.getByRole('button', { name: 'Save' }).click();

    const patch = await expect
      .poll(() => mocks.find('/api/automations/', 'PATCH')?.body)
      .toMatchObject({ name: 'Hue Flash Renamed' });

    // After save, heading reflects new name and a success toast appears.
    await expect(page.getByRole('heading', { name: 'Hue Flash Renamed' })).toBeVisible();
  });

  test('Cancel exits edit mode without PATCH', async ({ page }) => {
    const mocks = await installMocks(page);
    await page.goto(`/automations/${AUTO_HUE.id}`);

    await page.getByRole('button', { name: 'Edit' }).click();
    await page.locator('input[type="text"]').first().fill('Throwaway');
    await page.getByRole('button', { name: 'Cancel' }).click();

    await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Gmail -> Hue Flash' })).toBeVisible();
    expect(mocks.find('/api/automations/', 'PATCH')).toBeUndefined();
  });
});

test.describe('Automation detail - delete', () => {
  test('Delete shows confirm, Confirm DELETEs and navigates to list', async ({ page }) => {
    const mocks = await installMocks(page);
    await page.goto(`/automations/${AUTO_HUE.id}`);

    await page.getByRole('button', { name: 'Delete' }).click();
    const confirm = page.getByRole('button', { name: 'Confirm' });
    await expect(confirm).toBeVisible();
    await confirm.click();

    await expect(page).toHaveURL(/\/automations$/);
    expect(mocks.find('/api/automations/', 'DELETE')).toBeDefined();
  });

  test('Delete -> Cancel keeps the automation', async ({ page }) => {
    const mocks = await installMocks(page);
    await page.goto(`/automations/${AUTO_HUE.id}`);

    await page.getByRole('button', { name: 'Delete' }).click();
    // The cancel button inside the confirm row.
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('button', { name: 'Delete' })).toBeVisible();
    expect(mocks.find('/api/automations/', 'DELETE')).toBeUndefined();
  });
});

test.describe('Automation detail - logs', () => {
  test('renders log rows and expands one to show debug panel', async ({ page }) => {
    await installMocks(page);
    await page.goto(`/automations/${AUTO_HUE.id}`);

    // Log title uses payload.subject when present.
    const logRow = page.getByText('Urgent', { exact: true });
    await expect(logRow).toBeVisible();
    await logRow.click();

    // Expanded debug panel shows raw fields + the log detail.
    await expect(page.getByText('result', { exact: true })).toBeVisible();
    await expect(page.getByText('via', { exact: true })).toBeVisible();
    await expect(page.getByText('payload', { exact: true })).toBeVisible();
    await expect(page.getByText('Flashed Office lights').first()).toBeVisible();
  });

  test('shows empty-logs state when no executions', async ({ page }) => {
    await installMocks(page);
    await page.goto(`/automations/${AUTO_GMAIL_MANUAL.id}`); // has [] logs
    // Switch to Logs tab (gmail manual defaults to Emails).
    await page.getByRole('button', { name: /Logs \(0\)/ }).click();
    await expect(page.getByText('No executions yet')).toBeVisible();
  });
});

test.describe('Automation detail - YouTube likes tab', () => {
  test('renders liked-videos list and tab counts', async ({ page }) => {
    await installMocks(page);
    await page.goto(`/automations/${AUTO_YT.id}`);

    await expect(page.getByRole('button', { name: /Liked Videos \(3\)/ })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Next.js 16 release' })).toBeVisible();
  });

  test('switching to Logs tab shows execution logs', async ({ page }) => {
    await installMocks(page);
    await page.goto(`/automations/${AUTO_YT.id}`);

    await page.getByRole('button', { name: /Logs \(2\)/ }).click();
    await expect(page.getByText('How transformers work').first()).toBeVisible();
  });

  test('Process button on an unprocessed video posts and marks Done', async ({ page }) => {
    const mocks = await installMocks(page);
    await page.goto(`/automations/${AUTO_YT.id}`);

    // vid-aaa is in processed (from logs payload), so use vid-ccc which is fresh.
    const row = page.locator('div.group').filter({ hasText: 'Next.js 16 release' }).first();
    await row.getByRole('button', { name: 'Process' }).click();

    await expect.poll(() => mocks.find('/api/youtube/process', 'POST')?.body).toMatchObject({ videoId: 'vid-ccc' });
    // After success the row shows the "Done" badge.
    await expect(row.getByText('Done')).toBeVisible();
  });

  test('Unlike heart posts unlike and removes the row', async ({ page }) => {
    const mocks = await installMocks(page);
    await page.goto(`/automations/${AUTO_YT.id}`);

    const title = page.getByRole('link', { name: 'Next.js 16 release' });
    await expect(title).toBeVisible();

    const row = page.locator('div.group').filter({ hasText: 'Next.js 16 release' }).first();
    await row.getByRole('button', { name: 'Unlike video' }).click();

    await expect.poll(() => mocks.find('/api/youtube/unlike', 'POST')?.body).toMatchObject({ videoId: 'vid-ccc' });
    // Row fades out + is removed (max-height -> 0 then filtered).
    await expect(title).toHaveCount(0);
  });
});

test.describe('Automation detail - Gmail manual (Emails tab)', () => {
  test('defaults to Emails tab and lists matching emails', async ({ page }) => {
    await installMocks(page);
    await page.goto(`/automations/${AUTO_GMAIL_MANUAL.id}`);

    await expect(page.getByRole('button', { name: /Emails \(2\)/ })).toBeVisible();
    await expect(page.getByText('Invoice #1024')).toBeVisible();
    await expect(page.getByText('Invoice #1025')).toBeVisible();
  });

  test('Save to Stickies posts and switches row to Saved', async ({ page }) => {
    const mocks = await installMocks(page);
    await page.goto(`/automations/${AUTO_GMAIL_MANUAL.id}`);

    const row = page.locator('div.group').filter({ hasText: 'Invoice #1024' }).first();
    await row.getByRole('button', { name: 'Save to Stickies' }).click();

    await expect.poll(() => mocks.find('/api/gmail/sticky-from-message', 'POST')?.body).toMatchObject({ messageId: 'msg-1', automationId: AUTO_GMAIL_MANUAL.id });
    await expect(row.getByText('Saved')).toBeVisible();
  });
});
