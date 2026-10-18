import { expect, test } from '@playwright/test';
import { closePlayers, handCards, joinTable, newPlayer, pressReady, waitForOne, type Player } from './helpers';

let players: Player[] = [];

test.afterAll(async () => {
  await closePlayers(players);
});

test('Mèo Nổ: hai người vào bàn, rút bài và chuyển lượt', async ({ browser }) => {
  players = [await newPlayer(browser, 'Mèo Mướp'), await newPlayer(browser, 'Mèo Mun')];
  for (const p of players) await joinTable(p, 'exploding-cats');
  for (const p of players) await pressReady(p);

  for (const p of players) await expect(handCards(p.page).first()).toBeVisible();
  const drawBtn = (p: Player) => p.page.getByRole('button', { name: 'Rút bài & kết thúc lượt' });

  const current = await waitForOne(players, (p) => drawBtn(p).isVisible());
  const next = players.find((p) => p !== current)!;
  await expect(next.page.locator('.cats-status').getByText(`Đến lượt ${current.nickname}.`)).toBeVisible();
  const before = await handCards(current.page).count();

  await drawBtn(current).click();

  // Rút trúng Mèo Nổ thì Gỡ Bom tự dùng và phải giấu bom lại trước khi hết lượt.
  const defuse = current.page.getByRole('dialog', { name: 'Giấu Mèo Nổ vào chồng bài' });
  const drewSafe = handCards(current.page).nth(before);
  await expect(drewSafe.or(defuse)).toBeVisible();
  if (await defuse.isVisible()) await defuse.getByRole('button', { name: 'Giấu bom' }).click();

  await expect(drawBtn(next)).toBeVisible();
  await expect(next.page.locator('.cats-me').getByText('Lượt của bạn')).toBeVisible();
  await expect(current.page.locator('.cats-status').getByText(`Đến lượt ${next.nickname}.`)).toBeVisible();
  await expect(drawBtn(current)).toHaveCount(0);
});
