import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { defineConfig, devices } from '@playwright/test';

const root = path.dirname(fileURLToPath(import.meta.url));
const admin = process.env.ADMIN_PATH || path.join(root, 'workspace/admin');
const web = process.env.WEB_PATH || path.join(root, 'workspace/web');
const locales = Object.keys(YAML.parse(fs.readFileSync(path.join(root, 'architecture/locales.yaml'), 'utf8')).languages);

export default defineConfig({
  outputDir: '.tools/playwright.academic.config-results',
  testDir: './tests/academic',
  timeout: 25_000,
  workers: 2,
  retries: 0,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:18791', trace: 'off', screenshot: 'only-on-failure' },
  projects: locales.flatMap(locale => [
    { name: `desktop-${locale}`, metadata: { locale }, use: { ...devices['Desktop Chrome'] } },
    { name: `mobile-${locale}`, metadata: { locale }, use: { ...devices['Pixel 7'] } },
  ]),
  webServer: [
    { command: 'pnpm run preview --port 18791', cwd: web, url: 'http://127.0.0.1:18791', reuseExistingServer: false, gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 } },
    { command: 'make preview', cwd: admin, env: { STUHELPER_PREVIEW_PORT: '18793' }, url: 'http://127.0.0.1:18793', reuseExistingServer: false, gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 } },
  ],
});
