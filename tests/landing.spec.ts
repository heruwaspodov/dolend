import { test, expect } from '@playwright/test';

test('landing renders reference sections, local assets and clear demo status', async ({ page }) => {
  const errors: string[] = [], failures: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', request => failures.push(request.url()));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Main bareng, tinggal kirim undangan.' })).toBeVisible();
  const invitation = page.getByRole('article', { name: 'Badminton Sabtu pagi' });
  await expect(invitation.getByText('Contoh undangan')).toBeVisible();
  await expect(invitation.getByText('Kuota contoh, 5 dari 8 terisi')).toHaveCount(1);
  const hero = page.getByRole('region', { name: 'Main bareng, tinggal kirim undangan.' });
  await expect(hero.getByRole('link', { name: 'Buat undangan', exact: true })).toHaveAttribute('href', '/event/create/');
  const simulatorLink = hero.getByRole('link', { name: 'Hitung patungan', exact: true });
  await expect(simulatorLink).toHaveAttribute('href', '#simulasi');
  await simulatorLink.focus();
  await page.keyboard.press('Tab');
  const cost = page.getByLabel('Total biaya (Rp)', { exact: true });
  await expect(cost).toBeFocused();
  await expect(cost).toBeInViewport();
  await expect(cost).toHaveCSS('outline-style', 'solid');
  for (const id of ['kategori', 'simulasi', 'cara-kerja', 'faq']) await expect(page.locator(`#${id}`)).toHaveCount(1);
  for (const image of await page.locator('img:visible').all()) {
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate(element => (element as HTMLImageElement).complete && (element as HTMLImageElement).naturalWidth > 0)).toBe(true);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByText(/400\+ Komunitas|Dipercaya Oleh Ratusan Organizer/)).toHaveCount(0);
  expect(errors).toEqual([]); expect(failures).toEqual([]);
});

test('example quota starts at its final value when reduced motion is enabled', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const invitation = page.getByRole('article', { name: 'Badminton Sabtu pagi' });
  await expect(invitation.getByText('5', { exact: true })).toHaveCSS('opacity', '1');
  await expect(invitation.getByText('4', { exact: true })).toHaveCSS('opacity', '0');
});

test('calculator updates venue, schedule, rounded estimates, fixed prices and free events', async ({ page }) => {
  await page.goto('/#simulasi');
  await page.getByLabel('Total biaya (Rp)', { exact: true }).fill('100000');
  await page.getByLabel('Kuota peserta', { exact: true }).fill('3');
  await expect(page.getByTestId('demo-quick-total')).toHaveText('Rp 33.334');
  await expect(page.getByTestId('demo-quick-total')).toBeInViewport();
  await page.getByLabel('Jumlah peserta untuk estimasi').fill('2');
  await expect(page.getByTestId('demo-quick-total')).toHaveText('Rp 50.000');
  await page.getByLabel('Jumlah peserta untuk estimasi').fill('');
  await expect(page.getByLabel('Nama tempat', { exact: true })).toBeHidden();
  await page.getByText('Sesuaikan contoh undangan', { exact: true }).click();
  await page.getByLabel('Nama tempat', { exact: true }).fill('Lapangan Teman');
  await page.getByLabel('Jadwal main', { exact: true }).fill('Minggu, 08.00 WIB');
  await expect(page.getByTestId('demo-preview-venue')).toHaveText('Lapangan Teman');
  await expect(page.getByTestId('demo-preview-schedule')).toHaveText('Minggu, 08.00 WIB');
  await expect(page.getByTestId('demo-per-person')).toHaveText('Rp 33.334');
  await expect(page.getByTestId('demo-total')).toHaveText('Rp 100.000');
  await page.getByRole('radio', { name: 'Patungan harga tetap', exact: true }).check();
  await page.getByLabel('Harga per peserta (Rp)', { exact: true }).fill('40000');
  await expect(page.getByTestId('demo-per-person')).toHaveText('Rp 40.000');
  await expect(page.getByTestId('demo-total')).toHaveCount(0);
  await page.getByLabel('Kuota peserta', { exact: true }).fill('12');
  await expect(page.getByTestId('demo-per-person')).toHaveText('Rp 40.000');
  await page.getByRole('radio', { name: /^Gratis/ }).check();
  await expect(page.getByLabel('Harga per peserta (Rp)', { exact: true })).toHaveCount(0);
  await expect(page.getByTestId('demo-per-person')).toHaveText('Rp 0');
  await expect(page.getByRole('heading', { name: 'Pembayaran peserta contoh' })).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Waktu pembayaran' })).toHaveCount(0);
});

