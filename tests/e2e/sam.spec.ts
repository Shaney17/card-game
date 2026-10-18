import { expect, test } from '@playwright/test';
import { adminConfig, closePlayers, handCards, handLabels, joinTable, newPlayer, pressReady, SocketClient, waitForOne, type Player } from './helpers';

// Một bàn Sâm cố định dùng chung cho cả file: các bước nối tiếp nhau.
test.describe.configure({ mode: 'serial' });

let players: Player[] = [];
let leader: Player;
let follower: Player;

test.beforeAll(async () => {
  // Tắt "ăn trắng" để ván không kết thúc ngay khi chia trúng bài tới trắng.
  await adminConfig('sam', { enableInstantWin: false });
});

test.afterAll(async () => {
  await closePlayers(players);
});

test('bàn Sâm từ chối người thứ 6: "Bàn đã đủ chỗ"', async ({ browser }) => {
  const bots: SocketClient[] = [];
  try {
    for (let i = 0; i < 5; i++) {
      const bot = await SocketClient.connect();
      bots.push(bot);
      await bot.setProfile(`Bot Lấp Chỗ ${i + 1}`);
      const r = await bot.join('sam');
      expect(r.ok, JSON.stringify(r)).toBe(true);
    }

    const sixth = await newPlayer(browser, 'Người Thứ Sáu');
    players.push(sixth);
    const { page } = sixth;
    await page.goto('/game/sam');
    await expect(page.getByLabel('Số người tại bàn')).toContainText('5/5 người');
    const full = page.getByRole('button', { name: 'Bàn đã đủ chỗ' });
    await expect(full).toBeVisible();
    await expect(full).toBeDisabled();
    await expect(page.getByText('Bàn đã đủ chỗ. Chờ ai đó rời bàn nhé.')).toBeVisible();

    // Server cũng từ chối nếu client cố gửi yêu cầu vào bàn.
    const extra = await SocketClient.connect();
    bots.push(extra);
    const r = await extra.join('sam');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('Bàn đã đủ chỗ');

    for (const bot of bots.slice(0, 5)) await bot.leave('sam');
    await expect(page.getByRole('button', { name: 'Tham gia bàn', exact: true })).toBeEnabled();
  } finally {
    bots.forEach((b) => b.close());
    await closePlayers(players);
    players = [];
  }
});

test('hai người sẵn sàng thì chia bài, mỗi người chỉ thấy 10 lá của mình', async ({ browser }) => {
  players = [await newPlayer(browser, 'Bánh Chưng'), await newPlayer(browser, 'Bánh Giầy')];
  for (const p of players) await joinTable(p, 'sam');
  for (const p of players) await pressReady(p);

  // Pha báo Sâm đầu ván: cả hai chọn không báo.
  for (const p of players) await p.page.getByRole('button', { name: 'Không báo' }).click();

  for (const p of players) await expect(handCards(p.page)).toHaveCount(10);
  const [a, b] = players;
  const handA = await handLabels(a.page);
  const handB = await handLabels(b.page);
  expect(new Set([...handA, ...handB]).size).toBe(20);

  for (const [me, other, otherHand] of [
    [a, b, handB],
    [b, a, handA],
  ] as const) {
    // Mặt bài duy nhất trong DOM là bài của chính mình (đối thủ chỉ hiện mặt sau/số lá).
    const faces = await me.page
      .locator('svg.card-svg[role="img"]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')).filter((l) => l !== 'Mặt sau lá bài'));
    expect(faces.sort()).toEqual((await handLabels(me.page)).sort());
    for (const label of otherHand) await expect(me.page.locator(`[aria-label="${label}"]`)).toHaveCount(0);
    await expect(me.page.locator('.sam-seat', { hasText: other.nickname })).toContainText('10 lá');
  }
});

test('đánh một lá hợp lệ, người kia thấy lá đó trên bàn', async () => {
  leader = await waitForOne(players, (p) => p.page.getByText('Lượt của bạn').isVisible());
  follower = players.find((p) => p !== leader)!;

  await leader.page.getByRole('button', { name: 'Gợi ý' }).click();
  const chosen = leader.page.getByRole('listbox', { name: 'Bài trên tay' }).getByRole('option', { selected: true });
  await expect(chosen).toHaveCount(1); // dẫn vòng: gợi ý lá rác nhỏ nhất
  const label = (await chosen.getAttribute('aria-label'))!;
  await leader.page.getByRole('button', { name: 'Đánh', exact: true }).click();

  await expect(handCards(leader.page)).toHaveCount(9);
  const trick = follower.page.locator('.sam-trick');
  await expect(trick.getByRole('img', { name: label, exact: true })).toBeVisible();
  await expect(trick).toContainText(`${leader.nickname}:`);
  await expect(follower.page.getByText('Lượt của bạn')).toBeVisible();
  await expect(follower.page.locator('.sam-seat', { hasText: leader.nickname })).toContainText('9 lá');
});

test('tải lại trang giữa ván vẫn giữ chỗ và hiện lại bài', async () => {
  const { page } = follower;
  const before = (await handLabels(page)).sort();
  expect(before).toHaveLength(10);

  await page.reload();

  await expect(handCards(page)).toHaveCount(10);
  expect((await handLabels(page)).sort()).toEqual(before);
  await expect(page.getByRole('button', { name: 'Tham gia bàn', exact: true })).toHaveCount(0);
  await expect(page.getByText('Lượt của bạn')).toBeVisible();
  await expect(page.getByLabel('Số người tại bàn')).toContainText('2/5 người');
  await expect(leader.page.locator('.sam-seat', { hasText: follower.nickname }).getByText('Mất kết nối')).toHaveCount(0);
});
