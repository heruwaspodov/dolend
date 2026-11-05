import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const actor = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const category = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

async function setSession(page: Page) {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const session = {
    access_token: 'recommendation-browser-token', refresh_token: 'recommendation-browser-refresh', token_type: 'bearer', expires_in: 3600, expires_at: expiresAt,
    user: { id: actor, aud: 'authenticated', role: 'authenticated', email: 'recommendation@example.test', email_confirmed_at: '2026-11-05T00:00:00.000Z', app_metadata: { provider: 'google', providers: ['google'] }, user_metadata: { full_name: 'Recommendation Fixture' }, identities: [], created_at: '2026-11-05T00:00:00.000Z' },
  };
  await page.addInitScript(({ value }) => localStorage.setItem('sb-fpbefabsqryxmnmxufjw-auth-token', JSON.stringify(value)), { value: session });
}

test('recommendations provide fallback, preference controls and opt-out', async ({ page }) => {
  await setSession(page);
  let preferences = { opted_out: false, personalization_enabled: false, activity_type_ids: [] as string[], weekdays: [] as number[], coarse_region_code: null as string | null };
  const writes: typeof preferences[] = [];
  const feedback: Array<{ eventId: string; action: string; key: string | undefined }> = [];
  await page.route(/\/recommendations(?:\/preferences|\/[0-9a-f-]+\/feedback)?\/?(?:\?.*)?$/i, async (route) => {
    const request = route.request();
    if (request.resourceType() === 'document') return route.continue();
    const url = new URL(request.url());
    const basePath = url.pathname.slice(url.pathname.indexOf('/recommendations') + '/recommendations'.length);
    if (basePath.endsWith('/feedback')) {
      const eventId = basePath.split('/')[1]; const body = JSON.parse(request.postData() ?? '{}') as { action: string };
      feedback.push({ eventId, action: body.action, key: request.headers()['idempotency-key'] });
      return route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ data: { feedback_id: 'fixture-feedback', recorded: true } }) });
    }
    if (basePath.endsWith('/preferences')) {
      if (request.method() === 'PUT') { preferences = JSON.parse(request.postData() ?? '{}') as typeof preferences; writes.push(preferences); }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: preferences }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { items: preferences.opted_out ? [] : [
      { event_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', title: 'Jalan pagi', activity_type_name: 'Jalan kaki', starts_at: '2026-11-10T01:00:00.000Z', reason_labels: ['Acara publik mendatang'], rank_score: 0, capacity_remaining: 4, ranking_version: 1 },
      { event_id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', title: 'Sepeda sore', activity_type_name: 'Bersepeda', starts_at: '2026-11-11T01:00:00.000Z', reason_labels: ['Kategori pilihan'], rank_score: 100, capacity_remaining: 3, ranking_version: 1 },
    ], preferences, ranking_version: 1 } }) });
  });
  await page.route(/\/activity-types(?:\?.*)?$/, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [{ id: category, slug: 'walking', name: 'Jalan kaki' }] }) }));
  await page.goto('/recommendations/');
  await expect(page.getByRole('heading', { name: 'Rekomendasi acara' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Jalan pagi' })).toBeVisible();
  const personalize = page.getByLabel('Gunakan minat yang kupilih untuk personalisasi');
  await personalize.check();
  await page.getByLabel('Jalan kaki', { exact: true }).check();
  await page.getByLabel('Kode area umum (opsional)').fill('id-jk');
  await page.getByRole('button', { name: 'Simpan pilihan' }).click();
  await expect(page.getByText('Pilihan rekomendasi disimpan.', { exact: true })).toBeVisible();
  expect(writes.at(-1)?.personalization_enabled).toBeTruthy();
  expect(writes.at(-1)?.coarse_region_code).toBe('ID-JK');
  const firstEvent = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Jalan pagi' }) });
  await firstEvent.getByRole('button', { name: 'Tidak tertarik' }).click();
  await expect(page.getByRole('heading', { name: 'Jalan pagi' })).toHaveCount(0);
  expect(feedback[0]).toMatchObject({ eventId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', action: 'dismiss' });
  expect(feedback[0]?.key).toBeTruthy();
  const nextEvent = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Sepeda sore' }) });
  await nextEvent.getByRole('button', { name: 'Buka event' }).click();
  await expect(page).toHaveURL('/event/?id=eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
  expect(feedback[1]).toMatchObject({ eventId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', action: 'open' });
  expect(feedback[1]?.key).toBeTruthy();
  await page.goto('/recommendations/');
  await page.getByLabel('Jangan tampilkan rekomendasi acara').check();
  await page.getByRole('button', { name: 'Simpan pilihan' }).click();
  await expect(page.getByText('Rekomendasi dimatikan.', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Jalan pagi' })).toHaveCount(0);
  expect(writes.at(-1)?.opted_out).toBeTruthy();
  expect(writes.at(-1)?.activity_type_ids).toEqual([]);
  expect(writes.at(-1)?.coarse_region_code).toBeNull();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});

test('recommendations ask for login', async ({ page }) => {
  await page.goto('/recommendations/');
  await expect(page.getByText('Masuk untuk melihat dan mengatur rekomendasi acara publik.')).toBeVisible();
  await expect(page.getByLabel('Jangan tampilkan rekomendasi acara')).toHaveCount(0);
});
