import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const eventId = '44444444-4444-4444-8444-444444444444';
const workspaceId = '55555555-5555-4555-8555-555555555555';
const activityId = '66666666-6666-4666-8666-666666666666';
const session = {
  access_token: 'organizer-browser-test-token', refresh_token: 'organizer-browser-test-refresh', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'host@example.com', email_confirmed_at: '2026-10-31T00:00:00.000Z', app_metadata: { provider: 'google', providers: ['google'] }, user_metadata: { full_name: 'Host Dolend' }, identities: [], created_at: '2026-10-31T00:00:00.000Z' },
};
const publicEvent = { id:eventId,title:'Badminton Jumat',description:'Main santai bersama',starts_at:'2026-11-06T19:00:00+07:00',ends_at:'2026-11-06T21:00:00+07:00',timezone:'Asia/Jakarta',capacity:12,participants_count:1,price_amount:0,currency:'IDR',status:'recruiting',venue_booking_status:'not_booked',estimated_total_cost:240000,contributions_locked_at:null,contribution_mode:'dynamic',venue:{name:'Venue belum ditentukan',address:'',maps_url:''} };

async function withSession(page: Page) {
  await page.addInitScript(({ value }) => localStorage.setItem('sb-fpbefabsqryxmnmxufjw-auth-token', JSON.stringify(value)), { value: session });
}

test('dashboard organizer menampilkan event nyata dan aman di 360 px', async ({ page }) => {
  await withSession(page);
  await page.route('**/dolend-api/v1/organizer/events', route => route.fulfill({ status:200, contentType:'application/json', body:JSON.stringify({data:[publicEvent]}) }));
  await page.goto('/dashboard/');
  await expect(page.getByRole('heading', { name:'Event kamu' })).toBeVisible();
  await expect(page.getByRole('heading', { name:'Badminton Jumat' })).toBeVisible();
  await expect(page.getByRole('link', { name:'Kelola event' })).toHaveAttribute('href', `/event/manage/?id=${eventId}`);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});

test('form membuat recruiting event tanpa venue wajib', async ({ page }) => {
  await withSession(page);
  let created: Record<string, unknown> | undefined;
  await page.route('**/dolend-api/v1/organizer/workspaces', route => route.fulfill({ status:200, contentType:'application/json', body:JSON.stringify({data:[{id:workspaceId,name:'Workspace Host',role:'owner'}]}) }));
  await page.route('**/dolend-api/v1/activity-types', route => route.fulfill({ status:200, contentType:'application/json', body:JSON.stringify({data:[{id:activityId,slug:'badminton',name:'Badminton'}]}) }));
  await page.route('**/dolend-api/v1/events', async route => { if (route.request().method() !== 'POST') return route.fallback(); created=route.request().postDataJSON(); await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:{id:eventId}})}); });
  await page.goto('/event/create/');
  await page.getByLabel('Nama event').fill('Badminton Jumat');
  await page.getByLabel('Mulai').fill('2026-11-06T19:00');
  await page.getByLabel('Selesai').fill('2026-11-06T21:00');
  await page.getByLabel('Pendaftaran ditutup').fill('2026-11-05T19:00');
  await page.getByLabel('Perkiraan biaya total (Rp)').fill('240000');
  await page.getByRole('button', { name:'Buat event' }).click();
  await expect(page).toHaveURL(`/event/manage/?id=${eventId}`);
  expect(created?.venue_snapshot).toBeUndefined();
  expect(created?.starts_at).toBe('2026-11-06T19:00:00+07:00');
  expect(created?.payment_timing).toBe('before_event');
});

test('ruang kelola memuat roster dan membuat tautan guest satu kali', async ({ page }) => {
  await withSession(page);
  const token = 'a'.repeat(43);
  let cancellation: Record<string, unknown> | undefined;
  await page.route(`**/dolend-api/v1/events/${eventId}`, route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:publicEvent})}));
  await page.route(`**/dolend-api/v1/events/${eventId}/roster`, route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:{estimated_total_cost:240000,contributions_locked_at:null,payment_timing:'before_event',estimated_per_person:240000,participants:[{id:'77777777-7777-4777-8777-777777777777',status:'confirmed',chargeable:true,is_guest:true,users:{display_name:'Rani'},participant_charges:[]}]}})}));
  await page.route(`**/dolend-api/v1/events/${eventId}/participants`, route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:{participant_id:'88888888-8888-4888-8888-888888888888',booking_token:token}})}));
  await page.route('**/dolend-api/v1/participants/77777777-7777-4777-8777-777777777777/cancel', async route => { cancellation=route.request().postDataJSON(); await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:{ok:true}})}); });
  await page.goto(`/event/manage/?id=${eventId}`);
  await expect(page.getByRole('heading', { name:'Daftar peserta' })).toBeVisible();
  await expect(page.getByText('Rani', { exact:true })).toBeVisible();
  await page.getByLabel('Nama peserta').fill('Budi');
  await page.getByLabel('Nomor WhatsApp').fill('081234567890');
  await page.getByRole('button', { name:'Tambahkan peserta' }).click();
  await expect(page.getByText(new RegExp(`#booking=${token}`))).toBeVisible();
  await page.getByText('Tindakan peserta').click();
  await page.getByLabel('Alasan').fill('Berhalangan hadir');
  await page.getByRole('button', { name:'Batalkan peserta' }).click();
  await expect(page.getByText('Peserta dibatalkan sesuai kebijakan yang dipilih.')).toBeVisible();
  expect(cancellation?.policy).toBe('waive');
  expect(cancellation?.reason).toBe('Berhalangan hadir');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
