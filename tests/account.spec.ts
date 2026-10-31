import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('akun menjelaskan Google untuk organizer dan guest tanpa akun', async ({ page }) => {
  await page.goto('/account/');
  await expect(page.getByRole('heading', { name: 'Kelola event dengan akun Google' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Masuk dengan Google' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Peserta tidak wajib punya akun' })).toBeVisible();
  await expect(page.getByText('Hak mengelola diberikan per workspace atau event')).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});

test('halaman akun tidak overflow pada 360 px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/account/');
  await expect(page.getByRole('button', { name: 'Masuk dengan Google' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});

test('tombol Google memulai OAuth dengan callback static', async ({ page }) => {
  await page.route('**/auth/v1/authorize?**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<p>Google OAuth</p>' }));
  await page.goto('/account/');
  await page.getByRole('button', { name: 'Masuk dengan Google' }).click();
  await page.waitForURL(/\/auth\/v1\/authorize/);
  const authorize = new URL(page.url());
  expect(authorize.searchParams.get('provider')).toBe('google');
  expect(authorize.searchParams.get('redirect_to')).toBe(`${new URL(test.info().project.use.baseURL as string).origin}/auth/callback/`);
});

test('session Google memuat dan menyimpan profil sendiri', async ({ page }) => {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const session = {
    access_token: 'profile-browser-test-token', refresh_token: 'profile-browser-test-refresh', token_type: 'bearer', expires_in: 3600, expires_at: expiresAt,
    user: { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'dolen@example.com', email_confirmed_at: '2026-10-27T00:00:00.000Z', app_metadata: { provider: 'google', providers: ['google'] }, user_metadata: { full_name: 'Dolen Browser' }, identities: [], created_at: '2026-10-27T00:00:00.000Z' },
  };
  await page.addInitScript(({ value }) => localStorage.setItem('sb-fpbefabsqryxmnmxufjw-auth-token', JSON.stringify(value)), { value: session });
  const updates: Record<string, unknown>[] = [];
  await page.route('**/dolend-api/v1/profile*', async (route) => {
    const request = route.request();
    const patch = request.method() === 'PATCH' ? request.postDataJSON() as Record<string, unknown> : {};
    if (request.method() === 'PATCH') updates.push(patch);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: {
      id: session.user.id, user_id: '22222222-2222-4222-8222-222222222222', display_name: 'Dolen Browser', email: session.user.email, phone_normalized: null, bio: patch.bio ?? 'Suka olahraga', avatar_path: null, default_timezone: patch.default_timezone ?? 'Asia/Jakarta', updated_at: '2026-10-27T01:00:00.000Z',
    }, request_id: '33333333-3333-4333-8333-333333333333' }) });
  });
  await page.route('**/dolend-api/v1/organizer/events', route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:[]})}));
  await page.route('**/dolend-api/v1/payment-settings', route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:[]})}));
  await page.route('**/auth/v1/logout*', (route) => route.fulfill({ status: 204, body: '' }));
  await page.goto('/account/');
  await expect(page.getByText('Masuk sebagai dolen@example.com.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Dolen Browser' })).toBeVisible();
  await page.getByLabel('Tentang kamu').fill('Badminton tiap Jumat');
  await page.getByRole('button', { name: 'Simpan profil' }).click();
  await expect(page.getByText('Profil berhasil diperbarui.', { exact: true })).toBeVisible();
  expect(updates).toEqual([{ bio: 'Badminton tiap Jumat', default_timezone: 'Asia/Jakarta' }]);
  await page.getByRole('button', { name: 'Keluar' }).click();
  await expect(page.getByRole('button', { name: 'Masuk dengan Google' })).toBeVisible();
});

test('callback tanpa kode tidak menganggap login berhasil', async ({ page }) => {
  await page.goto('/auth/callback/?unexpected=secret');
  await expect(page.getByText('Login Google belum dapat diselesaikan', { exact: false })).toBeVisible();
  await expect(page).toHaveURL(/\/auth\/callback\/$/);
  await page.getByRole('link', { name: 'Kembali ke akun' }).click();
  await expect(page).toHaveURL(/\/account\/$/);
});
