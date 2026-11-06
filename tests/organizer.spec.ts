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
  await page.route('**/rest/v1/client_navigation_flags**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([
    {flag_key:'phase2Network',enabled:false},
    {flag_key:'phase3Recommendations',enabled:false},
    {flag_key:'phase3Challenges',enabled:false},
    {flag_key:'phase3Stats',enabled:false},
  ])}));
  await page.route(`**/dolend-api/v1/events/${eventId}/invites`,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:[]})}));
  await page.route('**/dolend-api/v1/payment-settings',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:[{id:bankMethodId,type:'bank_transfer',recipient_name:'BCA Host',is_active:true}]})}));
});

async function withSession(page: Page) {
  await page.addInitScript(({ value }) => localStorage.setItem('sb-fpbefabsqryxmnmxufjw-auth-token', JSON.stringify(value)), { value: session });
}

test('dashboard menampilkan tiga menu utama dan daftar event berbentuk tabel', async ({ page }) => {
  await withSession(page);
  await page.route('**/dolend-api/v1/organizer/events', route => route.fulfill({ status:200, contentType:'application/json', body:JSON.stringify({data:[publicEvent]}) }));
  await page.goto('/dashboard/');
  await expect(page.getByRole('heading', { name:'Selamat datang, Host' })).toBeVisible();
  await expect(page.getByText('Semua event', {exact:true})).toBeVisible();
  if ((page.viewportSize()?.width ?? 1280) < 1024) {
    await page.getByRole('button', { name:'Buka menu dashboard' }).click();
  }
  const dashboardNav = page.getByRole('navigation', { name:'Navigasi utama' });
  await expect(dashboardNav.getByRole('link', { name:'Ringkasan' })).toHaveAttribute('aria-current', 'page');
  await expect(dashboardNav.getByRole('link', { name:'My Event' })).toHaveAttribute('href', '/dashboard/events/');
  await expect(dashboardNav.getByRole('link', { name:'Akun' })).toHaveAttribute('href', '/account/');
  await expect(dashboardNav.getByRole('link')).toHaveCount(3);
  await expect(dashboardNav.getByRole('heading', { name:'MENU UTAMA' })).toBeVisible();
  await expect(dashboardNav.getByRole('link', { name:'Temukan aktivitas' })).toHaveCount(0);
  await expect(dashboardNav.getByRole('link', { name:'Tantangan' })).toHaveCount(0);
  await expect(dashboardNav.getByRole('link', { name:'Aktivitas', exact:true })).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.route('**/dolend-api/v1/organizer/events?view=active', route => route.fulfill({json:{data:[publicEvent]}}));
  await dashboardNav.getByRole('link', { name:'My Event' }).click();
  await expect(page.getByRole('heading', { name:'My Event' })).toBeVisible();
  await expect(page.getByRole('table', { name:'Daftar event yang kamu kelola' }).getByRole('row', { name:/Badminton Jumat/ })).toBeVisible();
  await expect(page.getByRole('link', { name:'Buat event', exact:true })).toHaveAttribute('href', '/event/create/');
  await expect(page.getByRole('link', { name:'Lihat event' })).toHaveAttribute('href', `/event/manage/?id=${eventId}`);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});

