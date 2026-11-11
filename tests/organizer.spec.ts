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
  await page.route(`**/dolend-api/v1/events/${eventId}/share-link`, route => route.fulfill({ json: { data: { link: null, legacy_active: false } } }));
  await page.route('**/dolend-api/v1/activity-types', route => route.fulfill({ json: { data: [{ id: activityId, slug: 'badminton', name: 'Badminton' }] } }));
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
  await expect(page.getByRole('link', { name:/^Badminton Jumat/ })).toHaveAttribute('href', `/event/manage/?id=${eventId}`);
  const schedule = page.getByText('19.00–21.00', { exact: true });
  await expect(schedule).toBeVisible();
  await expect(page.getByRole('button', { name: 'Aksi untuk Badminton Jumat' })).toHaveText('Aksi');
  const tableRegion = page.getByRole('region', { name: 'Tabel event' });
  expect(await tableRegion.evaluate(region => region.scrollWidth <= region.clientWidth)).toBeTruthy();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.route(`**/dolend-api/v1/organizer/events/${eventId}`, route => route.fulfill({ json: { data: publicEvent } }));
  // The row link overlays the schedule, so click its coordinates to verify the row hit area.
  await schedule.click({ force: true });
  await expect(page).toHaveURL(`/event/manage/?id=${eventId}`);
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
  const second = { ...publicEvent, id: workspaceId, title: 'Aerobik Sabtu', visibility: 'public', status: 'completed', ends_at: '2026-11-07T01:00:00+07:00' };
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
  await expect(rows.first()).toContainText('s.d. 7 Nov 2026, 01.00');
  await page.getByRole('button', { name: 'Event', exact: true }).click();
  await expect(rows.first()).toContainText('Badminton Jumat');
  await expect(page.getByRole('columnheader', { name: 'Event', exact: true })).toHaveAttribute('aria-sort', 'descending');
  await page.getByRole('button', { name: 'Event', exact: true }).click();
  await expect(rows.first().getByRole('link', { name: /^Aerobik Sabtu/ })).toHaveAttribute('href', `/event/manage/?id=${workspaceId}`);
  const aerobikActions = rows.first().getByRole('button', { name: 'Aksi untuk Aerobik Sabtu' });
  await aerobikActions.press('Enter');
  await expect(page.getByRole('menuitem', { name: 'Lihat event' })).toHaveAttribute('href', `/event/?id=${workspaceId}`);
  await page.keyboard.press('Escape');
  await expect(aerobikActions).toBeFocused();
  const statusPicker = page.getByRole('combobox', { name: 'Status', exact: true });
  await statusPicker.click();
  await expect(page.getByText('Cari pilihan…', { exact: true })).toBeVisible();
  await statusPicker.fill('Mencari');
  await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(1);
  await page.getByRole('option', { name: 'Mencari peserta', exact: true }).click();
  await expect(rows).toHaveCount(1);
  await page.getByLabel('Cari event').fill('Tidak cocok');
  await expect(page.getByText('Tidak ada event yang cocok')).toBeVisible();
  await page.getByLabel('Cari event').fill('badminton');
  await page.getByText('Kolom', { exact: true }).click();
  await page.getByRole('checkbox', { name: 'Venue' }).check();
  await expect(page.getByRole('columnheader', { name: 'Venue' })).toBeVisible();
  await page.getByText('Kolom', { exact: true }).click();
  await rows.first().getByRole('button', { name: 'Aksi untuk Badminton Jumat' }).click();
  await page.getByRole('menuitem', { name: 'Arsipkan' }).click();
  await expect(page.getByText('Event dipindahkan ke arsip.')).toBeVisible();
  await page.getByRole('button', { name: 'Arsip', exact: true }).click();
  await expect(rows).toHaveCount(1);
  await rows.first().getByRole('button', { name: 'Aksi untuk Badminton Jumat' }).click();
  await page.getByRole('menuitem', { name: 'Pulihkan' }).click();
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
    await pageSize.click();
    await page.getByRole('option', { name: String(size), exact: true }).click();
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
  await page.route('**/dolend-api/v1/activity-types', route => route.fulfill({ status:200, contentType:'application/json', body:JSON.stringify({data:[{id:activityId,slug:'badminton',name:'Badminton'},{id:eventId,slug:'football',name:'Football / Futsal'}]}) }));
  await page.route('**/dolend-api/v1/events', async route => { if (route.request().method() !== 'POST') return route.fallback(); created=route.request().postDataJSON(); await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:{id:eventId}})}); });
  await page.goto('/event/create/');
  await page.getByRole('radio', { name: 'Football / Futsal' }).check();
  await page.getByLabel('Nama event').fill('Badminton Jumat');
  await page.getByLabel('Mulai').fill('2026-11-06T19:00');
  await page.getByLabel('Selesai').fill('2026-11-06T21:00');
  await page.getByLabel('Pendaftaran ditutup').fill('2026-11-05T19:00');
  await page.getByLabel('Perkiraan biaya total (Rp)').fill('240000');
  await page.getByRole('button', { name:'Buat event' }).click();
  await expect(page).toHaveURL(`/event/manage/?id=${eventId}`);
  expect(created?.activity_type_id).toBe(eventId);
  expect(created?.venue_snapshot).toBeUndefined();
  expect(created?.starts_at).toBe('2026-11-06T19:00:00+07:00');
  expect(created?.payment_timing).toBe('before_event');
  expect(created?.visibility).toBe('unlisted');
});

