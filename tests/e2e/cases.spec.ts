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
  const openButton = page.getByRole('button', { name: /条件を指定して探す|条件を変更する/ });
  await expect(openButton).toBeVisible();
  await openButton.click();

  const sheet = page.getByRole('region', { name: '検索条件を設定' });
  await expect(sheet).toBeVisible();
  await page.getByRole('button', { name: '閉じる' }).click();
  await expect(sheet).toBeHidden();
});

test('register page includes comment profile fields', async ({ page }) => {
  await page.goto('/auth/register');
  await expect(page.getByLabel('表示名')).toBeVisible();
  await expect(page.getByRole('radio', { name: '売りたい' })).toBeVisible();
  await expect(page.getByRole('radio', { name: '買いたい' })).toBeVisible();
  await expect(page.getByRole('radio', { name: '両方' })).toBeChecked();
});
