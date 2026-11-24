import { defineConfig, devices } from '@playwright/test'

// Set PREVIEW_PORT when 4173 is taken. --strictPort fails loudly instead of testing another server.
const port = Number(process.env.PREVIEW_PORT ?? 4173)
const storageTestPort = Number(process.env.STORAGE_TEST_PORT ?? 4174)

export default defineConfig({
  testDir: '.',
  testMatch: ['e2e/**/*.spec.ts', 'integration/**/*.spec.ts'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  failOnFlakyTests: !!process.env.CI,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      // Used by e2e tests
      command: `npm run build && npm run preview -- --port ${port} --strictPort`,
      url: `http://localhost:${port}`,
      reuseExistingServer: false,
      timeout: 120000,
    },
    {
      // Used by storage integration tests
      command: `npm run dev -- --host 127.0.0.1 --port ${storageTestPort} --strictPort`,
      url: `http://127.0.0.1:${storageTestPort}/integration/storage/index.html`,
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
})