test('My Event memisahkan pendaftaran dan arsip organizer', async ({ page }) => {
  await withSession(page);
  await page.route('**/dolend-api/v1/organizer/events?view=active', route => route.fulfill({ json: { data: [publicEvent] } }));
  await page.route('**/dolend-api/v1/participant/events', route => route.fulfill({ json: { data: [{
    ...publicEvent, event_status: 'recruiting', participation_status: 'confirmed', can_view: true,
    invoice: { id: workspaceId, status: 'open' },
  }] } }));
  await page.route(`**/dolend-api/v1/events/${eventId}`, route => route.fulfill({ status: 403, json: {} }));
  await page.route(`**/dolend-api/v1/participant/events/${eventId}`, route => {
    expect(route.request().headers().authorization).toBe(`Bearer ${session.access_token}`);
    return route.fulfill({ json: { data: publicEvent } });
  });
  await page.route(`**/dolend-api/v1/events/${eventId}/participation`, route => route.fulfill({ json: { data: null } }));
  await page.goto('/dashboard/events/');
  await expect(page.getByRole('row', { name: /Badminton Jumat/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Arsip', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Diikuti', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Badminton Jumat' })).toBeVisible();
  await expect(page.getByText('Terdaftar', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Lihat tagihan' })).toHaveAttribute('href', `/payment/?invoice=${workspaceId}`);
  await expect(page.getByRole('link', { name: 'Lihat event' })).toHaveAttribute('href', `/event/?id=${eventId}&member=1`);
  await expect(page.getByRole('button', { name: 'Arsip', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Lihat event' }).click();
  await expect(page.getByRole('heading', { name: 'Badminton Jumat' })).toBeVisible();
  await page.goto('/dashboard/events/');
  await page.getByRole('button', { name: 'Dikelola', exact: true }).click();
  await expect(page.getByRole('row', { name: /Badminton Jumat/ })).toBeVisible();
});

test('My Event mencari, mengurutkan, memilih kolom, dan memulihkan arsip', async ({ page }) => {
  await withSession(page);
  const second = { ...publicEvent, id: workspaceId, title: 'Aerobik Sabtu', visibility: 'public', status: 'completed' };
  let archived = false;
  await page.route('**/dolend-api/v1/organizer/events?view=*', route => {
    const view = new URL(route.request().url()).searchParams.get('view');
    const data = view === 'archived' ? (archived ? [{ ...publicEvent, archived_at: '2026-11-06T12:00:00Z' }] : []) : archived ? [second] : [publicEvent, second];
    return route.fulfill({ json: { data } });
  });
  await page.route(`**/dolend-api/v1/organizer/events/${eventId}/archive`, route => {
    expect(route.request().method()).toBe('PATCH');
    archived = route.request().postDataJSON().archived;
    return route.fulfill({ json: { data: { archived_at: archived ? '2026-11-06T12:00:00Z' : null } } });
  });
  await page.goto('/dashboard/events/');
  await expect(page.getByRole('combobox', { name: 'Urutkan' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Jadwal', exact: true }).click();
  await expect(page.getByRole('columnheader', { name: 'Jadwal', exact: true })).toHaveAttribute('aria-sort', 'ascending');
  await page.getByRole('button', { name: 'Event', exact: true }).click();
  const rows = page.getByRole('table').locator('tbody tr');
  await expect(rows.first()).toContainText('Aerobik Sabtu');
  await page.getByRole('button', { name: 'Event', exact: true }).click();
  await expect(rows.first()).toContainText('Badminton Jumat');
  await expect(page.getByRole('columnheader', { name: 'Event', exact: true })).toHaveAttribute('aria-sort', 'descending');
  await page.getByRole('button', { name: 'Event', exact: true }).click();
  await expect(rows.first().getByRole('link', { name: 'Lihat event' })).toHaveAttribute('href', `/event/?id=${workspaceId}`);
  await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('recruiting');
  await expect(rows).toHaveCount(1);
  await page.getByLabel('Cari event').fill('Tidak cocok');
  await expect(page.getByText('Tidak ada event yang cocok')).toBeVisible();
  await page.getByLabel('Cari event').fill('badminton');
  await page.getByText('Kolom', { exact: true }).click();
  await page.getByRole('checkbox', { name: 'Venue' }).check();
  await expect(page.getByRole('columnheader', { name: 'Venue' })).toBeVisible();
  await page.getByText('Kolom', { exact: true }).click();
  await page.getByRole('button', { name: 'Arsipkan' }).click();
  await expect(page.getByText('Event dipindahkan ke arsip.')).toBeVisible();
  await page.getByRole('button', { name: 'Arsip', exact: true }).click();
  await expect(rows).toHaveCount(1);
  await page.getByRole('button', { name: 'Pulihkan' }).click();
  await expect(page.getByText('Arsip masih kosong')).toBeVisible();
  await page.getByRole('button', { name: 'Daftar utama' }).click();
  await expect(rows.first()).toContainText('Badminton Jumat');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});

test('My Event membagi hasil sesuai ukuran halaman', async ({ page }) => {
  await withSession(page);
  const data = Array.from({ length: 23 }, (_, index) => ({
    ...publicEvent, id: String(index), title: `Latihan ${index + 1}`,
  }));
  await page.route('**/dolend-api/v1/organizer/events?view=active', route => route.fulfill({ json: { data } }));
  await page.goto('/dashboard/events/');
  const rows = page.getByRole('table').locator('tbody tr');
  await expect(rows).toHaveCount(10);
  const pageSize = page.getByLabel('Event per halaman');
  for (const size of [5, 10, 15, 20]) {
    await pageSize.selectOption(String(size));
    await expect(rows).toHaveCount(size);
  }
  await page.getByRole('button', { name: 'Berikutnya' }).click();
  await expect(rows).toHaveCount(3);
  await expect(page.getByText('21–23 dari 23 event')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Berikutnya' })).toBeDisabled();
  await page.getByRole('button', { name: 'Sebelumnya' }).click();
  await expect(rows).toHaveCount(20);
  await page.getByRole('button', { name: 'Berikutnya' }).click();
  await page.getByLabel('Cari event').fill('Latihan 1');
  await expect(rows).toHaveCount(11);
  await expect(page.getByRole('button', { name: 'Sebelumnya' })).toBeDisabled();
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
  const expiresAt = new Date(Date.now() + 86_400_000).toISOString();
  let revoked=false;
  await page.route(`**/dolend-api/v1/organizer/events/${eventId}`,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:publicEvent})}));
  await page.route(`**/dolend-api/v1/events/${eventId}/roster`,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:{estimated_total_cost:240000,contributions_locked_at:null,payment_timing:'before_event',estimated_per_person:null,summary:{charged:0,received:0,refunded:0,adjustments:0,outstanding:0,credit:0},participants:[]}})}));
  await page.route(`**/dolend-api/v1/events/${eventId}/invites`,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:route.request().method()==='POST'?{id:inviteId,token:inviteToken,created_at:'2026-11-03T10:00:00Z',expires_at:expiresAt,revoked_at:null}:[]})}));
  await page.route(`**/dolend-api/v1/invites/${inviteId}/revoke`,route=>{revoked=true;return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:{id:inviteId,created_at:'2026-11-03T10:00:00Z',expires_at:expiresAt,revoked_at:'2026-11-03T11:00:00Z'}})});});
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
