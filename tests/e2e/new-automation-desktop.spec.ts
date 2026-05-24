import { test, expect } from '@playwright/test';
import { installMocks } from './_mocks';

// Desktop viewport renders the React Flow drag-and-drop builder (ClientLayout).
test.use({ viewport: { width: 1280, height: 800 } });

test.describe('New automation - desktop builder', () => {
  test('renders the builder header and integration sidebar', async ({ page }) => {
    await installMocks(page);
    await page.goto('/automations/new');

    await expect(page.getByText('New Automation')).toBeVisible();
    // Sidebar integration cards are accessible buttons. Connected ones say "Use ...".
    await expect(page.getByRole('button', { name: 'Use YouTube' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Use Gmail' })).toBeVisible();
  });

  test('shows the empty-canvas drop hint', async ({ page }) => {
    await installMocks(page);
    await page.goto('/automations/new');
    await expect(page.getByText('Drop integrations here')).toBeVisible();
  });

  test('disconnected integration card reads "Connect ..."', async ({ page }) => {
    await installMocks(page);
    await page.goto('/automations/new');
    // slack is not in the mocked connections list.
    await expect(page.getByRole('button', { name: 'Connect Slack' })).toBeVisible();
  });

  test('clicking an integration card opens the Connections panel', async ({ page }) => {
    await installMocks(page);
    await page.goto('/automations/new');

    await page.getByRole('button', { name: 'Connect Slack' }).click();
    // ConnectionsPanel modal heading.
    await expect(page.getByRole('heading', { name: 'Slack' })).toBeVisible();
    // Close it.
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('heading', { name: 'Slack' })).toHaveCount(0);
  });

  test('header back button returns to the automations list', async ({ page }) => {
    await installMocks(page);
    await page.goto('/automations/new');

    await page.getByRole('button', { name: 'Automations' }).click();
    await expect(page).toHaveURL(/\/automations$/);
  });

  // SKIP: building a flow requires native HTML5 drag-and-drop from the sidebar
  // onto the React Flow canvas. Playwright cannot synthesize the dataTransfer
  // payload (event.dataTransfer.getData('integrationId')) that IntegrationCard
  // sets on dragstart, so the drop modal never opens in headless chromium.
  // The equivalent create flow is fully covered via the MobileWizard in
  // new-automation-wizard.spec.ts.
  test.skip('drag an integration onto the canvas and save the flow', async () => {
    // intentionally empty - see comment above.
  });
});
