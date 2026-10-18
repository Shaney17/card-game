import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { BASE_URL, E2E_ADMIN_PASSWORD, E2E_PORT } from './tests/e2e/env';

if (!existsSync(join(import.meta.dirname, 'apps/web/dist/index.html'))) {
  throw new Error('Chưa có bản build web (apps/web/dist). Chạy `pnpm build` trước `pnpm test:e2e`.');
}

// File SQLite tạm cho mỗi lần chạy: không đụng tới dữ liệu dev trong data/.
// Biến môi trường giữ cố định giá trị khi config được nạp lại trong worker.
process.env.E2E_DATA_FILE ??= join(tmpdir(), `chieu-bai-e2e-${process.pid}-${Date.now()}.db`);

/**
 * E2E chạy trên server thật phục vụ bản build web (cần `pnpm build` trước).
 * Mỗi game chỉ có một bàn cố định dùng chung nên các test chạy tuần tự, một worker.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    locale: 'vi-VN',
    // Tắt hiệu ứng (vd. nút rút bài nhấp nháy vô hạn) để thao tác click ổn định.
    contextOptions: { reducedMotion: 'reduce' },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm --filter @chieu-bai/server start',
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      PORT: String(E2E_PORT),
      ADMIN_PASSWORD: E2E_ADMIN_PASSWORD,
      DATA_FILE: process.env.E2E_DATA_FILE,
    },
  },
});