test('organizer membuat satu tautan dan menyalinnya setelah reload',async({page,context})=>{
  await context.grantPermissions(['clipboard-read','clipboard-write']);
  await withSession(page);
  const inviteId='99999999-9999-4999-8999-999999999999';
  const inviteToken='i'.repeat(43);
  const expiresAt = new Date(Date.now() + 86_400_000).toISOString();
  let creates = 0;
  let status = 'recruiting';
  const link = { id: inviteId, token: inviteToken, expires_at: expiresAt };
  await page.route('**/dolend-api/v1/organizer/events?view=active', route => route.fulfill({ json: { data: [{ ...publicEvent, status }] } }));
  await page.route(`**/dolend-api/v1/organizer/events/${eventId}`, route => route.fulfill({ json: { data: { ...publicEvent, status } } }));
  await page.route(`**/dolend-api/v1/events/${eventId}/planning`, route => {
    expect(route.request().postDataJSON()).toEqual({ expected_version: publicEvent.version, status: 'confirmed' });
    status = 'confirmed';
    return route.fulfill({ json: { data: { ...publicEvent, status } } });
  });
  await page.route(`**/dolend-api/v1/events/${eventId}/roster`,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:{estimated_total_cost:240000,contributions_locked_at:null,payment_timing:'before_event',estimated_per_person:null,summary:{charged:0,received:0,refunded:0,adjustments:0,outstanding:0,credit:0},participants:[]}})}));
  await page.route(`**/dolend-api/v1/events/${eventId}/invites`, route => {
    creates++;
    return route.fulfill({ json: { data: link } });
  });
  await page.route(`**/dolend-api/v1/events/${eventId}/share-link`, route => route.fulfill({ json: { data: { link: creates ? link : null, legacy_active: !creates } } }));
  await page.goto(`/event/manage/?id=${eventId}`);
  await expect(page.getByText('Konfirmasi event terlebih dahulu agar bisa dibagikan.')).toBeVisible();
  const stage = page.getByRole('region', { name: 'Tahap event' });
  await expect(stage.getByRole('button', { name: 'Konfirmasi event' })).toBeVisible();
  await expect(stage.getByRole('button', { name: 'Tandai selesai' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Buat tautan/ })).toHaveCount(0);
  await page.goto('/dashboard/events/');
  const eventRow = page.getByRole('row', { name: /Badminton Jumat/ });
  const eventActions = eventRow.getByRole('button', { name: 'Aksi untuk Badminton Jumat' });
  await eventActions.click();
  await expect(page.getByRole('menuitem', { name: 'Bagikan event' })).toHaveCount(0);
  await page.getByRole('menuitem', { name: 'Konfirmasi event' }).click();
  await expect(eventRow.getByText('Terkonfirmasi')).toBeVisible();
  await eventActions.click();
  await page.getByRole('menuitem', { name: 'Bagikan event' }).click();
  await expect(page).toHaveURL(`/event/manage/?id=${eventId}#share-event-title`);
  await expect(stage.getByRole('button', { name: 'Tandai selesai' })).toBeVisible();
  await page.getByRole('button',{name:'Buat tautan pengganti'}).click();
  const expected=`${page.url().split('/event/manage/')[0]}/event/?id=${eventId}#invite=${inviteToken}`;
  await expect(page.getByLabel('Tautan yang dibagikan')).toHaveValue(expected);
  await page.reload();
  await expect(page.getByLabel('Tautan yang dibagikan')).toHaveValue(expected);
  await expect(page.getByRole('button', { name: /Buat tautan/ })).toHaveCount(0);
  await expect(page.getByText('Riwayat undangan')).toHaveCount(0);
  expect(creates).toBe(1);
  await page.getByRole('button',{name:'Salin tautan'}).click();
  expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe(expected);
});

