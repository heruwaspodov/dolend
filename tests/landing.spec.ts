import { test, expect } from '@playwright/test';

test('landing renders reference sections, local assets and clear demo status', async ({ page }) => {
  const errors: string[] = [], failures: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', request => failures.push(request.url()));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: /Main bareng seru/ })).toBeVisible();
  await expect(page.getByText('Pendaftaran dan pembayaran belum dibuka.', { exact: false })).toBeVisible();
  for (const id of ['kategori', 'simulasi', 'cara-kerja', 'faq']) await expect(page.locator(`#${id}`)).toHaveCount(1);
  for (const image of await page.locator('img').all()) { await image.scrollIntoViewIfNeeded(); await expect.poll(() => image.evaluate(element => (element as HTMLImageElement).complete && (element as HTMLImageElement).naturalWidth > 0)).toBe(true); }
  await expect.poll(() => page.locator('img').evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByText(/400\+ Komunitas|Dipercaya Oleh Ratusan Organizer/)).toHaveCount(0);
  expect(errors).toEqual([]); expect(failures).toEqual([]);
});

test('calculator updates venue, schedule, rounded costs and DP balance', async ({ page }) => {
  await page.goto('/#simulasi');
  await page.getByLabel('Nama Tempat / Venue', { exact: true }).fill('Lapangan Teman');
  await page.getByLabel('Jadwal Main', { exact: true }).fill('Minggu, 08.00 WIB');
  await page.getByLabel('Total Biaya Venue (Rp)', { exact: true }).fill('100000');
  await page.getByLabel('Maksimal Kuota (Orang)', { exact: true }).fill('3');
  await expect(page.getByTestId('demo-preview-venue')).toHaveText('Lapangan Teman');
  await expect(page.getByTestId('demo-preview-schedule')).toHaveText('Minggu, 08.00 WIB');
  await expect(page.getByTestId('demo-per-person')).toHaveText('Rp 33.334');
  await page.getByRole('radio', { name: /DP 50% di Awal/ }).check();
  await expect(page.getByTestId('demo-dp')).toContainText('DP per orang: Rp 16.667');
  await expect(page.getByTestId('demo-dp')).toContainText('Sisa pelunasan: Rp 16.667');
});

test('sample payment statuses change capacity without exceeding the selected limit', async ({ page }) => {
  await page.goto('/#simulasi');
  await expect(page.getByTestId('demo-quota')).toHaveText('2 / 12 terisi');
  await page.getByRole('button', { name: 'Ubah status Rizky Pratama', exact: true }).click();
  await expect(page.getByTestId('demo-quota')).toHaveText('1 / 12 terisi');
  await page.getByRole('radio', { name: /Catat Bayar di Lokasi/ }).check();
  await expect(page.getByTestId('demo-quota')).toHaveText('3 / 12 terisi');
  await page.getByLabel('Maksimal Kuota (Orang)', { exact: true }).fill('2');
  await expect(page.getByTestId('demo-quota')).toHaveText('2 / 2 terisi');
  await expect(page.getByRole('button', { name: 'Ubah status Siti Aulia', exact: true })).toHaveCount(0);
});

test('invalid numeric inputs show validation instead of NaN or Infinity', async ({ page }) => {
  await page.goto('/#simulasi');
  await page.getByLabel('Maksimal Kuota (Orang)', { exact: true }).fill('0');
  await expect(page.locator('#simulasi').getByRole('alert')).toContainText('kuota antara 2–30');
  await expect(page.getByRole('button', { name: 'Salin Link', exact: true })).toBeDisabled();
  await expect(page.getByTestId('demo-per-person')).toHaveText('—');
  await page.getByLabel('Maksimal Kuota (Orang)', { exact: true }).fill('12');
  await page.getByLabel('Total Biaya Venue (Rp)', { exact: true }).fill('-5');
  await expect(page.locator('#simulasi').getByRole('alert')).toBeVisible();
  await page.getByLabel('Total Biaya Venue (Rp)', { exact: true }).fill('0');
  await expect(page.getByTestId('demo-per-person')).toHaveText('Rp 0');
  await expect(page.getByTestId('demo-quota')).toHaveText('3 / 12 terisi');
  await expect(page.getByText(/NaN|Infinity/)).toHaveCount(0);
});

