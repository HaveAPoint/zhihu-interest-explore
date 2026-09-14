import { defineConfig } from 'playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  testDir: path.resolve(__dirname, 'tests/local-tree'),
  testMatch: /.*\.spec\.ts/,
  timeout: 30000,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    headless: false,
    trace: 'off',
  },
});
