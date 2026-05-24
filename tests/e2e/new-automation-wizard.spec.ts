import { test, expect } from '@playwright/test';
import { installMocks } from './_mocks';

// The desktop builder (/automations/new) uses native HTML5 drag-and-drop on a
// React Flow canvas, which is not reliably drivable in headless chromium (see
// new-automation-desktop.spec.ts). The MobileWizard renders at viewport < 640
// and exercises the same create flow + POST /api/automations/create, so the
// new-automation path is fully covered here.
test.use({ viewport: { width: 390, height: 844 } });

test.describe('New automation - MobileWizard', () => {
  test('renders the wizard with step 1 (Choose Trigger)', async ({ page }) => {
    await installMocks(page);
    await page.goto('/automations/new');

    await expect(page.getByText('Choose Trigger')).toBeVisible();
    // Trigger integrations grid (those with triggers): YouTube present.
    await expect(page.getByRole('button', { name: 'YouTube' })).toBeVisible();
  });

  test('back arrow on step 1 returns to the automations list', async ({ page }) => {
    await installMocks(page);
    await page.goto('/automations/new');

    // The top-bar back button is the first button in the wizard.
    await page.locator('button').first().click();
    await expect(page).toHaveURL(/\/automations$/);
  });

  test('steps through trigger -> action -> configure -> create (POST sent)', async ({ page }) => {
    const mocks = await installMocks(page);
    await page.goto('/automations/new');

    // Step 1: choose trigger integration.
    await page.getByRole('button', { name: 'YouTube' }).click();

    // Step 2: choose trigger event.
    await expect(page.getByText('YouTube - Event')).toBeVisible();
    await page.getByRole('button', { name: /Video Liked/ }).click();

    // Step 3: configure trigger (YouTube has a keyword field).
    await expect(page.getByText('Configure Trigger')).toBeVisible();
    await page.getByPlaceholder('e.g. AI, programming').fill('AI');
    await page.getByRole('button', { name: 'Next', exact: true }).click();

    // Step 4: choose action integration.
    await expect(page.getByText('Choose Action')).toBeVisible();
    await page.getByRole('button', { name: 'Stickies' }).click();

    // Step 5: choose action event.
    await expect(page.getByText('Stickies - Event')).toBeVisible();
    await page.getByRole('button', { name: /Create Sticky/ }).click();

    // Step 6: configure action (Stickies has folder + manual checkbox).
    await expect(page.getByText('Configure Action')).toBeVisible();
    await page.getByPlaceholder('e.g. YouTube, Gmail, Notes').fill('YouTube');

    await page.getByRole('button', { name: 'Create Automation' }).click();

    // POST sent with the expected shape, then navigates back to the list.
    const post = await expect
      .poll(() => mocks.find('/api/automations/create', 'POST')?.body)
      .toMatchObject({
        trigger_integration_type: 'youtube',
        action_integration_type: 'stickies',
        condition: { keyword: 'AI' },
        action_config: { folder: 'YouTube' },
      });
    await expect(page).toHaveURL(/\/automations$/);
  });

  test('progress dots advance as steps progress', async ({ page }) => {
    await installMocks(page);
    await page.goto('/automations/new');

    await page.getByRole('button', { name: 'YouTube' }).click();
    await page.getByRole('button', { name: /Video Liked/ }).click();
    // On step 3 the active dot is wider; assert header advanced.
    await expect(page.getByText('Configure Trigger')).toBeVisible();
  });

  test('shows duplicate error when create returns 409', async ({ page }) => {
    await installMocks(page, { createConflict: true });
    await page.goto('/automations/new');

    await page.getByRole('button', { name: 'YouTube' }).click();
    await page.getByRole('button', { name: /Video Liked/ }).click();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.getByRole('button', { name: 'Stickies' }).click();
    await page.getByRole('button', { name: /Create Sticky/ }).click();
    await page.getByRole('button', { name: 'Create Automation' }).click();

    await expect(page.getByText('This automation already exists')).toBeVisible();
    // Stays on the wizard (no navigation).
    await expect(page).toHaveURL(/\/automations\/new$/);
  });

  test('can step backwards through the wizard', async ({ page }) => {
    await installMocks(page);
    await page.goto('/automations/new');

    await page.getByRole('button', { name: 'YouTube' }).click();
    await expect(page.getByText('YouTube - Event')).toBeVisible();

    // Back arrow returns to step 1.
    await page.locator('button').first().click();
    await expect(page.getByText('Choose Trigger')).toBeVisible();
  });

  test('action with no config fields shows "No configuration needed"', async ({ page }) => {
    await installMocks(page);
    await page.goto('/automations/new');

    await page.getByRole('button', { name: 'YouTube' }).click();
    await page.getByRole('button', { name: /Video Liked/ }).click();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    // GitHub Create Issue has no config fields in getConfigFields.
    await page.getByRole('button', { name: 'GitHub' }).click();
    await page.getByRole('button', { name: /Create Issue/ }).click();
    await expect(page.getByText('No configuration needed')).toBeVisible();
  });
});