test('category changes local preview imagery and FAQ explains deferred providers', async ({ page }) => {
  await page.goto('/#simulasi');
  await page.getByRole('button', { name: 'Studio Musik', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Studio Musik', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#simulasi img')).toHaveAttribute('src', '/images/landing/music.jpg');
  const question = page.locator('summary').filter({ hasText: 'Metode pembayaran apa saja yang didukung?' });
  await question.click();
  await expect(page.getByText('Belum ada pembayaran sungguhan pada versi ini.', { exact: false })).toBeVisible();
  await question.press('Space');
  await expect(page.getByText('Belum ada pembayaran sungguhan pada versi ini.', { exact: false })).not.toBeVisible();
});

test('copy creates a restorable demo link and WhatsApp stays an explicit share link', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const backendRequests: string[] = [];
  page.on('request', request => { if (request.url().includes('.supabase.co')) backendRequests.push(request.url()); });
  await page.goto('/#simulasi');
  await page.getByLabel('Nama Tempat / Venue', { exact: true }).fill('Studio Sore');
  await page.getByRole('button', { name: 'Studio Musik', exact: true }).click();
  await page.getByRole('radio', { name: /DP 50% di Awal/ }).check();
  await page.getByRole('button', { name: 'Salin Link', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Tautan simulasi berhasil disalin.');
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link).toMatch(/^https:\/\/dolend\.web\.app\/#simulasi\?demo=/);
  const share = await page.getByRole('link', { name: 'Bagikan simulasi ke WhatsApp' }).getAttribute('href');
  expect(share).toMatch(/^https:\/\/wa.me\/\?text=/);
  expect(decodeURIComponent(share!)).toContain('bukan undangan aktif');
  // A recipient opens the full shared URL in a fresh tab, including its initial fragment.
  const recipient = await context.newPage();
  await recipient.goto(`${new URL(page.url()).origin}/${new URL(link).hash}`);
  await expect(recipient.getByLabel('Nama Tempat / Venue', { exact: true })).toHaveValue('Studio Sore');
  await expect(recipient.getByRole('radio', { name: /DP 50% di Awal/ })).toBeChecked();
  await expect(recipient.getByRole('button', { name: 'Studio Musik', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await recipient.reload();
  await expect(recipient.getByLabel('Nama Tempat / Venue', { exact: true })).toHaveValue('Studio Sore');
  await recipient.close();
  expect(backendRequests).toEqual([]);
});

test('copy failure offers manual selection without claiming success', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('denied'); } } }));
  await page.goto('/#simulasi');
  await page.getByRole('button', { name: 'Salin Link', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Penyalinan otomatis tidak tersedia.');
  await expect(page.getByRole('status')).not.toContainText('berhasil disalin');
});

test('malformed shared configuration is ignored safely', async ({ page }) => {
  await page.goto('/#simulasi?demo=%7B%22venue%22%3A%22bad%22%7D');
  await expect(page.getByRole('status')).toContainText('Tautan simulasi tidak valid.');
  await expect(page.getByLabel('Nama Tempat / Venue', { exact: true })).toHaveValue('Pitch 9 Mini Soccer Arena');
});

test('navigation works with desktop links and mobile menu', async ({ page }, info) => {
  await page.goto('/');
  if (info.project.name === 'mobile') {
    const menu = page.getByRole('button', { name: 'Buka menu', exact: true });
    await menu.click();
    await expect(page.getByRole('button', { name: 'Tutup menu' })).toHaveAttribute('aria-expanded', 'true');
    await page.getByRole('navigation', { name: 'Navigasi mobile' }).getByRole('link', { name: 'FAQ', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Buka menu' })).toBeVisible();
  } else {
    await page.getByRole('navigation', { name: 'Navigasi utama' }).getByRole('link', { name: 'FAQ', exact: true }).click();
  }
  await expect(page).toHaveURL(/#faq$/);
  await expect(page.getByRole('heading', { name: 'Frequently Asked Questions' })).toBeInViewport();
});