test('venue workspace tetap bisa dipakai saat pencarian luar mencapai batas', async ({ page }) => {
  await withSession(page);
  const venue = {
    id: '77777777-7777-4777-8777-777777777777', name: 'GOR Uji', address: 'Jalan Uji',
    city: 'Jakarta', maps_url: '', latitude: -6.2, longitude: 106.8,
    source: 'geoapify', place_id: 'fixture-place', source_attribution: '© OpenStreetMap contributors',
  };
  let saved = false;
  let requests = 0;
  await page.route('https://tiles.openfreemap.org/styles/liberty', route => route.fulfill({
    headers: { 'access-control-allow-origin': '*' },
    json: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#e8f3fd' } }] },
  }));
  await page.route('**/dolend-api/v1/organizer/workspaces', route => route.fulfill({ json: { data: [{ id: workspaceId, name: 'Workspace Host', role: 'owner' }] } }));
  await page.route(`**/dolend-api/v1/organizer/workspaces/${workspaceId}/venues**`, route => {
    if (route.request().method() === 'POST') {
      expect(route.request().postDataJSON()).toMatchObject({ name: 'GOR Uji', latitude: -6.2, longitude: 106.8, place_id: 'fixture-place' });
      saved = true;
      return route.fulfill({ json: { data: { saved: true } } });
    }
    return route.fulfill({ json: { data: saved ? [venue] : [] } });
  });
  await page.route(`**/dolend-api/v1/organizer/workspaces/${workspaceId}/venue-suggestions?*`, route => {
    requests++;
    return route.fulfill({ json: { data: saved ? { status: 'limited', venues: [] } : { status: 'ok', venues: [venue] } } });
  });
  await page.goto('/event/create/');
  const search = page.getByRole('searchbox', { name: 'Cari venue' });
  await search.fill('GOR Uji');
  await expect(page.getByText('Belum ada venue yang cocok di workspace.')).toBeVisible();
  expect(requests).toBe(0);
  await page.getByRole('button', { name: 'Cari di peta', exact: true }).click();
  await page.getByRole('button', { name: /GOR Uji/ }).click();
  await expect(page.getByLabel('Nama tempat')).toHaveValue('GOR Uji');
  await expect(page.getByLabel('Latitude')).toHaveValue('-6.2');
  await page.getByRole('button', { name: 'Simpan ke venue workspace' }).click();
  await expect(page.getByText('Venue tersimpan di workspace dan bisa dipakai lagi.')).toBeVisible();
  await page.reload();
  await search.fill('GOR Uji');
  await expect(page.getByText('Venue di workspace', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cari di peta', exact: true }).click();
  await expect(page.getByText(/Batas pencarian di luar area peta tercapai/)).toBeVisible();
  await page.getByRole('button', { name: /GOR Uji/ }).click();
  await expect(page.getByLabel('Alamat')).toHaveValue('Jalan Uji');
  await page.getByRole('button', { name: 'Pin titik kumpul' }).click();
  await expect(page.getByText(/Titik kumpul dipilih/)).toBeVisible();
  await expect(page.getByLabel('Latitude')).toHaveValue('-6.2');
  await expect(page.getByLabel('Longitude')).toHaveValue('106.8');
});

test('Buat Event memakai pencarian peta dari tampilan lebar ketika API venue gagal', async ({ page, context }) => {
  await withSession(page);
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: -7.922, longitude: 112.653 });
  await page.route('**/dolend-api/v1/organizer/workspaces', route => route.fulfill({
    json: { data: [{ id: workspaceId, name: 'Workspace Host', role: 'owner' }] },
  }));
  await page.route(`**/dolend-api/v1/organizer/workspaces/${workspaceId}/venues?*`, route => route.fulfill({ status: 404, json: {} }));
  await page.route(`**/dolend-api/v1/organizer/workspaces/${workspaceId}/venue-suggestions?*`, route => route.fulfill({ status: 404, json: {} }));
  await page.route(`**/dolend-api/v1/organizer/workspaces/${workspaceId}/venue-address?*`, route => route.fulfill({
    json: { data: { status: 'unavailable', venues: [] } },
  }));
  await page.route('https://tiles.openfreemap.org/styles/liberty', route => route.fulfill({
    headers: { 'access-control-allow-origin': '*' },
    json: { version: 8, sources: { fixtures: { type: 'geojson', data: {
      type: 'Feature', properties: { name: 'Unggul Sports Center' },
      geometry: { type: 'Point', coordinates: [112.655268, -7.918495] },
    } } }, layers: [{ id: 'poi_fixture', type: 'circle', minzoom: 14, source: 'fixtures', paint: { 'circle-radius': 8 } }] },
  }));

  await page.goto('/event/create/');
  const location = page.getByRole('region', { name: 'Lokasi', exact: true });
  const search = location.getByRole('searchbox', { name: 'Cari venue' });
  await search.fill('Unggul Sport Center');
  await expect(location.getByText('Venue workspace belum bisa dimuat.')).toBeVisible();
  await location.getByRole('button', { name: 'Cari di peta', exact: true }).click();
  await expect(location.getByRole('searchbox')).toHaveCount(1);
  await expect(location.getByRole('button', { name: 'Cari di luar Dolend' })).toHaveCount(0);
  await expect(location.getByText(/Pencarian di luar area peta belum tersedia/)).toBeVisible();
  await location.getByRole('button', { name: 'Unggul Sports Center', exact: true }).click();
  await expect(location.getByLabel('Nama tempat')).toHaveValue('Unggul Sports Center');
  await expect.poll(async () => Number(await location.getByLabel('Latitude').inputValue())).toBeCloseTo(-7.918495, 4);
  await expect.poll(async () => Number(await location.getByLabel('Longitude').inputValue())).toBeCloseTo(112.655268, 4);
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
  await page.getByText('Koordinat dan kode area', { exact: true }).click();
  await page.getByLabel('Latitude').fill('-6.2');
  await page.getByLabel('Longitude').fill('106.816666');
  await page.getByLabel('Kode area umum untuk rekomendasi').fill('id-jk');
  await page.getByLabel('Petunjuk bertemu').fill('Tunggu di lobi utama.');
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.getByRole('button',{name:'Buat event'}).click();
  await expect(page).toHaveURL(`/event/manage/?id=${eventId}`);
  expect(created).toMatchObject({cost_model:'dynamic',payment_timing:'before_event'});
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
  await page.getByRole('radio', { name: 'Setelah event', exact: true }).check();
  await page.getByRole('radio', { name: 'Gratis', exact: true }).check();
  await expect(page.getByRole('group', { name: 'Waktu pembayaran' })).toHaveCount(0);
  await page.getByRole('radio', { name: 'Patungan harga tetap', exact: true }).check();
  await expect(page.getByRole('radio', { name: 'Setelah event', exact: true })).toBeChecked();
  await page.getByLabel('Harga per peserta (Rp)').fill('50000');await page.getByLabel('Rekening penerima').click();await page.getByRole('option', { name: 'BCA Host', exact: true }).click();await page.getByLabel('Jatuh tempo pembayaran').fill('2026-11-07T21:00');
  await page.getByLabel('Nama tempat').fill('GOR Jakarta');await page.getByLabel('Alamat').fill('Jakarta Pusat');
  await page.getByRole('button',{name:'Buat event'}).click();await expect(page).toHaveURL(`/event/manage/?id=${eventId}`);
  expect(created).toMatchObject({cost_model:'fixed',payment_timing:'after_event',price_amount:50000,payment_due_at:'2026-11-07T21:00:00+07:00',payment_method_id:bankMethodId});
  expect(created?.estimated_total_cost).toBeUndefined();
});

