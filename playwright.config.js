import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: 'test_*.js',
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  use: {
    headless: true,
    baseURL: 'http://localhost:5111',
  },
  projects: [
    {
      name: 'smoke',
      testMatch: 'test_smoke.js',
      use: { baseURL: 'http://localhost:5111' },
    },
    {
      name: 'api-error',
      testMatch: 'test_api_error.js',
      use: { baseURL: 'http://localhost:5180' },
    },
  ],
});
