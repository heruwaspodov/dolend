import { test, expect } from '@playwright/test';

test('demo create, join, full, dashboard, expired and refresh', async ({ page }) => {
  await page.goto('/demo/');
  await page.getByRole('button', { name: 'Dashboard', exact: true }).click();
  await expect(page.getByText('Belum ada aktivitas', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Buat rencana', exact: true }).click();
  await page.getByLabel('Nama aktivitas').fill('Badminton bareng');
  await page.getByLabel('Venue atau alamat').fill('GOR Jakarta');
  await page.getByLabel('Jadwal (WIB, UTC+7)').fill('2099-12-12T09:00');
  await page.getByLabel('Kapasitas termasuk host').fill('2');
  await page.getByRole('button', { name: 'Buat aktivitas demo', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Badminton bareng' })).toBeVisible();
  await expect(page.getByText(/^Rp\s*50\.000$/)).toBeVisible();
  await page.getByLabel('Nama panggilan demo').fill('Teman demo');
  await page.getByRole('button', { name: 'Gabung demo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sudah penuh', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Lihat dashboard', exact: true }).click();
  await expect(page.getByText('Teman demo', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Simulasikan berakhir', exact: true }).click();
  await page.getByRole('button', { name: 'Buka detail', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Aktivitas berakhir', exact: true })).toBeDisabled();
  await page.screenshot({ path: `.firebase/demo-${test.info().project.name}.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.reload();
  await page.getByRole('button', { name: 'Dashboard', exact: true }).click();
  await expect(page.getByText('Belum ada aktivitas', { exact: true })).toBeVisible();
});
