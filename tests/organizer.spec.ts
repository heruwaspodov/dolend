import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const eventId = '44444444-4444-4444-8444-444444444444';
const workspaceId = '55555555-5555-4555-8555-555555555555';
const activityId = '66666666-6666-4666-8666-666666666666';
const bankMethodId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const session = {
  access_token: 'organizer-browser-test-token', refresh_token: 'organizer-browser-test-refresh', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'host@example.com', email_confirmed_at: '2026-10-31T00:00:00.000Z', app_metadata: { provider: 'google', providers: ['google'] }, user_metadata: { full_name: 'Host Dolend' }, identities: [], created_at: '2026-10-31T00:00:00.000Z' },
};
const publicEvent = { id:eventId,title:'Badminton Jumat',description:'Main santai bersama',starts_at:'2026-11-06T19:00:00+07:00',ends_at:'2026-11-06T21:00:00+07:00',registration_closes_at:'2026-11-06T17:00:00+07:00',timezone:'Asia/Jakarta',capacity:12,participants_count:1,price_amount:0,currency:'IDR',status:'recruiting',visibility:'unlisted',venue_booking_status:'not_booked',estimated_total_cost:240000,contributions_locked_at:null,contribution_mode:'dynamic',payment_timing:'before_event',version:3,venue:{name:'Venue belum ditentukan',address:'',maps_url:''} };

test.beforeEach(async({page})=>{
  await page.route(`**/dolend-api/v1/events/${eventId}/invites`,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:[]})}));
  await page.route('**/dolend-api/v1/payment-settings',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:[{id:bankMethodId,type:'bank_transfer',recipient_name:'BCA Host',is_active:true}]})}));
});

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
  expect(created?.visibility).toBe('unlisted');
});

test('organizer membuat, membagikan, dan mencabut undangan event',async({page,context})=>{
  await context.grantPermissions(['clipboard-read','clipboard-write']);
  await withSession(page);
  const inviteId='99999999-9999-4999-8999-999999999999';
  const inviteToken='i'.repeat(43);
  let revoked=false;
  await page.route(`**/dolend-api/v1/organizer/events/${eventId}`,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:publicEvent})}));
  await page.route(`**/dolend-api/v1/events/${eventId}/roster`,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:{estimated_total_cost:240000,contributions_locked_at:null,payment_timing:'before_event',estimated_per_person:null,summary:{charged:0,received:0,refunded:0,adjustments:0,outstanding:0,credit:0},participants:[]}})}));
  await page.route(`**/dolend-api/v1/events/${eventId}/invites`,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:route.request().method()==='POST'?{id:inviteId,token:inviteToken,created_at:'2026-11-03T10:00:00Z',expires_at:'2026-11-06T10:00:00Z',revoked_at:null}:[]})}));
  await page.route(`**/dolend-api/v1/invites/${inviteId}/revoke`,route=>{revoked=true;return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:{id:inviteId,created_at:'2026-11-03T10:00:00Z',expires_at:'2026-11-06T10:00:00Z',revoked_at:'2026-11-03T11:00:00Z'}})});});
  await page.goto(`/event/manage/?id=${eventId}`);
  await page.getByRole('button',{name:'Buat tautan undangan'}).click();
  const expected=`${page.url().split('/event/manage/')[0]}/event/?id=${eventId}#invite=${inviteToken}`;
  await expect(page.getByLabel('Tautan yang dibagikan')).toHaveValue(expected);
  await expect(page.getByRole('link',{name:'Bagikan via WhatsApp'})).toHaveAttribute('href',new RegExp('^https://wa.me/\\?text='));
  await page.getByRole('button',{name:'Salin tautan'}).click();
  expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe(expected);
  await page.getByRole('button',{name:'Cabut undangan'}).click();
  expect(revoked).toBeTruthy();
  await expect(page.getByText('Undangan dicabut dan tidak dapat dipakai lagi.')).toBeVisible();
});

test('form venue mengirim koordinat dan petunjuk bertemu', async ({ page }) => {
  await withSession(page);
  let created: Record<string, unknown> | undefined;
  await page.route('**/dolend-api/v1/organizer/workspaces', route => route.fulfill({ status:200, contentType:'application/json', body:JSON.stringify({data:[{id:workspaceId,name:'Workspace Host',role:'owner'}]}) }));
  await page.route('**/dolend-api/v1/activity-types', route => route.fulfill({ status:200, contentType:'application/json', body:JSON.stringify({data:[{id:activityId,slug:'badminton',name:'Badminton'}]}) }));
  await page.route('**/dolend-api/v1/events', async route => { created=route.request().postDataJSON(); await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:{id:eventId}})}); });
  await page.goto('/event/create/');
  await page.getByLabel('Nama event').fill('Badminton dengan venue');
  await page.getByLabel('Mulai').fill('2026-11-06T19:00');
  await page.getByLabel('Selesai').fill('2026-11-06T21:00');
  await page.getByLabel('Pendaftaran ditutup').fill('2026-11-05T19:00');
  await page.getByLabel('Nama tempat').fill('GOR Jakarta');
  await page.getByLabel('Alamat').fill('Jakarta Pusat');
  await page.getByLabel('Latitude').fill('-6.2');
  await page.getByLabel('Longitude').fill('106.816666');
  await page.getByLabel('Kode area umum untuk rekomendasi').fill('id-jk');
  await page.getByLabel('Petunjuk bertemu').fill('Tunggu di lobi utama.');
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.getByRole('button',{name:'Buat event'}).click();
  await expect(page).toHaveURL(`/event/manage/?id=${eventId}`);
  expect(created?.venue_snapshot).toEqual({name:'GOR Jakarta',address:'Jakarta Pusat',maps_url:'',latitude:-6.2,longitude:106.816666,meeting_instructions:'Tunggu di lobi utama.',coarse_region_code:'ID-JK'});
});

