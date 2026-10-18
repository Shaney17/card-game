/** Hằng số dùng chung giữa playwright.config.ts và các test. */
export const E2E_PORT = Number(process.env.E2E_PORT ?? 3001);
export const BASE_URL = `http://localhost:${E2E_PORT}`;
export const E2E_ADMIN_PASSWORD = 'e2e-admin';
