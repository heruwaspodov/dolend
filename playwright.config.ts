import { defineConfig } from '@playwright/test';
const hosted = process.env.HOSTING_BASE_URL;
export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  expect: { timeout: 10000 },
  fullyParallel: true,
  workers: 2,
  reporter: 'list',
  use: {
    baseURL: hosted ?? 'http://127.0.0.1:4173',
    channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
    { name: 'mobile', use: { viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true } },
  ],
  webServer: hosted ? undefined : {
    command: 'python3 -m http.server 4173 --bind 127.0.0.1 --directory out',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    stdout: 'ignore',
    stderr: 'ignore',
  },
});
