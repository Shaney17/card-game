import { expect, test } from '@playwright/test';

test('trang chủ hiện 2 game chơi được và mục "Sắp ra mắt"', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Chiếu Bài', level: 1 })).toBeVisible();

  const grid = page.getByRole('region', { name: 'Danh sách game' });
  await expect(grid.getByRole('heading', { name: 'Sâm', exact: true })).toBeVisible();
  await expect(grid.getByRole('heading', { name: 'Mèo Nổ', exact: true })).toBeVisible();
  await expect(grid.getByRole('link', { name: 'Vào game Sâm' })).toHaveAttribute('href', '/game/sam');
  await expect(grid.getByRole('link', { name: 'Vào game Mèo Nổ' })).toHaveAttribute('href', '/game/exploding-cats');

  const soon = grid.getByRole('button', { name: 'Sắp ra mắt' });
  await expect(soon.first()).toBeVisible();
  await expect(soon.first()).toBeDisabled();

  // Phiên khách được tạo tự động qua socket.
  await expect(page.getByRole('button', { name: 'Sửa hồ sơ người chơi' })).toContainText('Khách');
});
