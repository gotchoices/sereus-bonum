import { test, expect } from '@playwright/test';
import { seedEntity, waitLoaded, gotoReady } from './helpers';

// Manage Accounts: the screen lists the entity's accounts, and Add creates a new one that appears.
test.describe('Manage Accounts', () => {
  test('lists seeded accounts and adds a new one', async ({ page }) => {
    const id = await seedEntity(page);
    await gotoReady(page, `/entities/${id}/accounts`);
    await waitLoaded(page);

    const rows = page.locator('button.acct-main');
    await expect(rows.first()).toBeVisible();
    const before = await rows.count();
    expect(before).toBeGreaterThan(0);

    await page.getByRole('button', { name: /Add/ }).first().click();
    await page.locator('#f-name').fill('E2E Test Account');
    await page.locator('#f-group').selectOption({ index: 1 }); // first real group (index 0 is the disabled placeholder)
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByText('E2E Test Account')).toBeVisible();
    await expect(rows).toHaveCount(before + 1);
  });
});
