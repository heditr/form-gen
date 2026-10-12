import { defineConfig } from '@playwright/test';

const port = 3456;
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: `npm run start -- --port ${port}`,
        url: `${baseURL}/demo`,
        reuseExistingServer: false,
        timeout: 120_000,
      },
});
