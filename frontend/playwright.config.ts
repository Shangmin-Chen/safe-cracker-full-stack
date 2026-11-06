import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://127.0.0.1:4210',
    reducedMotion: 'reduce',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['Pixel 7'], viewport: { width: 320, height: 720 } } },
  ],
  webServer: {
    command: 'npm start -- --host 127.0.0.1 --port 4210',
    url: 'http://127.0.0.1:4210',
    reuseExistingServer: !process.env['CI'],
  },
});
