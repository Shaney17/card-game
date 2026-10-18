import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io as connect, type Socket } from 'socket.io-client';
import { EV, type Ack, type SessionInfo, type TableView } from '@chieu-bai/shared';
import { createApp, type App } from '../../src/app';

let app: App;
let url: string;
const clients: Socket[] = [];

beforeAll(async () => {
  app = createApp({ dataFile: ':memory:', adminPassword: 'mat-khau-test', tableOptions: { resultDisplayMs: 50 } });
  await new Promise<void>((r) => app.http.listen(0, r));
  url = `http://localhost:${(app.http.address() as AddressInfo).port}`;
});

afterAll(async () => {
  for (const c of clients) c.close();
  await app.close();
});

function client(token?: string): Promise<Socket> {
  const s = connect(url, { auth: { token }, transports: ['websocket'], forceNew: true });
  clients.push(s);
  return new Promise((r) => s.on('connect', () => r(s)));
}

const call = <T = unknown>(s: Socket, ev: string, payload?: unknown) =>
  new Promise<Ack<T>>((r) => s.emit(ev, payload, (res: Ack<T>) => r(res)));

function nextUpdate(s: Socket, pred: (v: TableView) => boolean = () => true): Promise<TableView> {
  return new Promise((r) => {
    const fn = (v: TableView) => {
      if (pred(v)) {
        s.off(EV.tableUpdate, fn);
        r(v);
      }
    };
    s.on(EV.tableUpdate, fn);
  });
}

describe('Realtime nhiều client', () => {
  it('hai người tham gia cùng bàn Sâm, nhận cùng trạng thái công khai, không thấy bài nhau', async () => {
    const a = await client();
    const b = await client();
    const spectator = await client();
    const ia = (await call<SessionInfo>(a, EV.hello)) as { ok: true; data: SessionInfo };
    const ib = (await call<SessionInfo>(b, EV.hello)) as { ok: true; data: SessionInfo };
    expect(ia.data.player.id).not.toBe(ib.data.player.id);

    expect((await call(a, EV.profile, { nickname: 'An Nhiên', avatar: 'meo-cam' })).ok).toBe(true);
    expect((await call(a, EV.profile, { nickname: 'x', avatar: 'meo-cam' })).ok).toBe(false);

    for (const s of [a, b, spectator]) await call(s, EV.tableWatch, { gameId: 'sam' });
    expect((await call(a, EV.tableJoin, { gameId: 'sam' })).ok).toBe(true);
    expect((await call(b, EV.tableJoin, { gameId: 'sam' })).ok).toBe(true);

    const startedA = nextUpdate(a, (v) => v.status === 'PLAYING');
    const startedB = nextUpdate(b, (v) => v.status === 'PLAYING');
    const startedS = nextUpdate(spectator, (v) => v.status === 'PLAYING');
    await call(a, EV.tableReady, { gameId: 'sam', ready: true });
    await call(b, EV.tableReady, { gameId: 'sam', ready: true });
    const [va, vb, vs] = await Promise.all([startedA, startedB, startedS]);

    expect(va.round!.id).toBe(vb.round!.id);
    const ra = va.round!.view as any;
    const rb = vb.round!.view as any;
    expect(ra.phase).toBe(rb.phase);
    expect(ra.myHand).toHaveLength(10);
    expect(rb.myHand).toHaveLength(10);
    // Không có lá nào của A xuất hiện trong dữ liệu gửi cho B hay khán giả
    const bPayload = JSON.stringify(vb);
    const sPayload = JSON.stringify(vs);
    for (const c of ra.myHand as string[]) {
      expect(bPayload.includes(`"${c}"`)).toBe(false);
      expect(sPayload.includes(`"${c}"`)).toBe(false);
    }
    expect(vs.you.seated).toBe(false);

    // Người không có quyền không đổi được luật
    const denied = await call(a, EV.adminConfig, { gameId: 'sam', config: { perCardPenalty: 1 } });
    expect(denied.ok).toBe(false);
    expect((await call(a, EV.adminLogin, { password: 'sai' })).ok).toBe(false);
    expect((await call(a, EV.adminLogin, { password: 'mat-khau-test' })).ok).toBe(true);
    expect((await call(a, EV.adminConfig, { gameId: 'sam', config: { perCardPenalty: 1 } })).ok).toBe(true);
  });

  it('kết nối lại bằng token cũ giữ nguyên danh tính và chỗ ngồi', async () => {
    const c1 = await client();
    const info = ((await call<SessionInfo>(c1, EV.hello)) as { ok: true; data: SessionInfo }).data;
    await call(c1, EV.tableWatch, { gameId: 'exploding-cats' });
    expect((await call(c1, EV.tableJoin, { gameId: 'exploding-cats' })).ok).toBe(true);
    c1.close();
    await new Promise((r) => setTimeout(r, 100));
    const view = app.tables.get('exploding-cats').view(info.player.id, false);
    expect(view.seats.find((s) => s.player.id === info.player.id)?.connected).toBe(false);

    const c2 = await client(info.token);
    const again = ((await call<SessionInfo>(c2, EV.hello)) as { ok: true; data: SessionInfo }).data;
    expect(again.player.id).toBe(info.player.id);
    const tv = ((await call<TableView>(c2, EV.tableWatch, { gameId: 'exploding-cats' })) as { ok: true; data: TableView }).data;
    expect(tv.you.seated).toBe(true);
    expect(tv.seats.find((s) => s.player.id === info.player.id)?.connected).toBe(true);
  });

  it('giới hạn tần suất sự kiện', async () => {
    const c = await client();
    const results = await Promise.all(Array.from({ length: 40 }, () => call(c, EV.hello)));
    expect(results.some((r) => !r.ok && r.code === 'RATE_LIMIT')).toBe(true);
  });

  it('REST công khai chỉ trả metadata và trạng thái bàn', async () => {
    const res = await fetch(`${url}/api/games`);
    const body = (await res.json()) as { games: { id: string; table: { tableId: string } }[] };
    expect(body.games.map((g) => g.table.tableId).sort()).toEqual(['exploding-cats-main-table', 'sam-main-table']);
  });
});