test('form membuat event harga tetap setelah event',async({page})=>{
  await withSession(page);let created:Record<string,unknown>|undefined;
  await page.route('**/dolend-api/v1/organizer/workspaces',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:[{id:workspaceId,name:'Workspace Host',role:'owner'}]})}));
  await page.route('**/dolend-api/v1/activity-types',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:[{id:activityId,slug:'badminton',name:'Badminton'}]})}));
  await page.route('**/dolend-api/v1/events',async route=>{created=route.request().postDataJSON();await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:{id:eventId}})});});
  await page.goto('/event/create/');
  await page.getByLabel('Nama event').fill('Badminton postpay');
  await page.getByLabel('Mulai').fill('2026-11-06T19:00');await page.getByLabel('Selesai').fill('2026-11-06T21:00');await page.getByLabel('Pendaftaran ditutup').fill('2026-11-05T19:00');
  await page.getByLabel('Model biaya').selectOption('after_event');
  await page.getByLabel('Harga per peserta (Rp)').fill('50000');await page.getByLabel('Rekening penerima').selectOption(bankMethodId);await page.getByLabel('Jatuh tempo pembayaran').fill('2026-11-07T21:00');
  await page.getByLabel('Nama tempat').fill('GOR Jakarta');await page.getByLabel('Alamat').fill('Jakarta Pusat');
  await page.getByRole('button',{name:'Buat event'}).click();await expect(page).toHaveURL(`/event/manage/?id=${eventId}`);
  expect(created).toMatchObject({billing_mode:'after_event',price_amount:50000,payment_due_at:'2026-11-07T21:00:00+07:00',payment_method_id:bankMethodId});
  expect(created?.estimated_total_cost).toBeUndefined();
});

test('ruang kelola memuat roster dan membuat tautan guest satu kali', async ({ page }) => {
  await withSession(page);
  const token = 'a'.repeat(43);
  let cancellation: Record<string, unknown> | undefined;
  let eventStatus = 'recruiting';
  await page.route(`**/dolend-api/v1/organizer/events/${eventId}`, route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:{...publicEvent,status:eventStatus}})}));
  await page.route(`**/dolend-api/v1/events/${eventId}/roster`, route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:{estimated_total_cost:240000,contributions_locked_at:null,payment_timing:'before_event',estimated_per_person:240000,summary:{charged:0,received:0,refunded:0,adjustments:0,outstanding:0,credit:0},participants:[{id:'77777777-7777-4777-8777-777777777777',status:'confirmed',chargeable:true,is_guest:true,users:{display_name:'Rani'},participant_charges:[]}]}})}));
  await page.route(`**/dolend-api/v1/events/${eventId}/participants`, route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:{participant_id:'88888888-8888-4888-8888-888888888888',booking_token:token}})}));
  await page.route('**/dolend-api/v1/participants/77777777-7777-4777-8777-777777777777/cancel', async route => { cancellation=route.request().postDataJSON(); await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:{ok:true}})}); });
  await page.route(`**/dolend-api/v1/events/${eventId}/cancel`, async route => { eventStatus='cancelled'; await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:null})}); });
  await page.goto(`/event/manage/?id=${eventId}`);
  await expect(page.getByRole('heading', { name:'Daftar peserta' })).toBeVisible();
  await expect(page.getByText('Rani', { exact:true })).toBeVisible();
  await page.getByLabel('Nama peserta').fill('Budi');
  await page.getByLabel('Nomor WhatsApp').fill('081234567890');
  await page.getByRole('button', { name:'Tambahkan peserta' }).click();
  await expect(page.getByText(new RegExp(`#booking=${token}`))).toBeVisible();
  await page.getByText('Tindakan peserta').click();
  await page.getByRole('textbox', { name:'Alasan', exact:true }).fill('Berhalangan hadir');
  await page.getByRole('button', { name:'Batalkan peserta' }).click();
  await expect(page.getByText('Peserta dibatalkan sesuai kebijakan yang dipilih.')).toBeVisible();
  expect(cancellation?.policy).toBe('waive');
  expect(cancellation?.reason).toBe('Berhalangan hadir');
  await page.locator('summary').filter({ hasText:'Batalkan event' }).click();
  await page.getByLabel('Alasan pembatalan').fill('Venue tidak tersedia');
  await page.getByRole('button', { name:'Batalkan event' }).click();
  await expect(page.getByText('Event dibatalkan. Riwayat peserta dan transaksi tetap tersimpan.')).toBeVisible();
  await expect(page.getByText(/dibatalkan$/)).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('planning memperbarui snapshot venue lengkap', async ({page}) => {
  await withSession(page);
  let planning:Record<string,unknown>|undefined;
  await page.route(`**/dolend-api/v1/organizer/events/${eventId}`,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:publicEvent})}));
  await page.route(`**/dolend-api/v1/events/${eventId}/roster`,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:{estimated_total_cost:240000,contributions_locked_at:null,payment_timing:'before_event',estimated_per_person:null,summary:{charged:0,received:0,refunded:0,adjustments:0,outstanding:0,credit:0},participants:[]}})}));
  await page.route(`**/dolend-api/v1/events/${eventId}/planning`,async route=>{planning=route.request().postDataJSON();await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:{id:eventId}})});});
  await page.goto(`/event/manage/?id=${eventId}`);
  await page.getByLabel('Nama venue').fill('GOR Jakarta');
  await page.getByLabel('Nama event').fill('Badminton Sabtu');
  await page.getByLabel('Kapasitas').fill('16');
  await page.getByLabel('Alamat').fill('Jakarta Pusat');
  await page.getByLabel('Latitude').fill('-6.2');
  await page.getByLabel('Longitude').fill('106.816666');
  await page.getByLabel('Petunjuk bertemu').fill('Masuk dari pintu timur.');
  await page.getByRole('button',{name:'Simpan planning'}).click();
  await expect(page.getByText('Rencana event berhasil diperbarui.')).toBeVisible();
  expect(planning?.venue_snapshot).toEqual({name:'GOR Jakarta',address:'Jakarta Pusat',maps_url:'',latitude:-6.2,longitude:106.816666,meeting_instructions:'Masuk dari pintu timur.'});
  expect(planning?.expected_version).toBe(3);
  expect(planning?.title).toBe('Badminton Sabtu');
  expect(planning?.capacity).toBe(16);
});

