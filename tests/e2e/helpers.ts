import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { io, type Socket } from 'socket.io-client';
import { BASE_URL, E2E_ADMIN_PASSWORD } from './env';

// Tên sự kiện realtime — trùng với EV trong packages/shared/src/protocol.ts.
const EV = {
  hello: 'session:hello',
  profile: 'session:profile',
  tableJoin: 'table:join',
  tableLeave: 'table:leave',
  adminLogin: 'admin:login',
  adminConfig: 'admin:config',
} as const;

type Ack<T = unknown> = { ok: true; data?: T } | { ok: false; error: string; code?: string };

export type GameId = 'sam' | 'exploding-cats';

export interface Player {
  nickname: string;
  context: BrowserContext;
  page: Page;
}

/** Mỗi browser context có localStorage riêng nên là một danh tính (token) riêng. */
export async function newPlayer(browser: Browser, nickname: string): Promise<Player> {
  const context = await browser.newContext();
  const page = await context.newPage();
  return { nickname, context, page };
}

export async function closePlayers(players: Player[]) {
  await Promise.all(players.map((p) => p.context.close()));
}

/** Mở bàn của game, bấm "Tham gia bàn"; lần đầu sẽ được hỏi biệt danh trước khi ngồi vào. */
export async function joinTable(p: Player, gameId: GameId) {
  const { page } = p;
  await page.goto(`/game/${gameId}`);
  await page.getByRole('button', { name: 'Tham gia bàn', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Đặt biệt danh trước khi vào bàn' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Biệt danh').fill(p.nickname);
  await dialog.getByRole('button', { name: 'Lưu hồ sơ' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'Rời bàn' }).first()).toBeVisible();
}

export async function pressReady(p: Player) {
  await p.page.getByRole('button', { name: 'Sẵn sàng', exact: true }).click();
}

export function handCards(page: Page) {
  return page.getByRole('listbox', { name: 'Bài trên tay' }).getByRole('option');
}

export async function handLabels(page: Page): Promise<string[]> {
  return handCards(page).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''));
}

/** Client Socket.IO "trần" (không có trình duyệt) — dùng để lấp chỗ hoặc làm quản trị. */
export class SocketClient {
  private constructor(private socket: Socket) {}

  static async connect(): Promise<SocketClient> {
    const socket = io(BASE_URL, { transports: ['websocket'], reconnection: false, forceNew: true });
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', () => resolve());
      socket.once('connect_error', reject);
    });
    const c = new SocketClient(socket);
    await c.expectOk(EV.hello);
    return c;
  }

  call<T = unknown>(event: string, payload?: unknown): Promise<Ack<T>> {
    return this.socket.timeout(5000).emitWithAck(event, payload);
  }

  async expectOk<T = unknown>(event: string, payload?: unknown): Promise<T | undefined> {
    const r = await this.call<T>(event, payload);
    if (!r.ok) throw new Error(`${event} thất bại: ${r.error}`);
    return r.data;
  }

  setProfile(nickname: string, avatar = 'meo-cam') {
    return this.expectOk(EV.profile, { nickname, avatar });
  }

  join(gameId: GameId) {
    return this.call(EV.tableJoin, { gameId });
  }

  leave(gameId: GameId) {
    return this.expectOk(EV.tableLeave, { gameId });
  }

  close() {
    this.socket.close();
  }
}

/** Đổi luật bàn qua kênh quản trị (chỉ áp dụng khi bàn chưa vào ván). */
export async function adminConfig(gameId: GameId, config: Record<string, unknown>) {
  const admin = await SocketClient.connect();
  try {
    await admin.expectOk(EV.adminLogin, { password: E2E_ADMIN_PASSWORD });
    await admin.expectOk(EV.adminConfig, { gameId, config });
  } finally {
    admin.close();
  }
}

/** Chờ tới khi đúng một người trong nhóm thoả điều kiện, trả về người đó. */
export async function waitForOne(players: Player[], isIt: (p: Player) => Promise<boolean>, timeout = 15_000): Promise<Player> {
  let found: Player | undefined;
  await expect
    .poll(
      async () => {
        const hits: Player[] = [];
        for (const p of players) if (await isIt(p)) hits.push(p);
        found = hits.length === 1 ? hits[0] : undefined;
        return hits.length;
      },
      { timeout },
    )
    .toBe(1);
  return found!;
}