test('sample payment statuses change capacity without exceeding the selected limit', async ({ page }) => {
  await page.goto('/#simulasi');
  await page.getByText('Sesuaikan contoh undangan', { exact: true }).click();
  await page.getByRole('radio', { name: 'Patungan harga tetap', exact: true }).check();
  await expect(page.getByTestId('demo-quota')).toHaveText('2 / 12 terisi');
  await page.getByRole('button', { name: 'Ubah status Teman 1', exact: true }).click();
  await expect(page.getByTestId('demo-quota')).toHaveText('1 / 12 terisi');
  await page.getByRole('radio', { name: 'Setelah event', exact: true }).check();
  await expect(page.getByText('Ubah status pembayaran. Peserta tetap dihitung dalam kuota.')).toBeVisible();
  await page.getByRole('button', { name: 'Ubah status Teman 1', exact: true }).click();
  await expect(page.getByTestId('demo-quota')).toHaveText('3 / 12 terisi');
  await page.getByLabel('Kuota peserta', { exact: true }).fill('2');
  await expect(page.getByTestId('demo-quota')).toHaveText('2 / 2 terisi');
  await expect(page.getByRole('button', { name: 'Ubah status Teman 2', exact: true })).toHaveCount(0);
});

test('invalid numeric inputs show validation instead of NaN or Infinity', async ({ page }) => {
  await page.goto('/#simulasi');
  await page.getByLabel('Kuota peserta', { exact: true }).fill('0');
  await expect(page.locator('#simulasi').getByRole('alert')).toContainText('kuota antara 2–30');
  await expect(page.getByRole('button', { name: 'Salin tautan', exact: true })).toBeDisabled();
  await expect(page.getByTestId('demo-per-person')).toHaveText('—');
  await page.getByLabel('Kuota peserta', { exact: true }).fill('12');
  await page.getByLabel('Total biaya (Rp)', { exact: true }).fill('-5');
  await expect(page.locator('#simulasi').getByRole('alert')).toBeVisible();
  await page.getByLabel('Total biaya (Rp)', { exact: true }).fill('0');
  await expect(page.getByTestId('demo-per-person')).toHaveText('Rp 0');
  await expect(page.getByTestId('demo-quota')).toHaveText('3 / 12 terisi');
  await expect(page.getByText(/NaN|Infinity/)).toHaveCount(0);
});

test('category changes local preview imagery and FAQ explains manual payments', async ({ page }) => {
  await page.goto('/#simulasi');
  await page.getByText('Sesuaikan contoh undangan', { exact: true }).click();
  await page.getByRole('button', { name: 'Studio Musik', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Studio Musik', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#simulasi img')).toHaveAttribute('src', '/images/landing/music.jpg');
  const question = page.locator('summary').filter({ hasText: 'Bayarnya ke siapa?' });
  await question.click();
  await expect(page.getByText('Bayar langsung ke penyelenggara lewat transfer, QRIS statis, atau tunai', { exact: false })).toBeVisible();
  await question.press('Space');
  await expect(page.getByText('Bayar langsung ke penyelenggara lewat transfer, QRIS statis, atau tunai', { exact: false })).not.toBeVisible();
});

