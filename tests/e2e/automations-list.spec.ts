import { test, expect } from '@playwright/test';
import { installMocks, AUTOMATIONS } from './_mocks';

test.describe('Automations list page', () => {
  test('renders a card per automation with names', async ({ page }) => {
    await installMocks(page);
    await page.goto('/automations');

    await expect(page.getByRole('heading', { name: 'Automations' })).toBeVisible();
    for (const auto of AUTOMATIONS) {
      await expect(page.getByText(auto.name, { exact: true })).toBeVisible();
    }
  });

  test('renders If/Then config chips on cards', async ({ page }) => {
    await installMocks(page);
    await page.goto('/automations');

    // Trigger condition chip for the YouTube automation: keyword: AI
    await expect(page.getByText('keyword: AI')).toBeVisible();
    // Action label "send email" -> prettyAction strips "send" prefix -> "email"
    await expect(page.getByText('from: boss@company.com')).toBeVisible();
  });

  test('shows If and Then labels on each card', async ({ page }) => {
    await installMocks(page);
    await page.goto('/automations');
    await expect(page.getByText('If', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Then', { exact: true }).first()).toBeVisible();
  });

  test('clicking a card navigates to its detail page', async ({ page }) => {
    await installMocks(page);
    await page.goto('/automations');

    await page.getByText('YouTube Liked -> Gmail', { exact: true }).click();
    await expect(page).toHaveURL(/\/automations\/auto-yt-1$/);
    await expect(page.getByRole('heading', { name: 'YouTube Liked -> Gmail' })).toBeVisible();
  });

  test('"+ New" button navigates to /automations/new', async ({ page }) => {
    await installMocks(page);
    await page.goto('/automations');

    await page.getByRole('link', { name: '+ New' }).click();
    await expect(page).toHaveURL(/\/automations\/new$/);
  });

  test('inactive automation card is grayscale/dimmed', async ({ page }) => {
    await installMocks(page);
    await page.goto('/automations');

    const hueCard = page.locator('.automation-card').filter({ hasText: 'Gmail -> Hue Flash' });
    await expect(hueCard).toHaveCSS('opacity', '0.5');
  });

  test('empty list shows "No automations yet" with create CTA', async ({ page }) => {
    await installMocks(page, { automations: [] });
    await page.goto('/automations');

    await expect(page.getByText('No automations yet')).toBeVisible();
    const cta = page.getByRole('link', { name: 'Create First Automation' });
    await expect(cta).toBeVisible();
    await cta.click();
    await expect(page).toHaveURL(/\/automations\/new$/);
  });
});

test.describe('Root redirect', () => {
  test('/ redirects to /automations', async ({ page }) => {
    await installMocks(page);
    await page.goto('/');
    await expect(page).toHaveURL(/\/automations$/);
    await expect(page.getByRole('heading', { name: 'Automations' })).toBeVisible();
  });
});
