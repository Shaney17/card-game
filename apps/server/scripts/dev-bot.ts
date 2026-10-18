/**
 * Bot dùng cho phát triển/kiểm thử thủ công: kết nối như một người chơi thật qua Socket.IO,
 * vào bàn và tự chơi đơn giản. KHÔNG phải tính năng của sản phẩm.
 *
 *   pnpm --filter @chieu-bai/server bot sam 2        # 2 bot vào bàn Sâm
 *   pnpm --filter @chieu-bai/server bot exploding-cats 3
 */
import { io } from 'socket.io-client';
import {
  canBeat,
  detectCombo,
  enumerateCombos,
  EV,
  type Ack,
  type CatsRoundView,
  type GameId,
  type SamRoundView,
  type TableView,
} from '@chieu-bai/shared';

const url = process.env.SERVER_URL ?? 'http://localhost:3001';
const gameId = (process.argv[2] ?? 'sam') as GameId;
const count = Number(process.argv[3] ?? 1);
const NAMES = ['Bot Bánh Bao', 'Bot Trà Sữa', 'Bot Xôi Gấc', 'Bot Phở Bò', 'Bot Chè', 'Bot Cốm', 'Bot Nem'];
const AVATARS = ['cho-shiba', 'gau-truc', 'tho-hong', 'cao-lua', 'ech-com', 'cu-meo', 'heo-dat'];

