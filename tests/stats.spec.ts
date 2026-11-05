import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const actor = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
async function setSession(page: Page) {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const session = {
    access_token: 'stats-browser-token', refresh_token: 'stats-browser-refresh', token_type: 'bearer', expires_in: 3600, expires_at: expiresAt,
    user: { id: actor, aud: 'authenticated', role: 'authenticated', email: 'stats@example.test', email_confirmed_at: '2026-11-05T00:00:00.000Z', app_metadata: { provider: 'google', providers: ['google'] }, user_metadata: { full_name: 'Stats Fixture' }, identities: [], created_at: '2026-11-05T00:00:00.000Z' },
  };
  await page.addInitScript(({ value }) => localStorage.setItem('sb-fpbefabsqryxmnmxufjw-auth-token', JSON.stringify(value)), { value: session });
}

test('private stats distinguish verified attendance from shared activity', async ({ page }) => {
  await setSession(page);
  let rebuilds = 0;
  await page.route(/\/stats\/mine(?:\/rebuild)?(?:\?.*)?$/, async (route) => {
    const request = route.request();
    if (request.resourceType() === 'document') return route.continue();
    if (request.method() === 'POST') { rebuilds++; return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { rebuilt: true, period_start: '2026-10-30', period_days: 7 } }) }); }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { period_start: '2026-10-30', period_days: 7, timezone: 'Asia/Jakarta', metrics: [
      { metric_key: 'events_attended', rule_version: 1, label: 'Event dihadiri', source_kind: 'verified', metric_value: 2, period_start: '2026-10-30', period_days: 7, timezone: 'Asia/Jakarta', computed_at: '2026-11-05T00:00:00Z' },
      { metric_key: 'activities_shared', rule_version: 1, label: 'Aktivitas dibagikan', source_kind: 'self_reported', metric_value: 3, period_start: '2026-10-30', period_days: 7, timezone: 'Asia/Jakarta', computed_at: '2026-11-05T00:00:00Z' },
    ] } }) });
  });
  await page.goto('/stats/');
  await expect(page.getByRole('heading', { name: 'Statistik aktivitas' })).toBeVisible();
  await expect(page.getByText('Terverifikasi dari kehadiran event')).toBeVisible();
  await expect(page.getByText('Dihitung dari aktivitas yang kamu bagikan')).toBeVisible();
  await expect(page.getByText(/jarak dan kalori tidak dihitung/i)).toBeVisible();
  await page.getByRole('button', { name: 'Hitung ulang' }).click();
  await expect.poll(() => rebuilds).toBe(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});

test('stats require login', async ({ page }) => {
  await page.goto('/stats/');
  await expect(page.getByText('Masuk dengan Google untuk melihat statistik akunmu.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Hitung ulang' })).toHaveCount(0);
});
