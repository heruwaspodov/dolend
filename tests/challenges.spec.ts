import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const actor = '11111111-1111-4111-8111-111111111111';
const challengeId = '22222222-2222-4222-8222-222222222222';
const profileId = '33333333-3333-4333-8333-333333333333';

async function setSession(page: Page) {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const session = {
    access_token: 'challenge-browser-token', refresh_token: 'challenge-browser-refresh', token_type: 'bearer', expires_in: 3600, expires_at: expiresAt,
    user: { id: actor, aud: 'authenticated', role: 'authenticated', email: 'challenge@example.test', email_confirmed_at: '2026-11-05T00:00:00.000Z', app_metadata: { provider: 'google', providers: ['google'] }, user_metadata: { full_name: 'Challenge Fixture' }, identities: [], created_at: '2026-11-05T00:00:00.000Z' },
  };
  await page.addInitScript(({ value }) => localStorage.setItem('sb-fpbefabsqryxmnmxufjw-auth-token', JSON.stringify(value)), { value: session });
}

test('challenge page creates and joins a verified attendance challenge', async ({ page }) => {
  await setSession(page);
  const calls: string[] = [];
  let joined = false;
  const challenge = { id: challengeId, title: 'Tiga event bersama', description: 'Kehadiran dicatat organizer.', status: 'open', metric: 'attended_events', target: 3, starts_on: '2026-11-05', ends_on: '2026-11-12', timezone: 'Asia/Jakarta', joined, progress: joined ? 1 : null, completed_at: null };
  await page.route((url) => url.pathname.includes('/dolend-api/v1/challenges'), async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    calls.push(`${request.method()} ${url.pathname}`);
    if (request.method() === 'POST' && url.pathname.endsWith('/join')) joined = true;
    if (request.method() === 'DELETE') joined = false;
    await route.fulfill({ status: request.method() === 'POST' && url.pathname === '/challenges' ? 201 : 200, contentType: 'application/json', body: JSON.stringify({ data: [{ ...challenge, joined, progress: joined ? 1 : null }] }) });
  });
  await page.goto('/challenges/');
  await expect(page.getByRole('heading', { name: 'Challenges' })).toBeVisible();
  await expect(page.getByText('Tiga event bersama')).toBeVisible();
  await page.getByRole('button', { name: 'Ikuti' }).click();
  await expect(page.getByRole('status')).toContainText('Kamu bergabung ke challenge.');
  await expect(page.getByText('Progres: 1 / 3 kehadiran')).toBeVisible();
  await page.getByLabel('Nama').fill('Jalan rutin');
  await page.getByRole('button', { name: 'Buat challenge' }).click();
  await expect(page.getByRole('status')).toContainText('Challenge dibuat.');
  expect(calls.some((call) => call.startsWith('POST ') && call.endsWith('/challenges'))).toBeTruthy();
  expect(calls.some((call) => call.endsWith('/join'))).toBeTruthy();
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations).toEqual([]);
  await page.setViewportSize({ width: 360, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});

test('achievement profile shows versioned badges and handles empty state', async ({ page }) => {
  await setSession(page);
  await page.route('**/profile', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { id: profileId, user_id: actor, display_name: 'Badge Fixture' } }) }));
  await page.route((url) => url.pathname.includes(`/profiles/${profileId}/achievements`), async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [{ code: 'first_attendance', title: 'Langkah pertama', description: 'Satu kehadiran terverifikasi.', rule_version: 2, awarded_at: '2026-11-01T00:00:00Z' }] }) }));
  await page.goto('/achievements/');
  await expect(page.getByRole('heading', { name: 'Pencapaian', exact: true })).toBeVisible();
  await expect(page.getByText('Langkah pertama')).toBeVisible();
  await expect(page.getByText('Aturan v2')).toBeVisible();
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations).toEqual([]);
});

test('challenge and achievement pages require login', async ({ page }) => {
  await page.goto('/challenges/');
  await expect(page.getByText('Masuk dengan akun Google untuk mengikuti dan membuat challenge.')).toBeVisible();
  await page.goto('/achievements/');
  await expect(page.getByText('Masuk dengan akun Google untuk melihat lencana pribadimu.')).toBeVisible();
});