test('ruang kelola memuat roster dan membuat tautan guest satu kali', async ({ page }) => {
  await withSession(page);
  const token = 'a'.repeat(43);
  let cancellation: Record<string, unknown> | undefined;
  let eventStatus = 'recruiting';
  const guestId = '77777777-7777-4777-8777-777777777777';
  const replacementToken = 'r'.repeat(43);
  const participants = [
    { id: guestId, status: 'confirmed', chargeable: true, is_guest: true, users: { display_name: 'Rani' }, participant_charges: [] },
    ...Array.from({ length: 10 }, (_, index) => ({ id: `fixture-${index}`, status: 'confirmed', chargeable: true, is_guest: false, users: { display_name: `Anggota ${index + 1}` }, participant_charges: [] })),
  ];
  await page.route(`**/dolend-api/v1/organizer/events/${eventId}`, route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:{...publicEvent,status:eventStatus}})}));
  await page.route(`**/dolend-api/v1/events/${eventId}/roster`, route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:{estimated_total_cost:240000,contributions_locked_at:null,payment_timing:'before_event',estimated_per_person:240000,summary:{charged:0,received:0,refunded:0,adjustments:0,outstanding:0,credit:0},participants}})}));
  await page.route(`**/dolend-api/v1/participants/${guestId}/guest-token`, route => route.fulfill({ json: { data: { booking_token: replacementToken } } }));
  await page.route(`**/dolend-api/v1/events/${eventId}/participants`, route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:{participant_id:'88888888-8888-4888-8888-888888888888',booking_token:token}})}));
  await page.route('**/dolend-api/v1/participants/77777777-7777-4777-8777-777777777777/cancel', async route => { cancellation=route.request().postDataJSON(); await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:{ok:true}})}); });
  await page.route(`**/dolend-api/v1/events/${eventId}/cancel`, async route => { eventStatus='cancelled'; await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:null})}); });
  await page.goto(`/event/manage/?id=${eventId}`);
  await expect(page.getByRole('heading', { name:'Daftar peserta' })).toBeVisible();
  const table = page.getByRole('table', { name: 'Daftar peserta' });
  await expect(table.getByRole('columnheader', { name: 'Tagihan' })).toBeVisible();
  await expect(table.getByRole('row', { name: /Rani/ }).getByText('Belum ada tagihan')).toBeVisible();
  await expect(table.getByRole('row')).toHaveCount(11);
  await page.getByRole('button', { name: 'Halaman peserta berikutnya' }).click();
  await expect(table.getByRole('rowheader', { name: /Anggota 10/ })).toBeVisible();
  await page.getByRole('button', { name: 'Halaman peserta sebelumnya' }).click();
  await expect(table.getByRole('rowheader', { name: /Rani/ })).toBeVisible();
  await page.getByLabel('Nama peserta').fill('Budi');
  await page.getByLabel('Nomor WhatsApp').fill('081234567890');
  await page.getByRole('button', { name:'Tambahkan peserta' }).click();
  await expect(page.getByText(new RegExp(`#booking=${token}`))).toBeVisible();
  await expect(table.getByRole('button', { name: 'Buat tautan pengganti' })).toHaveCount(0);
  await table.getByRole('button', { name: 'Tindakan peserta: Rani' }).click();
  await expect(table.getByText(/menonaktifkan tautan lama/)).toBeVisible();
  await table.getByRole('button', { name: 'Buat tautan pengganti' }).click();
  await expect(table.getByLabel('Tautan booking pengganti')).toHaveValue(new RegExp(`#booking=${replacementToken}$`));
  await page.getByRole('textbox', { name:'Alasan', exact:true }).fill('Berhalangan hadir');
  await page.getByRole('button', { name:'Batalkan peserta' }).click();
  await expect(page.getByText('Peserta dibatalkan sesuai kebijakan yang dipilih.')).toBeVisible();
  expect(cancellation?.policy).toBe('waive');
  expect(cancellation?.reason).toBe('Berhalangan hadir');
  await page.locator('summary').filter({ hasText:'Batalkan event' }).click();
  await page.getByLabel('Alasan pembatalan').fill('Venue tidak tersedia');
  await page.getByRole('button', { name:'Batalkan event' }).click();
  await expect(page.getByText('Event dibatalkan. Riwayat peserta dan transaksi tetap tersimpan.')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Tahap event' }).getByText('dibatalkan', { exact: true })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('planning memperbarui snapshot venue lengkap', async ({page, context}) => {
  await withSession(page);
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: -7.92, longitude: 112.65 });
  await page.route('https://tiles.openfreemap.org/styles/liberty', route => route.fulfill({
    headers: { 'access-control-allow-origin': '*' },
    json: { version: 8, sources: { fixtures: { type: 'geojson', data: {
      type: 'Feature', properties: { name: 'Unggul Sports Center' },
      geometry: { type: 'Point', coordinates: [112.65, -7.92] },
    } } }, layers: [{ id: 'poi_fixture', type: 'circle', source: 'fixtures', paint: { 'circle-radius': 8 } }] },
  }));
  let planning:Record<string,unknown>|undefined;
  await page.route(`**/dolend-api/v1/organizer/events/${eventId}`, route => route.fulfill({ json: { data: { ...publicEvent, workspace_name: 'Workspace organizer', activity_type_slug: 'badminton' } } }));
  await page.route(`**/dolend-api/v1/events/${eventId}/roster`,route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:{estimated_total_cost:240000,contributions_locked_at:null,payment_timing:'before_event',estimated_per_person:null,summary:{charged:0,received:0,refunded:0,adjustments:0,outstanding:0,credit:0},participants:[]}})}));
  await page.route(`**/dolend-api/v1/events/${eventId}/planning`,async route=>{planning=route.request().postDataJSON();await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:{id:eventId}})});});
  await page.goto(`/event/manage/?id=${eventId}`);
  const basics = page.getByRole('region', { name: 'Dasar event' });
  await expect(basics.getByLabel('Workspace')).toHaveValue('Workspace organizer');
  await expect(basics.getByLabel('Workspace')).toHaveAttribute('readonly', '');
  await expect(basics.getByRole('radio', { name: 'Badminton' })).toBeChecked();
  await expect(basics.getByRole('radio', { name: 'Badminton' })).toBeDisabled();
  await expect(basics.getByLabel('Akses event')).toBeDisabled();
  await expect(basics.getByText('Hanya lewat undangan')).toBeVisible();
  await expect(basics.getByLabel('Deskripsi')).toHaveValue(publicEvent.description);
  const location = page.getByRole('region', { name: 'Lokasi', exact: true });
  await expect(location.getByText(/Pencarian workspace belum tersedia/)).toBeVisible();
  await location.getByRole('button', { name: 'Pilih titik di peta' }).click();
  await location.getByRole('searchbox', { name: 'Cari di area peta' }).fill('Unggul Sport Center');
  await location.getByRole('button', { name: 'Unggul Sports Center' }).click();
  await expect(location.getByLabel('Nama venue')).toHaveValue('Unggul Sports Center');
  await expect.poll(async () => Number(await location.getByLabel('Latitude').inputValue())).toBeCloseTo(-7.92, 4);
  await expect.poll(async () => Number(await location.getByLabel('Longitude').inputValue())).toBeCloseTo(112.65, 4);
  await location.getByRole('button', { name: 'Tutup peta' }).click();
  await page.getByLabel('Nama venue').fill('GOR Jakarta');
  await page.getByLabel('Nama event').fill('Badminton Sabtu');
  await page.getByRole('spinbutton', { name: 'Kapasitas (orang)' }).fill('16');
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
  expect(planning).not.toHaveProperty('workspace_id');
  expect(planning).not.toHaveProperty('activity_type_id');
  expect(planning).not.toHaveProperty('visibility');
});

