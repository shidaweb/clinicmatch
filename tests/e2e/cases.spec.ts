import { expect, test } from '@playwright/test';

test('cases page renders tabs and counts', async ({ page }) => {
  await page.goto('/cases');
  await expect(page.getByRole('heading', { level: 1, name: '在庫・取引事例をさがす' })).toBeVisible();
  await expect(page.getByRole('tab', { name: /在庫（売り）/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /買いたい/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /成約事例/ })).toBeVisible();
});

test('mobile filter sheet opens and closes', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile only');

  await page.goto('/cases');
  const openButton = page.getByRole('button', { name: /絞り込み/ });
  await expect(openButton).toBeVisible();
  await openButton.click();

  const dialog = page.getByRole('dialog', { name: '絞り込み' });
  await expect(dialog).toBeVisible();
  await page.getByRole('button', { name: '閉じる' }).click();
  await expect(dialog).toBeHidden();
});
