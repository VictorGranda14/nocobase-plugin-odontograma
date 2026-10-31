import { defineConfig } from '@playwright/test';

// E2E contra una instancia NocoBase local preparada como indica e2e/README.md.
export default defineConfig({
  testDir: '.',
  testMatch: '*.e2e.mjs',
  timeout: 90_000,
  workers: 1,
  use: {
    baseURL: process.env.E2E_URL || 'http://localhost:13001',
    channel: 'chrome',
    headless: true,
    viewport: { width: 1440, height: 1000 },
    locale: 'es-ES',
  },
});
