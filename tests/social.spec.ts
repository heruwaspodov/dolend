import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const actor = '11111111-1111-4111-8111-111111111111';
const target = '22222222-2222-4222-8222-222222222222';

async function setSession(page: Page) {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const session = {
    access_token: 'social-browser-token', refresh_token: 'social-browser-refresh', token_type: 'bearer', expires_in: 3600, expires_at: expiresAt,
    user: { id: actor, aud: 'authenticated', role: 'authenticated', email: 'social@example.test', email_confirmed_at: '2026-11-05T00:00:00.000Z', app_metadata: { provider: 'google', providers: ['google'] }, user_metadata: { full_name: 'Social Fixture' }, identities: [], created_at: '2026-11-05T00:00:00.000Z' },
  };
  await page.addInitScript(({ value }) => localStorage.setItem('sb-fpbefabsqryxmnmxufjw-auth-token', JSON.stringify(value)), { value: session });
}

test('social privacy controls, request handling and account actions work without phone search', async ({ page }) => {
  await setSession(page);
  const calls: Array<{ method: string; path: string; body?: Record<string, unknown> }> = [];
  await page.route(/\/social\/(?:profile|list|privacy|follow|requests|blocks|reports)(?:\/|\?|$)/, async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.slice(url.pathname.indexOf('/social') + '/social'.length);
    const postData = request.postData();
    const body = postData ? JSON.parse(postData) as Record<string, unknown> : undefined;
    calls.push({ method: request.method(), path, body });
    let data: unknown = [];
    if (path === `/profile/${actor}`) data = { is_private: false };
    if (path === '/list/requests') data = [{ profile_id: target, display_name: 'Teman Uji', status: 'pending' }];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }) });
  });
  await page.goto('/social/');
  await expect(page.getByRole('heading', { name: 'Privasi dan relasi' })).toBeVisible();
  await expect(page.getByText('Teman Uji')).toBeVisible();
  await page.getByRole('button', { name: 'Setujui' }).click();
  await expect(page.getByRole('status')).toContainText('Permintaan disetujui.');
  const privacy = page.getByLabel('Jadikan profil privat');
  await expect(privacy).not.toBeChecked();
  await privacy.click();
  await expect(privacy).toBeChecked();
  await expect(page.getByRole('status')).toContainText('Privasi profil berhasil diperbarui.');
  await page.getByLabel('ID profil').fill(target);
  await page.getByRole('button', { name: 'Ikuti' }).click();
  await expect(page.getByRole('status')).toContainText('Permintaan mengikuti dikirim.');
  expect(calls.some(call => call.path === `/requests/${target}` && call.body?.accept === true)).toBeTruthy();
  expect(calls.some(call => call.path === '/privacy' && call.body?.is_private === true)).toBeTruthy();
  expect(calls.some(call => call.path === `/follow/${target}` && call.method === 'POST')).toBeTruthy();
  await expect(page.getByText('Nomor telepon tidak digunakan untuk mencari akun.')).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
  await page.setViewportSize({ width: 360, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});

test('social page asks for login before showing private relationship controls', async ({ page }) => {
  await page.goto('/social/');
  await expect(page.getByText('Masuk dengan akun Google untuk mengelola relasi.')).toBeVisible();
  await expect(page.getByLabel('ID profil')).toHaveCount(0);
});
