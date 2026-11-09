import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const eventId = '55555555-5555-4555-8555-555555555555';
const bookingToken = 'a'.repeat(43);
const inviteToken = 'i'.repeat(43);

test('guest membuat booking dan membuka ulang status dari token fragment', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.route('https://tiles.openfreemap.org/styles/liberty', route => route.fulfill({
    json: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background' }] },
    headers: { 'access-control-allow-origin': '*' },
  }));
  let participants = 2;
  await page.route((url) => url.pathname.includes(`/events/${eventId}`), async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'apikey, authorization, content-type, x-booking-token, x-invite-token' };
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: cors });
      return;
    }
    if (url.pathname.endsWith('/guest-bookings') && request.method() === 'POST') {
      expect(request.headers()['x-invite-token']).toBe(inviteToken);
      participants += 1;
      await route.fulfill({ status: 201, contentType: 'application/json', headers: cors, body: JSON.stringify({ data: { participant_id: '66666666-6666-4666-8666-666666666666', status: 'confirmed', booking_token: bookingToken } }) });
      return;
    }
    if (url.pathname.endsWith('/guest-bookings/me')) {
      expect(request.headers()['x-booking-token']).toBe(bookingToken);
      await route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify({ data: { participant_id: '66666666-6666-4666-8666-666666666666', status: 'confirmed', hold_expires_at: null, confirmed_at: '2026-10-28T00:00:00.000Z', updated_at: '2026-10-28T00:00:00.000Z' } }) });
      return;
    }
    if (url.pathname.endsWith('/participation/cancel') && request.method() === 'POST') {
      expect(request.headers()['x-booking-token']).toBe(bookingToken);
      expect(request.postDataJSON().reason).toBe('Jadwal berubah');
      participants -= 1;
      await route.fulfill({status:200,contentType:'application/json',headers:cors,body:JSON.stringify({data:{participant_id:'66666666-6666-4666-8666-666666666666',status:'cancelled',hold_expires_at:null,confirmed_at:null,updated_at:'2026-10-28T01:00:00.000Z'}})});
      return;
    }
    expect(request.headers()['x-invite-token']).toBe(inviteToken);
    await route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify({ data: {
      id: eventId, title: 'Badminton Rabu', activity_type_slug: 'badminton', description: 'Main santai.', starts_at: '2026-11-04T12:00:00.000Z', ends_at: '2026-11-04T14:00:00.000Z', timezone: 'Asia/Jakarta', capacity: 8, participants_count: participants, venue: { name: 'GOR Fixture', address: 'Jakarta', maps_url: '', latitude:-6.2, longitude:106.816666, meeting_instructions:'Tunggu di lobi utama.' }, price_amount: 0, currency: 'IDR',
      contribution_mode: 'dynamic', payment_timing: 'after_event', estimated_total_cost: 300000, estimated_per_person: Math.ceil(300000 / participants),
      participant_roster: { page: 1, names: ['Tamu Contoh', 'Anggota Contoh', 'Peserta Baru'].slice(0, participants) },
    } }) });
  });

  await page.goto(`/event/?id=${eventId}#invite=${inviteToken}`);
  await expect(page.getByRole('link', { name: 'Beranda', exact: true })).toHaveCount(0);
  await expect(page.locator('article img[src="/images/landing/badminton.jpg"]')).toBeVisible();
  await expect(page.getByText('19.00–21.00', { exact: false })).toBeVisible();
  await expect(page.getByText('Bayar setelah event')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Biaya event' })).toContainText(/Rp\s150\.000/);
  await expect(page.getByRole('region', { name: 'Biaya event' })).toContainText(/Rp\s300\.000/);
  await expect(page.getByRole('region', { name: 'Biaya event' })).toContainText(/Rp\s37\.500 per orang/);
  await expect(page.getByRole('progressbar', { name: 'Kuota terkonfirmasi' })).toHaveAttribute('aria-valuenow', '2');
  const roster = page.getByRole('list', { name: 'Peserta terkonfirmasi' });
  await expect(roster.getByRole('listitem')).toHaveCount(2);
  await expect(roster.getByText('Tamu Contoh')).toBeVisible();
  await expect(roster.getByText('Anggota Contoh')).toBeVisible();
  await expect(page.getByText('Petunjuk bertemu:')).toBeVisible();
  await expect(page.getByText('Tunggu di lobi utama.')).toBeVisible();
  const map = page.getByRole('region', { name: 'Peta lokasi event' });
  await expect(map.locator('.maplibregl-marker')).toBeVisible();
  await expect(map.getByRole('status')).toHaveCount(0);
  await expect(page.getByRole('link',{name:'Buka Google Maps'})).toHaveAttribute('href',/query=-6\.2%2C106\.816666/);
  await page.getByLabel('Nama').fill('Dolen Guest');
  await page.getByLabel('Nomor WhatsApp').fill('0812 3456 7890');
  await page.getByRole('button', { name: 'Booking tempat' }).click();
  await expect(page.getByRole('heading', { name: 'Status booking' })).toBeVisible();
  await expect(roster.getByRole('listitem')).toHaveCount(3);
  await expect(roster.getByText('Peserta Baru')).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`#invite=${inviteToken}&booking=${bookingToken}$`));
  await page.getByRole('button', { name: 'Salin tautan booking' }).click();
  await expect(page.getByRole('button', { name: 'Tautan tersalin' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(`#invite=${inviteToken}&booking=${bookingToken}`);

  await page.reload();
  await expect(page.getByText('Booking sudah dikonfirmasi.')).toBeVisible();
  await page.locator('summary').filter({hasText:'Batalkan booking'}).click();
  await page.getByLabel('Alasan').fill('Jadwal berubah');
  await page.getByRole('button',{name:'Batalkan booking'}).click();
  await expect(page.getByText('Booking sudah dibatalkan.')).toBeVisible();
  await expect(roster.getByRole('listitem')).toHaveCount(2);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});
