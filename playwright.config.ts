import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://127.0.0.1:3100'
  },
  webServer: {
    command: 'node node_modules/nuxt/bin/nuxt.mjs dev --host 127.0.0.1 --port 3100 --dotenv .env.e2e-unused',
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: false,
    timeout: 120000,
    env: { DATABASE_URL: '' }
  }
})
