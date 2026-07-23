import { test, expect } from '@playwright/test';
import { seedEntity, waitLoaded, gotoReady } from './helpers';

// Locks the report screen's core invariants: each mode renders and reconciles. Data seeded from
// books-100 (a balanced fixture) via the probe.
test.describe('Accounts View — report invariants', () => {
  test('balance sheet / trial balance / income statement render and reconcile', async ({ page }) => {
    const id = await seedEntity(page);
    await gotoReady(page, `/entities/${id}`);
    await expect(page.locator('#mode-select')).toBeVisible();
    await waitLoaded(page);

    // Balance Sheet — A/L/E sections + balanced verification.
    await page.locator('#mode-select').selectOption('balance_sheet');
    await expect(page.getByText('Assets', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('Liabilities', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('Equity', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('Balanced').first()).toBeVisible();

    // Trial Balance — still balanced.
    await page.locator('#mode-select').selectOption('trial_balance');
    await expect(page.getByText('Balanced').first()).toBeVisible();

    // Income Statement — Net Income line present.
    await page.locator('#mode-select').selectOption('income_statement');
    await expect(page.getByText('Net Income').first()).toBeVisible();
  });
});