test('copy creates a restorable demo link and WhatsApp stays an explicit share link', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const backendRequests: string[] = [];
  page.on('request', request => { if (request.url().includes('.supabase.co')) backendRequests.push(request.url()); });
  await page.goto('/#simulasi');
  await page.getByText('Sesuaikan contoh undangan', { exact: true }).click();
  await page.getByLabel('Nama tempat', { exact: true }).fill('Studio Sore');
  await page.getByRole('button', { name: 'Studio Musik', exact: true }).click();
  await page.getByRole('radio', { name: 'Patungan harga tetap', exact: true }).check();
  await page.getByRole('radio', { name: 'Setelah event', exact: true }).check();
  await page.getByRole('button', { name: 'Salin tautan', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Tautan simulasi berhasil disalin.');
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link).toMatch(/^https:\/\/dolend\.web\.app\/#simulasi\?demo=/);
  const share = await page.getByRole('link', { name: 'Bagikan simulasi ke WhatsApp' }).getAttribute('href');
  expect(share).toMatch(/^https:\/\/wa.me\/\?text=/);
  expect(decodeURIComponent(share!)).toContain('bukan undangan aktif');
  // A recipient opens the full shared URL in a fresh tab, including its initial fragment.
  const recipient = await context.newPage();
  await recipient.goto(`${new URL(page.url()).origin}/${new URL(link).hash}`);
  await expect(recipient.getByTestId('demo-preview-venue')).toHaveText('Studio Sore');
  await recipient.getByText('Sesuaikan contoh undangan', { exact: true }).click();
  await expect(recipient.getByLabel('Nama tempat', { exact: true })).toHaveValue('Studio Sore');
  await expect(recipient.getByRole('radio', { name: 'Patungan harga tetap', exact: true })).toBeChecked();
  await expect(recipient.getByRole('radio', { name: 'Setelah event', exact: true })).toBeChecked();
  await expect(recipient.getByRole('button', { name: 'Studio Musik', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await recipient.reload();
  await expect(recipient.getByTestId('demo-preview-venue')).toHaveText('Studio Sore');
  await recipient.close();
  expect(backendRequests).toEqual([]);
});

test('copy failure offers manual selection without claiming success', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('denied'); } } }));
  await page.goto('/#simulasi');
  const manualLink = page.getByRole('textbox', { name: 'Tautan simulasi', exact: true });
  await expect(manualLink).toBeHidden();
  await page.getByRole('button', { name: 'Salin tautan', exact: true }).click();
  await expect(manualLink).toBeFocused();
  await expect(page.getByRole('status')).toContainText('Penyalinan otomatis tidak tersedia.');
  await expect(page.getByRole('status')).not.toContainText('berhasil disalin');
});

test('malformed shared configuration is ignored safely', async ({ page }) => {
  await page.goto('/#simulasi?demo=%7B%22venue%22%3A%22bad%22%7D');
  await expect(page.getByRole('status')).toContainText('Tautan simulasi tidak valid.');
  await expect(page.getByTestId('demo-preview-venue')).toHaveText('Pitch 9 Mini Soccer Arena');
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
  await expect(page.getByRole('heading', { name: 'Pertanyaan umum' })).toBeInViewport();
});

test('landing links to the existing account sign-in', async ({ page }) => {
  await page.goto('/');
  const signIn = page.getByRole('link', { name: 'Masuk', exact: true });
  await expect(signIn).toBeInViewport();
  await signIn.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/account\/$/);
});

test('older DP links open as fixed prices without treating deposits as full payments', async ({ page }) => {
  const demo = {
    category: 'soccer', venue: 'Lapangan Teman', schedule: 'Sabtu sore',
    cost: '100000', capacity: '3', policy: 'dp', paid: [true, true, false],
  };
  await page.goto(`/#simulasi?demo=${encodeURIComponent(JSON.stringify(demo))}`);
  await expect(page.getByTestId('demo-preview-venue')).toHaveText('Lapangan Teman');
  await expect(page.getByTestId('demo-per-person')).toHaveText('Rp 33.334');
  await expect(page.getByTestId('demo-quota')).toHaveText('0 / 3 terisi');
});
