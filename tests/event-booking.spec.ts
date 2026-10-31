import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const eventId = '55555555-5555-4555-8555-555555555555';
const bookingToken = 'a'.repeat(43);

test('guest membuat booking dan membuka ulang status dari token fragment', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.route(new RegExp(`/functions/v1/dolend-api/v1/events/${eventId}(?:/|$)`), async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'apikey, authorization, content-type, x-booking-token' };
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: cors });
      return;
    }
    if (url.pathname.endsWith('/guest-bookings') && request.method() === 'POST') {
      await route.fulfill({ status: 201, contentType: 'application/json', headers: cors, body: JSON.stringify({ data: { participant_id: '66666666-6666-4666-8666-666666666666', status: 'confirmed', booking_token: bookingToken } }) });
      return;
    }
    if (url.pathname.endsWith('/guest-bookings/me')) {
      expect(request.headers()['x-booking-token']).toBe(bookingToken);
      await route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify({ data: { participant_id: '66666666-6666-4666-8666-666666666666', status: 'confirmed', hold_expires_at: null, confirmed_at: '2026-10-28T00:00:00.000Z', updated_at: '2026-10-28T00:00:00.000Z' } }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify({ data: {
      id: eventId, title: 'Badminton Rabu', description: 'Main santai.', starts_at: '2026-11-04T12:00:00.000Z', ends_at: '2026-11-04T14:00:00.000Z', timezone: 'Asia/Jakarta', capacity: 8, participants_count: 2, venue: { name: 'GOR Fixture', address: 'Jakarta', maps_url: 'https://www.google.com/maps/search/?api=1&query=Jakarta' }, price_amount: 0, currency: 'IDR',
    } }) });
  });

  await page.goto(`/event/?id=${eventId}`);
  await page.getByLabel('Nama').fill('Dolen Guest');
  await page.getByLabel('Nomor WhatsApp').fill('0812 3456 7890');
  await page.getByRole('button', { name: 'Booking tempat' }).click();
  await expect(page.getByRole('heading', { name: 'Status booking' })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`#booking=${bookingToken}$`));
  await page.getByRole('button', { name: 'Salin tautan booking' }).click();
  await expect(page.getByRole('button', { name: 'Tautan tersalin' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(`#booking=${bookingToken}`);

  await page.reload();
  await expect(page.getByText('Booking sudah dikonfirmasi.')).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});