test('peta Kelola Event memakai lokasi perangkat atau Malang saat koordinat kosong', async ({ page, context }) => {
  await withSession(page);
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: -6.2, longitude: 106.8 });
  await page.route(`**/dolend-api/v1/organizer/events/${eventId}`, route => route.fulfill({
    json: { data: { ...publicEvent, workspace_id: workspaceId } },
  }));
  await page.route(`**/dolend-api/v1/events/${eventId}/roster`, route => route.fulfill({
    json: { data: { estimated_total_cost: 240000, payment_timing: 'before_event', estimated_per_person: null,
      summary: { charged: 0, received: 0, refunded: 0, adjustments: 0, outstanding: 0, credit: 0 }, participants: [] } },
  }));
  await page.route('https://tiles.openfreemap.org/styles/liberty', route => route.fulfill({
    headers: { 'access-control-allow-origin': '*' },
    json: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#e8f3fd' } }] },
  }));

  let reverseRequests = 0;
  await page.route(`**/dolend-api/v1/organizer/workspaces/${workspaceId}/venue-address?*`, route => {
    reverseRequests++;
    const query = new URL(route.request().url()).searchParams;
    return route.fulfill({ json: { data: { status: 'ok', venues: [{
      name: 'Lapangan Peta', address: `Alamat hasil ${reverseRequests}`, city: 'Malang',
      latitude: Number(query.get('latitude')), longitude: Number(query.get('longitude')), maps_url: '',
      source: 'geoapify', place_id: null, source_attribution: '© OpenStreetMap contributors',
    }] } } });
  });

  const manageUrl = `/event/manage/?id=${eventId}`;
  const location = page.getByRole('region', { name: 'Lokasi', exact: true });
  const latitude = location.getByLabel('Latitude');
  const longitude = location.getByLabel('Longitude');
  async function usePoint() {
    const beforeOpen = reverseRequests;
    await location.getByRole('button', { name: 'Pilih titik di peta' }).click();
    const pin = location.getByRole('button', { name: 'Pin titik kumpul' });
    await expect(pin).toBeVisible();
    await expect(latitude).toHaveValue('');
    await expect(longitude).toHaveValue('');
    expect(reverseRequests).toBe(beforeOpen);
    await pin.press('Enter');
  }

  await page.goto(manageUrl);
  await expect(location.getByRole('searchbox', { name: 'Cari venue' })).toBeVisible();
  await usePoint();
  await expect(latitude).toHaveValue('-6.2');
  await expect(longitude).toHaveValue('106.8');
  await expect(location.getByLabel('Nama venue')).toHaveValue('Lapangan Peta');
  await expect(location.getByLabel('Alamat')).toHaveValue('Alamat hasil 1');
  await location.getByLabel('Nama venue').fill('Nama pilihan organizer');

  const pin = location.getByRole('button', { name: 'Pin titik kumpul' });
  const map = location.getByLabel('Peta titik kumpul');
  await pin.dragTo(map, { targetPosition: { x: 170, y: 160 } });
  await expect(latitude).not.toHaveValue('-6.2');
  await expect(longitude).not.toHaveValue('106.8');
  await expect(pin).toBeVisible();
  await expect(location.getByLabel('Nama venue')).toHaveValue('Nama pilihan organizer');
  await expect(location.getByLabel('Alamat')).toHaveValue('Alamat hasil 2');

  await page.addInitScript(() => {
    navigator.geolocation.getCurrentPosition = (_success, error) => {
      error?.({ code: 1, message: 'Permission denied', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 });
    };
  });
  await page.reload();
  await usePoint();
  await expect(latitude).toHaveValue('-7.98');
  await expect(longitude).toHaveValue('112.63');
  await expect(location.getByLabel('Alamat')).toHaveValue('Alamat hasil 3');
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
  const costs = page.getByRole('region', { name: 'Peserta dan biaya' });
  await expect(costs.getByText('Sisa tagihan', { exact: true }).locator('..').getByText(/140\.000/)).toBeVisible();
  const participant = costs.getByRole('table', { name: 'Daftar peserta' }).getByRole('row', { name: /Rani/ });
  await expect(participant.getByText(/Rp\s*240\.000/)).toBeVisible();
  await expect(participant.getByText(/Sisa Rp\s*140\.000/)).toBeVisible();
  await expect(page.getByRole('region', { name: 'Tahap event' }).getByText('Periksa sisa tagihan dan pengembalian dana.')).toBeVisible();
  await expect(page.getByRole('button', { name:'Tambahkan peserta' })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});
