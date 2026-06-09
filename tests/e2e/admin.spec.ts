import { expect, test } from '@playwright/test';

const hasSupabaseEnv = Boolean(
  process.env.PUBLIC_SUPABASE_URL && process.env.PUBLIC_SUPABASE_ANON_KEY
);

test.describe('/admin access control', () => {
  test.skip(!hasSupabaseEnv, 'PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY が未設定');

  test('unauthenticated user is redirected to login', async ({ page }) => {
    const routes = ['/admin', '/admin/posts', '/admin/consultations', '/admin/threads'];

    for (const route of routes) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/auth\/login/);
      await expect(page.getByRole('heading', { level: 1, name: 'ログイン' })).toBeVisible();
    }
  });
});

test.describe('/admin page smoke (with admin credentials)', () => {
  test.skip(!hasSupabaseEnv, 'PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY が未設定');

  const adminEmail = process.env.E2E_ADMIN_EMAIL;
  const adminPassword = process.env.E2E_ADMIN_PASSWORD;

  test.skip(!adminEmail || !adminPassword, 'E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD が未設定');

  test('admin can open key dashboard pages', async ({ page }) => {
    await page.goto('/auth/login?redirect=%2Fadmin');
    await page.getByLabel('メールアドレス').fill(adminEmail!);
    await page.getByLabel('パスワード').fill(adminPassword!);
    await page.getByRole('button', { name: 'ログイン' }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole('heading', { level: 1, name: '運営管理' })).toBeVisible();

    const checks: Array<{ href: string; heading: string }> = [
      { href: '/admin/posts', heading: '投稿審査' },
      { href: '/admin/consultations', heading: '相談一覧' },
      { href: '/admin/threads', heading: '仲介ワークスペース' },
      { href: '/admin/deals', heading: '売買契約・請求管理' },
    ];

    for (const check of checks) {
      await page.goto(check.href);
      await expect(page).toHaveURL(new RegExp(`${check.href.replace('/', '\\/')}$`));
      await expect(page.getByRole('heading', { level: 1, name: check.heading })).toBeVisible();
    }
  });
});
