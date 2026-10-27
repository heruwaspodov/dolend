import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const { id } = JSON.parse(readFileSync('.firebase-preview-fixture.json', 'utf8')) as { id: string };
const eventUrl = `/event/?id=${id}`;

test('post-build event loads through runtime fetch and survives refresh', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const loaded = page.waitForResponse((response) => response.url().endsWith(`/__poc/events/${id}.json`) && response.ok());
  const response = await page.goto(eventUrl);
  expect(response?.status()).toBe(200);
  await loaded;
  await expect(page.getByRole('heading', { name: 'Jalan sore bareng Dolend' })).toBeVisible();
  await expect(page.getByText('Contoh pratinjau · bukan pendaftaran aktif')).toBeVisible();
  await expect(page.getByText('4 dari 12 peserta · 8 tempat tersisa')).toBeVisible();
  await expect(page.getByText('Zona waktu: Asia/Jakarta', { exact: false })).toBeVisible();
  expect(await page.getByRole('link', { name: 'Buka Google Maps' }).getAttribute('href')).toMatch(/^https:\/\/www.google.com\/maps/);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Jalan sore bareng Dolend' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('unknown event renders not found instead of a hosting 404', async ({ page }) => {
  const response = await page.goto('/event/?id=00000000-0000-0000-0000-000000000000');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Aktivitas tidak ditemukan' })).toBeVisible();
});

test('missing and malformed IDs never fetch event data', async ({ page }) => {
  const eventRequests: string[] = [];
  page.on('request', (request) => { if (request.url().includes('/__poc/events/')) eventRequests.push(request.url()); });
  for (const path of ['/event/', '/event/?id=not-a-uuid']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: 'Tautan aktivitas tidak valid' })).toBeVisible();
  }
  expect(eventRequests).toEqual([]);
});

test('loading, network error and retry recover using the same static shell', async ({ page }) => {
  let fail = true;
  await page.route(`**/__poc/events/${id}.json`, async (route) => {
    if (fail) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
    } else { await route.continue(); }
  });
  await page.goto(eventUrl);
  await expect(page.getByText('Memuat aktivitas…')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Aktivitas belum bisa dimuat' })).toBeVisible();
  fail = false;
  await page.getByRole('button', { name: 'Coba lagi' }).click();
  await expect(page.getByRole('heading', { name: 'Jalan sore bareng Dolend' })).toBeVisible();
});

test('auth callback shell loads and removes callback parameters', async ({ page }) => {
  const response = await page.goto('/auth/callback/?code=fixture-code#access_token=fixture-token');
  expect(response?.status()).toBe(200);
  await expect(page.getByText('Kembali ke Dolend', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/auth\/callback\/$/);
  await page.reload();
  await expect(page.getByText('Kembali ke Dolend', { exact: true })).toBeVisible();
});

test('payment return shell never treats query success as payment confirmation', async ({ page }) => {
  const response = await page.goto('/payment/?status=paid&success=true');
  expect(response?.status()).toBe(200);
  await expect(page.getByText('Status pembayaran belum tersedia.', { exact: false })).toBeVisible();
  await expect(page).toHaveURL(/\/payment\/$/);
  await page.reload();
  await expect(page.getByText('Konfirmasi pembayaran', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Beranda', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Main bareng seru/ })).toBeVisible();
});
