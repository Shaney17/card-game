import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createApp } from './app';

const here = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 3001);
const dataFile = process.env.DATA_FILE ?? resolve(here, '../../../data/chieu-bai.db');
const staticDir = process.env.STATIC_DIR ?? resolve(here, '../../web/dist');

if (!process.env.ADMIN_PASSWORD) {
  console.warn('[cảnh báo] Chưa đặt ADMIN_PASSWORD — chức năng cấu hình luật sẽ bị khoá.');
}

const app = createApp({
  dataFile,
  adminPassword: process.env.ADMIN_PASSWORD,
  corsOrigin: process.env.CORS_ORIGIN,
  staticDir,
});

app.http.listen(port, () => {
  console.log(`Chiếu Bài đang chạy tại http://localhost:${port}`);
});

const shutdown = async () => {
  await app.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
