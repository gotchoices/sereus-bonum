import { test, expect } from '@playwright/test';
import { seedEntity, gotoReady } from './helpers';

// "Show All Transactions" loads every entry cross-entity; the totals row must reconcile (double-entry).
test('search: show all transactions → totals balanced', async ({ page }) => {
  await seedEntity(page);
  await gotoReady(page, '/search');
  await page.getByRole('button', { name: 'Show All Transactions' }).click();
  await expect(page.getByText('Balanced').first()).toBeVisible({ timeout: 30_000 });
});
