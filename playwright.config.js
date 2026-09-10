import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './tests/e2e', workers: 1, retries: 0, reporter: [['list'], ['html', { open: 'never' }]], use: { baseURL: 'http://127.0.0.1:3000', trace: 'on', screenshot: 'on', video: 'on' }, webServer: { command: 'node src/server.js', url: 'http://127.0.0.1:3000/health', reuseExistingServer: false } });
