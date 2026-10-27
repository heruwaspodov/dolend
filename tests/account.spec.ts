import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('format nomor Indonesia menyatu tanpa mengirim OTP', async ({ page }) => {
  const otpRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/auth/v1/otp')) otpRequests.push(request.url());
  });
  await page.goto('/account/');
  await expect(page.getByText('Belum masuk. Login OTP belum diaktifkan.')).toBeVisible();

  for (const input of ['0812 3456 7890', '+62 812-3456-7890', '6281234567890']) {
    await page.getByLabel('Nomor WhatsApp Indonesia').fill(input);
    await page.getByRole('button', { name: 'Periksa format nomor' }).click();
    await expect(page.getByTestId('phone-normalized')).toHaveText('6281234567890');
  }
  expect(otpRequests).toEqual([]);
});

test('menolak nomor asing dan tetap aksesibel', async ({ page }) => {
  await page.goto('/account/');
  await page.getByLabel('Nomor WhatsApp Indonesia').fill('+65 9123 4567');
  await page.getByRole('button', { name: 'Periksa format nomor' }).click();
  await expect(page.locator('#phone-error')).toContainText('diawali 08, 62, atau +62');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});