test('planning memuat ulang event saat versi sudah berubah', async ({page}) => {
  await withSession(page);
  let reads=0;
  await page.route(`**/dolend-api/v1/organizer/events/${eventId}`,route=>{reads++;return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:{...publicEvent,version:reads===1?3:4,title:reads===1?publicEvent.title:'Badminton diperbarui organizer lain'}})});});
  await page.route(`**/dolend-api/v1/events/${eventId}/roster`,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:{estimated_total_cost:240000,contributions_locked_at:null,payment_timing:'before_event',estimated_per_person:null,summary:{charged:0,received:0,refunded:0,adjustments:0,outstanding:0,credit:0},participants:[]}})}));
  await page.route(`**/dolend-api/v1/events/${eventId}/planning`,route=>route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({error:{code:'VERSION_CONFLICT',message:'Permintaan belum dapat diproses.'}})}));
  await page.goto(`/event/manage/?id=${eventId}`);
  await page.getByLabel('Nama event').fill('Edit lokal yang stale');
  await page.getByRole('button',{name:'Simpan planning'}).click();
  await expect(page.getByText('Event berubah di tab lain.',{exact:false})).toBeVisible();
  await expect(page.getByLabel('Nama event')).toHaveValue('Badminton diperbarui organizer lain');
  expect(reads).toBe(2);
});

test('event selesai menampilkan outstanding dari ledger', async ({ page }) => {
  await withSession(page);
  await page.route(`**/dolend-api/v1/organizer/events/${eventId}`, route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:{...publicEvent,status:'completed',contributions_locked_at:'2026-11-06T21:00:00+07:00'}})}));
  await page.route(`**/dolend-api/v1/events/${eventId}/roster`, route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:{estimated_total_cost:240000,contributions_locked_at:'2026-11-06T21:00:00+07:00',payment_timing:'after_event',estimated_per_person:240000,summary:{charged:240000,received:100000,refunded:0,adjustments:0,outstanding:140000,credit:0},participants:[{id:'77777777-7777-4777-8777-777777777777',status:'confirmed',chargeable:true,is_guest:false,users:{display_name:'Rani'},participant_charges:[{id:'88888888-8888-4888-8888-888888888888',amount:240000,balance:140000}]}]}})}));
  await page.goto(`/event/manage/?id=${eventId}`);
  await expect(page.getByRole('heading', { name:'Ringkasan iuran' })).toBeVisible();
  await expect(page.getByText('Outstanding').locator('..').getByText(/140\.000/)).toBeVisible();
  await expect(page.getByText('Event selesai. Periksa outstanding dan refund sebelum menutup administrasi.')).toBeVisible();
  await expect(page.getByRole('button', { name:'Tambahkan peserta' })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});