function startBot(i: number) {
  // Giữ token để khi kết nối lại (server khởi động lại) vẫn là cùng một người chơi.
  let token: string | undefined;
  const socket = io(url, { transports: ['websocket'], auth: (cb) => cb({ token }) });
  let busy = false;
  let lastKey = '';
  const call = (ev: string, payload?: unknown) => new Promise<Ack>((r) => socket.emit(ev, payload, r));
  const act = (view: TableView, type: string, payload: unknown = {}) =>
    call(EV.gameAction, {
      actionId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      gameId: view.gameId,
      tableId: view.tableId,
      roundId: view.round?.id ?? null,
      stateVersion: view.round?.stateVersion ?? 0,
      type,
      payload,
    });

  socket.on('connect', async () => {
    const hello = await call(EV.hello);
    if (hello.ok) token = (hello.data as { token: string }).token;
    await call(EV.profile, { nickname: NAMES[i % NAMES.length], avatar: AVATARS[i % AVATARS.length] });
    await call(EV.tableWatch, { gameId });
    const r = await call(EV.tableJoin, { gameId });
    console.log(`[bot ${i}] vào bàn:`, r.ok ? 'ok' : r.error);
  });

  let latest: TableView | null = null;
  socket.on(EV.tableUpdate, (view: TableView) => {
    latest = view;
    void pump();
  });

  /** Luôn xử lý trạng thái mới nhất, không bỏ lỡ lượt khi đang bận. */
  async function pump() {
    if (busy || !latest) return;
    const view = latest;
    const me = view.seats.find((s) => s.player.id === view.you.playerId);
    if (!me || `${view.version}` === lastKey) return;
    lastKey = `${view.version}`;
    busy = true;
    try {
      await new Promise((r) => setTimeout(r, 600 + Math.random() * 800));
      if (view.status !== 'PLAYING' && !me.ready && !me.waitingNextRound) {
        await call(EV.tableReady, { gameId, ready: true });
      } else if (view.round && view.status === 'PLAYING') {
        if (gameId === 'sam') await playSam(view, view.round.view as SamRoundView);
        else await playCats(view, view.round.view as CatsRoundView);
      }
    } finally {
      busy = false;
      if (latest !== view) void pump();
    }
  }

  async function playSam(view: TableView, r: SamRoundView) {
    const meId = view.you.playerId;
    if (r.phase === 'DECLARE' && r.mySamChoice === null && r.myHand) return act(view, 'declareSam', { declare: false });
    if (r.turnPlayerId !== meId || !r.myHand) return;
    const top = r.trick[r.trick.length - 1];
    const topCombo = top ? detectCombo(top.cards, r.rules) : null;
    const legal = enumerateCombos(r.myHand, r.rules)
      .filter((c) => !topCombo || canBeat(c, topCombo, r.rules).ok)
      .filter((c) => !(r.rules.lastCardTwo === 'forbidden' && c.hasTwo && c.length === r.myHand!.length))
      .sort((a, b) => a.value - b.value || b.length - a.length);
    if (legal.length && (!topCombo || Math.random() < 0.8)) return act(view, 'play', { cards: legal[0].cards });
    if (r.canPass) return act(view, 'pass');
  }

  async function playCats(view: TableView, r: CatsRoundView) {
    const meId = view.you.playerId;
    const p = r.pending;
    const hand = r.myHand ?? [];
    if (p?.kind === 'action' && p.canPass) {
      const nope = hand.find((c) => c.def === 'nope');
      if (nope && p.canNope && p.actorId !== meId && Math.random() < 0.3) return act(view, 'nope', { cardId: nope.id });
      return act(view, 'pass');
    }
    if (p?.kind === 'favor' && p.giverId === meId && hand.length) return act(view, 'giveFavor', { cardId: hand[0].id });
    if (p?.kind === 'defuse' && p.playerId === meId) return act(view, 'placeBomb', { position: Math.floor(Math.random() * (p.deckCount + 1)) });
    if (p?.kind === 'alter' && p.playerId === meId && p.cards) return act(view, 'alterFuture', { order: p.cards.map((c) => c.id) });
    const rnd = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
    if (p?.kind === 'steal_pick' && p.actorId === meId) return act(view, 'pickSteal', { index: Math.floor(Math.random() * p.slots.length) });
    if (p?.kind === 'implode_place' && p.playerId === meId) return act(view, 'placeImploding', { position: p.deckCount });
    if (p?.kind === 'bury' && p.playerId === meId) return act(view, 'buryCard', { position: Math.floor(Math.random() * (p.deckCount + 1)) });
    if (p?.kind === 'dig' && p.playerId === meId) return act(view, 'digChoice', { keep: p.topDef !== 'exploding' && p.topDef !== 'imploding' });
    const junk = hand.filter((c) => c.def !== 'defuse' && c.def !== 'streaking');
    if (p?.kind === 'garbage' && meId && p.waitingFor.includes(meId) && hand.length) return act(view, 'garbageCard', { cardId: rnd(junk.length ? junk : hand).id });
    if (p?.kind === 'potluck' && p.currentId === meId && hand.length) return act(view, 'potluckCard', { cardId: rnd(junk.length ? junk : hand).id });
    if (p || r.currentId !== meId) return;
    const others0 = r.players.filter((x) => x.alive && x.id !== meId);
    const passBomb = hand.find((c) => c.def === 'pass_bomb');
    if (passBomb && r.timeBombs.some((b) => b.holderId === meId) && others0.length) {
      return act(view, 'play', { cardIds: [passBomb.id], targetId: others0[Math.floor(Math.random() * others0.length)].id });
    }
    const takeThat = hand.find((c) => c.def === 'take_that');
    const free = others0.filter((x) => !r.claims.some((c) => c.targetId === x.id));
    if (takeThat && free.length && Math.random() < 0.3) return act(view, 'play', { cardIds: [takeThat.id], targetId: free[0].id });
    const simple = hand.filter((c) =>
      ['skip', 'attack', 'shuffle', 'see_future', 'super_skip', 'swap_top_bottom', 'garbage', 'potluck', 'bury', 'dig_deeper', 'catomic', 'reverse'].includes(c.def),
    );
    if (simple.length && Math.random() < 0.4) return act(view, 'play', { cardIds: [simple[Math.floor(Math.random() * simple.length)].id] });
    const others = r.players.filter((x) => x.alive && x.id !== meId && x.cardCount > 0);
    const byDef = new Map<string, string[]>();
    for (const c of hand) if (c.def.startsWith('cat_') || c.def === 'feral_cat') byDef.set(c.def, [...(byDef.get(c.def) ?? []), c.id]);
    const pair = [...byDef.values()].find((ids) => ids.length >= 2);
    if (pair && others.length && Math.random() < 0.5) return act(view, 'play', { cardIds: pair.slice(0, 2), targetId: others[0].id });
    return act(view, 'draw');
  }
}

for (let i = 0; i < count; i++) startBot(i);
