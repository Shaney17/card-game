import { CATS_CARD_BY_ID, type CatsPendingView, type CatsRoundView } from '@chieu-bai/shared';
import { z } from 'zod';
import {
  GameRuleError,
  type EngineContext,
  type EngineLog,
  type EngineResult,
  type GameEngine,
} from '../../game-registry/types';
import { shuffle } from '../../security/rng';
import { CATS_DEFAULT_CONFIG, parseCatsConfig, type CatsConfig } from './config';
import {
  aliveIds,
  cardName,
  checkHeldBombs,
  deckChanged,
  drawCard,
  eliminate,
  endOneTurn,
  event,
  insertAt,
  nameOf,
  nextAlive,
  removeFromHand,
  setTurn,
  transferCard,
} from './core';
import { buildAndDeal, copiesFor, enabledDefs, planDeck } from './deck';
import { EFFECTS } from './effects';
import type { CatsState, Pending, PlayIntent } from './state';

export const CATS_RULES_VERSION = 'meo-no-2.1.0';

const id = z.string().min(1).max(32);
const position = z.object({ position: z.number().int().min(0).max(500) }).strict();
const cardChoice = z.object({ cardId: id }).strict();
const schemas = {
  play: z.object({ cardIds: z.array(id).min(1).max(3), targetId: id.optional(), namedDef: id.optional() }).strict(),
  nope: cardChoice,
  pass: z.object({}).strict(),
  draw: z.object({}).strict(),
  giveFavor: cardChoice,
  placeBomb: position,
  placeImploding: position,
  alterFuture: z.object({ order: z.array(id).min(1).max(3) }).strict(),
  pickSteal: z.object({ index: z.number().int().min(0).max(200) }).strict(),
  garbageCard: cardChoice,
  potluckCard: cardChoice,
  buryCard: position,
  digChoice: z.object({ keep: z.boolean() }).strict(),
};

function parse<K extends keyof typeof schemas>(k: K, payload: unknown): z.infer<(typeof schemas)[K]> {
  const r = schemas[k].safeParse(payload ?? {});
  if (!r.success) throw new GameRuleError('Dữ liệu hành động không hợp lệ.', 'BAD_PAYLOAD');
  return r.data as z.infer<(typeof schemas)[K]>;
}

const clone = (s: CatsState) => structuredClone(s);

function requireAlive(s: CatsState, playerId: string) {
  const p = s.players[playerId];
  if (!p) throw new GameRuleError('Bạn không tham gia ván này.', 'NOT_IN_ROUND');
  if (!p.alive) throw new GameRuleError('Bạn đã bị loại khỏi ván này.');
  return p;
}

function requirePending<K extends Pending['kind']>(s: CatsState, kind: K, msg: string): Extract<Pending, { kind: K }> {
  if (!s.pending || s.pending.kind !== kind) throw new GameRuleError(msg);
  return s.pending as Extract<Pending, { kind: K }>;
}

/** Xác định loại lượt đánh từ các lá được chọn. */
function intentFrom(s: CatsState, actorId: string, payload: z.infer<typeof schemas.play>): PlayIntent {
  const p = s.players[actorId];
  if (new Set(payload.cardIds).size !== payload.cardIds.length) throw new GameRuleError('Lá bài bị trùng.');
  const cards = payload.cardIds.map((cid) => {
    const c = p.hand.find((h) => h.id === cid);
    if (!c) throw new GameRuleError('Bạn không có lá bài này.');
    return c;
  });
  const defs = cards.map((c) => CATS_CARD_BY_ID[c.def]);
  const base = { cards, targetId: payload.targetId ?? null, namedDef: payload.namedDef ?? null };
  if (cards.length === 1) {
    const d = defs[0];
    if (d.category === 'collection') throw new GameRuleError('Lá mèo sưu tập phải đánh theo cặp 2 hoặc 3 lá giống nhau.');
    if (d.effectType === 'nope') throw new GameRuleError('"Không!" chỉ dùng để chặn hành động vừa được đánh.');
    if (d.effectType === 'defuse') throw new GameRuleError('Gỡ Bom được dùng tự động khi bạn rút phải Mèo Nổ.');
    if (d.effectType === 'passive') throw new GameRuleError(`${d.name} có tác dụng khi nằm trên tay, không cần đánh.`);
    if (d.category === 'exploding') throw new GameRuleError('Không thể đánh lá này.');
    return { ...base, effect: d.effectType };
  }
  // Combo mèo: mọi lá là mèo sưu tập, các lá không phải Mèo Hoang phải giống hệt nhau.
  const nonFeral = defs.filter((d) => d.id !== 'feral_cat');
  if (!defs.every((d) => d.category === 'collection') || new Set(nonFeral.map((d) => d.id)).size > 1) {
    throw new GameRuleError('Combo phải gồm 2 hoặc 3 lá mèo giống nhau (Mèo Hoang thay được bất kỳ mèo nào).');
  }
  if (cards.length === 3 && payload.namedDef && !enabledDefs(s.config).some((d) => d.id === payload.namedDef)) {
    throw new GameRuleError('Lá bài được gọi tên không có trong bộ bài này.');
  }
  return { ...base, effect: 'cat_combo' };
}

function describePlay(s: CatsState, actorId: string, play: PlayIntent) {
  const actor = nameOf(s, actorId);
  const target = play.targetId ? ` vào ${nameOf(s, play.targetId)}` : '';
  if (play.effect === 'cat_combo') {
    const label = play.cards.map((c) => cardName(c.def)).join(' + ');
    return play.cards.length === 3 ? `${actor} đánh bộ ba ${label}${target}, đòi lá ${cardName(play.namedDef!)}.` : `${actor} đánh cặp ${label}${target}.`;
  }
  return `${actor} đánh ${cardName(play.cards[0].def)}${target}.`;
}

function resumeTurnClock(s: CatsState, now: number) {
  s.turnDeadline = now + s.config.turnTimeMs;
}

/** Hoàn tất cửa sổ "Không!": số lá "Không!" lẻ thì hành động bị hủy. */
function resolveAction(s: CatsState, ctx: EngineContext, logs: EngineLog[]) {
  const pending = s.pending;
  if (!pending || pending.kind !== 'action') return;
  s.pending = null;
  resumeTurnClock(s, ctx.now);
  if (pending.nopes.length % 2 === 1) {
    event(s, { type: 'cancel', actorId: pending.actorId, cardDefs: pending.cards.map((c) => c.def) });
    logs.push({ text: `Hành động của ${nameOf(s, pending.actorId)} đã bị chặn.`, kind: 'info', sfx: 'nope' });
    return;
  }
  if (!s.players[pending.actorId].alive) return;
  EFFECTS[pending.effect].resolve(s, pending.actorId, pending, ctx, logs);
  checkHeldBombs(s, ctx.now, logs);
}

/** Người cần bấm "Cho qua" để kết thúc sớm cửa sổ phản ứng. */
function requiredPassers(s: CatsState): string[] {
  if (!s.pending || s.pending.kind !== 'action') return [];
  const last = s.pending.nopes.length ? s.pending.nopes[s.pending.nopes.length - 1].playerId : s.pending.actorId;
  return aliveIds(s).filter((id) => id !== last);
}

function placeBomb(s: CatsState, pos: number, ctx: EngineContext, logs: EngineLog[]) {
  const pending = s.pending;
  if (!pending || pending.kind !== 'defuse') return;
  insertAt(s, pending.bomb, pos);
  s.pending = null;
  event(s, { type: 'defuse', actorId: pending.playerId });
  logs.push({ text: `${nameOf(s, pending.playerId)} đã bí mật nhét Mèo Nổ trở lại chồng bài.`, kind: 'info', sfx: 'place' });
  if (pending.endsTurn) endOneTurn(s, ctx.now, logs);
  else resumeTurnClock(s, ctx.now);
  checkHeldBombs(s, ctx.now, logs);
}

function placeImploding(s: CatsState, pos: number, ctx: EngineContext, logs: EngineLog[]) {
  const pending = s.pending;
  if (!pending || pending.kind !== 'implode_place') return;
  insertAt(s, { ...pending.card, faceUp: true }, pos);
  s.pending = null;
  const shown = Math.max(0, Math.min(pos, s.deck.length - 1));
  logs.push({
    text: `${nameOf(s, pending.playerId)} lật ngửa Mèo Sập Nguồn và đặt ở vị trí thứ ${shown + 1} từ trên xuống.`,
    kind: 'warn',
    sfx: 'place',
  });
  endOneTurn(s, ctx.now, logs);
}

function giveCard(s: CatsState, cardId: string, logs: EngineLog[], now: number) {
  const pending = s.pending;
  if (!pending || pending.kind !== 'favor') return;
  const card = transferCard(s, pending.giverId, pending.receiverId, cardId);
  s.pending = null;
  resumeTurnClock(s, now);
  event(s, { type: 'favor', actorId: pending.giverId, targetId: pending.receiverId });
  logs.push({ text: `${nameOf(s, pending.giverId)} đưa cho ${nameOf(s, pending.receiverId)} một lá.`, kind: 'play', sfx: 'steal' });
  logs.push({ text: `Bạn nhận được: ${cardName(card.def)}.`, kind: 'info', visibleTo: [pending.receiverId] });
  logs.push({ text: `Bạn đã đưa: ${cardName(card.def)}.`, kind: 'info', visibleTo: [pending.giverId] });
  checkHeldBombs(s, now, logs);
}

function pickSteal(s: CatsState, index: number, logs: EngineLog[], now: number) {
  const pending = s.pending;
  if (!pending || pending.kind !== 'steal_pick') return;
  s.pending = null;
  resumeTurnClock(s, now);
  const target = s.players[pending.targetId];
  const cardId = pending.order[index];
  if (!cardId || !target.hand.some((c) => c.id === cardId)) return;
  const card = transferCard(s, target.id, pending.actorId, cardId);
  event(s, { type: 'steal', actorId: pending.actorId, targetId: target.id });
  logs.push({ text: `${nameOf(s, pending.actorId)} rút lá thứ ${index + 1} trên tay ${target.nickname}.`, kind: 'warn', sfx: 'steal' });
  logs.push({ text: `Bạn lấy được: ${cardName(card.def)}.`, kind: 'info', visibleTo: [pending.actorId] });
  logs.push({ text: `Bạn bị lấy mất: ${cardName(card.def)}.`, kind: 'info', visibleTo: [target.id] });
  checkHeldBombs(s, now, logs);
}

function finishGarbage(s: CatsState, ctx: EngineContext, logs: EngineLog[]) {
  const pending = s.pending;
  if (!pending || pending.kind !== 'garbage') return;
  for (const [pid, cid] of Object.entries(pending.chosen)) {
    if (s.players[pid].alive && s.players[pid].hand.some((c) => c.id === cid)) s.deck.push(removeFromHand(s, pid, cid));
  }
  s.deck = shuffle(s.deck, ctx.rng);
  deckChanged(s);
  s.pending = null;
  resumeTurnClock(s, ctx.now);
  event(s, { type: 'shuffle' });
  logs.push({ text: `Đã xáo ${Object.keys(pending.chosen).length} lá rác vào chồng bài.`, kind: 'info', sfx: 'shuffle' });
  checkHeldBombs(s, ctx.now, logs);
}

function chooseGarbage(s: CatsState, playerId: string, cardId: string, ctx: EngineContext, logs: EngineLog[]) {
  const pending = s.pending;
  if (!pending || pending.kind !== 'garbage') return;
  pending.chosen[playerId] = cardId;
  pending.waiting = pending.waiting.filter((x) => x !== playerId);
  logs.push({ text: `${nameOf(s, playerId)} đã chọn lá bỏ đi.`, kind: 'info' });
  if (pending.waiting.length === 0) finishGarbage(s, ctx, logs);
}

function choosePotluck(s: CatsState, playerId: string, cardId: string, ctx: EngineContext, logs: EngineLog[]) {
  const pending = s.pending;
  if (!pending || pending.kind !== 'potluck') return;
  s.deck.unshift(removeFromHand(s, playerId, cardId));
  deckChanged(s);
  logs.push({ text: `${nameOf(s, playerId)} úp 1 lá lên chồng bài.`, kind: 'play', sfx: 'place' });
  pending.queue = pending.queue.slice(1).filter((id) => s.players[id].alive && s.players[id].hand.length > 0);
  pending.deadline = ctx.now + s.config.choiceTimeMs;
  if (pending.queue.length === 0) {
    s.pending = null;
    resumeTurnClock(s, ctx.now);
    checkHeldBombs(s, ctx.now, logs);
  }
}

function buryCard(s: CatsState, pos: number, ctx: EngineContext, logs: EngineLog[]) {
  const pending = s.pending;
  if (!pending || pending.kind !== 'bury') return;
  insertAt(s, pending.card, pos);
  s.pending = null;
  logs.push({ text: `${nameOf(s, pending.playerId)} đã chôn một lá vào chồng bài.`, kind: 'info', sfx: 'place' });
  endOneTurn(s, ctx.now, logs);
}

function digChoice(s: CatsState, keep: boolean, ctx: EngineContext, logs: EngineLog[]) {
  const pending = s.pending;
  if (!pending || pending.kind !== 'dig') return;
  s.pending = null;
  if (!keep) logs.push({ text: `${nameOf(s, pending.playerId)} bỏ qua lá trên cùng và đào xuống lá bên dưới.`, kind: 'info' });
  drawCard(s, pending.playerId, keep || s.deck.length < 2 ? 'top' : 1, ctx.now, logs);
}

function finishAlter(s: CatsState, order: string[] | null, ctx: EngineContext, logs: EngineLog[]) {
  const pending = s.pending;
  if (!pending || pending.kind !== 'alter') return;
  const top = s.deck.slice(0, Math.min(3, s.deck.length));
  if (order) {
    const reordered = order.map((x) => top.find((c) => c.id === x)!);
    s.deck.splice(0, top.length, ...reordered);
    deckChanged(s);
  }
  s.pending = null;
  resumeTurnClock(s, ctx.now);
  logs.push({ text: `${nameOf(s, pending.playerId)} đã sắp đặt xong tương lai.`, kind: 'info', sfx: 'magic' });
  if (pending.share) {
    const next = nextAlive(s, pending.playerId);
    s.seq += 1;
    const defs = s.deck.slice(0, 3).map((c) => c.def);
    s.privateInfo[next] = { ...s.privateInfo[next], seeFuture: { defs, seq: s.seq, from: pending.playerId } };
    logs.push({ text: `${nameOf(s, pending.playerId)} cho ${nameOf(s, next)} xem 3 lá trên cùng.`, kind: 'info' });
    logs.push({ text: `${nameOf(s, pending.playerId)} chia sẻ: ${defs.map(cardName).join(', ')}.`, kind: 'info', visibleTo: [next] });
  }
}

export const catsEngine: GameEngine<CatsConfig, CatsState> = {
  id: 'exploding-cats',
  rulesVersion: CATS_RULES_VERSION,
  minPlayers: 2,
  maxPlayers: 8,
  usesBalance: false,
  defaultConfig: CATS_DEFAULT_CONFIG,
  parseConfig: parseCatsConfig,
  maxPlayersFor: (cfg) => cfg.maxPlayers,

  validateStart(cfg, count) {
    const plan = planDeck(cfg, count);
    return typeof plan === 'string' ? plan : null;
  },

  createRound(players, cfg, ctx, info) {
    const { hands, deck } = buildAndDeal(cfg, players.length, ctx.rng);
    const s: CatsState = {
      roundId: info.roundId,
      config: cfg,
      phase: 'PLAYING',
      order: players.map((p) => p.id),
      direction: 1,
      players: Object.fromEntries(players.map((p, i) => [p.id, { id: p.id, nickname: p.nickname, hand: hands[i], alive: true }])),
      currentId: players[0].id,
      turnsRemaining: 1,
      underAttack: false,
      deck,
      discard: [],
      pending: null,
      turnDeadline: null,
      privateInfo: {},
      marked: {},
      timeBombs: [],
      claims: {},
      lastEvent: null,
      seq: 0,
      winnerId: null,
      eliminated: [],
    };
    const bombs = deck.filter((c) => c.def === 'exploding').length;
    const implode =
      (deck.some((c) => c.def === 'imploding') ? ', 1 Mèo Sập Nguồn' : '') + (deck.some((c) => c.def === 'time_bomb') ? ', 1 Mèo Hẹn Giờ' : '');
    const logs: EngineLog[] = [
      {
        text: `Chia mỗi người ${cfg.handSize} lá và 1 Gỡ Bom. Chồng bài có ${bombs} Mèo Nổ${implode} (${copiesFor(cfg, players.length)} bộ bài).`,
        kind: 'info',
        sfx: 'deal',
      },
    ];
    const prev = info.previousWinnerId && s.players[info.previousWinnerId] ? info.previousWinnerId : null;
    const first = prev ?? s.order[ctx.rng.int(s.order.length)];
    setTurn(s, first, 1, false, ctx.now, logs);
    return { state: s, logs };
  },

  applyAction(state, playerId, type, payload, ctx): EngineResult<CatsState> {
    const s = clone(state);
    const logs: EngineLog[] = [];
    if (s.phase !== 'PLAYING') throw new GameRuleError('Ván đã kết thúc.');
    const me = requireAlive(s, playerId);
    const pending = s.pending;
    const ownCard = (cardId: string) => {
      if (!me.hand.some((c) => c.id === cardId)) throw new GameRuleError('Bạn không có lá bài này.');
    };

    switch (type) {
      case 'play': {
        const body = parse('play', payload);
        if (pending) throw new GameRuleError('Hãy chờ hành động hiện tại được xử lý xong.');
        if (s.currentId !== playerId) throw new GameRuleError('Chưa đến lượt của bạn.', 'NOT_YOUR_TURN');
        const intent = intentFrom(s, playerId, body);
        EFFECTS[intent.effect].validate(s, playerId, intent);
        for (const c of intent.cards) removeFromHand(s, playerId, c.id);
        s.discard.push(...intent.cards);
        s.pending = { kind: 'action', actorId: playerId, ...intent, nopes: [], passes: [], deadline: ctx.now + s.config.nopeWindowMs };
        event(s, { type: 'play', actorId: playerId, targetId: intent.targetId ?? undefined, cardDefs: intent.cards.map((c) => c.def) });
        logs.push({ text: describePlay(s, playerId, intent), kind: 'play', sfx: 'play' });
        break;
      }
      case 'nope': {
        const { cardId } = parse('nope', payload);
        if (!pending || pending.kind !== 'action') throw new GameRuleError('Không có hành động nào để chặn.');
        const last = pending.nopes.length ? pending.nopes[pending.nopes.length - 1].playerId : pending.actorId;
        if (last === playerId) throw new GameRuleError('Bạn không thể tự chặn lá vừa đánh của mình.');
        const card = me.hand.find((c) => c.id === cardId);
        if (!card || CATS_CARD_BY_ID[card.def].effectType !== 'nope') throw new GameRuleError('Bạn cần một lá "Không!".');
        removeFromHand(s, playerId, cardId);
        s.discard.push(card);
        pending.nopes.push({ playerId, cardId });
        pending.passes = [];
        pending.deadline = ctx.now + s.config.nopeWindowMs;
        event(s, { type: 'nope', actorId: playerId, cardDefs: ['nope'] });
        logs.push({
          text: pending.nopes.length % 2 === 1 ? `${me.nickname}: "Không!"` : `${me.nickname}: "Không!" chồng "Không!" — hành động được khôi phục.`,
          kind: 'warn',
          sfx: 'nope',
        });
        checkHeldBombs(s, ctx.now, logs);
        break;
      }
      case 'pass': {
        parse('pass', payload);
        if (!pending || pending.kind !== 'action') throw new GameRuleError('Không có gì để cho qua.');
        const need = requiredPassers(s);
        if (!need.includes(playerId)) throw new GameRuleError('Bạn không cần xác nhận lúc này.');
        if (!pending.passes.includes(playerId)) pending.passes.push(playerId);
        if (need.every((x) => pending.passes.includes(x))) resolveAction(s, ctx, logs);
        break;
      }
      case 'draw': {
        parse('draw', payload);
        if (pending) throw new GameRuleError('Hãy chờ hành động hiện tại được xử lý xong.');
        if (s.currentId !== playerId) throw new GameRuleError('Chưa đến lượt của bạn.', 'NOT_YOUR_TURN');
        drawCard(s, playerId, 'top', ctx.now, logs);
        break;
      }
      case 'giveFavor': {
        const { cardId } = parse('giveFavor', payload);
        const p = requirePending(s, 'favor', 'Bạn không cần đưa bài lúc này.');
        if (p.giverId !== playerId) throw new GameRuleError('Bạn không cần đưa bài lúc này.');
        ownCard(cardId);
        giveCard(s, cardId, logs, ctx.now);
        break;
      }
      case 'placeBomb': {
        const { position: pos } = parse('placeBomb', payload);
        const p = requirePending(s, 'defuse', 'Bạn không cần đặt bom lúc này.');
        if (p.playerId !== playerId) throw new GameRuleError('Bạn không cần đặt bom lúc này.');
        if (pos > s.deck.length) throw new GameRuleError('Vị trí không hợp lệ.');
        placeBomb(s, pos, ctx, logs);
        break;
      }
      case 'placeImploding': {
        const { position: pos } = parse('placeImploding', payload);
        const p = requirePending(s, 'implode_place', 'Bạn không cần đặt Mèo Sập Nguồn lúc này.');
        if (p.playerId !== playerId) throw new GameRuleError('Bạn không cần đặt Mèo Sập Nguồn lúc này.');
        if (pos > s.deck.length) throw new GameRuleError('Vị trí không hợp lệ.');
        placeImploding(s, pos, ctx, logs);
        break;
      }
      case 'alterFuture': {
        const { order } = parse('alterFuture', payload);
        const p = requirePending(s, 'alter', 'Bạn không cần sắp xếp lúc này.');
        if (p.playerId !== playerId) throw new GameRuleError('Bạn không cần sắp xếp lúc này.');
        const ids = s.deck.slice(0, Math.min(3, s.deck.length)).map((c) => c.id);
        if (order.length !== ids.length || !order.every((x) => ids.includes(x)) || new Set(order).size !== order.length) {
          throw new GameRuleError('Thứ tự sắp xếp không hợp lệ.');
        }
        finishAlter(s, order, ctx, logs);
        break;
      }
      case 'pickSteal': {
        const { index } = parse('pickSteal', payload);
        const p = requirePending(s, 'steal_pick', 'Bạn không cần chọn lá lúc này.');
        if (p.actorId !== playerId) throw new GameRuleError('Bạn không cần chọn lá lúc này.');
        if (index >= p.order.length) throw new GameRuleError('Vị trí lá không hợp lệ.');
        pickSteal(s, index, logs, ctx.now);
        break;
      }
      case 'garbageCard': {
        const { cardId } = parse('garbageCard', payload);
        const p = requirePending(s, 'garbage', 'Hiện không cần bỏ bài.');
        if (!p.waiting.includes(playerId)) throw new GameRuleError('Bạn đã chọn rồi hoặc không cần chọn.');
        ownCard(cardId);
        chooseGarbage(s, playerId, cardId, ctx, logs);
        break;
      }
      case 'potluckCard': {
        const { cardId } = parse('potluckCard', payload);
        const p = requirePending(s, 'potluck', 'Hiện không cần góp bài.');
        if (p.queue[0] !== playerId) throw new GameRuleError('Chưa đến lượt bạn góp bài.');
        ownCard(cardId);
        choosePotluck(s, playerId, cardId, ctx, logs);
        break;
      }
      case 'buryCard': {
        const { position: pos } = parse('buryCard', payload);
        const p = requirePending(s, 'bury', 'Bạn không cần chôn bài lúc này.');
        if (p.playerId !== playerId) throw new GameRuleError('Bạn không cần chôn bài lúc này.');
        if (pos > s.deck.length) throw new GameRuleError('Vị trí không hợp lệ.');
        buryCard(s, pos, ctx, logs);
        break;
      }
      case 'digChoice': {
        const { keep } = parse('digChoice', payload);
        const p = requirePending(s, 'dig', 'Bạn không cần chọn lúc này.');
        if (p.playerId !== playerId) throw new GameRuleError('Bạn không cần chọn lúc này.');
        digChoice(s, keep, ctx, logs);
        break;
      }
      default:
        throw new GameRuleError('Hành động không được hỗ trợ.', 'UNKNOWN_ACTION');
    }
    return { state: s, logs };
  },

  getDeadline: (s) => (s.phase !== 'PLAYING' ? null : s.pending ? s.pending.deadline : s.turnDeadline),

  onDeadline(state, ctx) {
    const s = clone(state);
    const logs: EngineLog[] = [];
    const deadline = catsEngine.getDeadline(s);
    if (deadline === null || ctx.now < deadline) return { state, logs };
    const pending = s.pending;
    const pickRandom = (pid: string) => {
      const hand = s.players[pid].hand;
      return hand[ctx.rng.int(hand.length)].id;
    };
    if (!pending) {
      logs.push({ text: `${nameOf(s, s.currentId)} hết giờ — tự động rút bài.`, kind: 'info' });
      drawCard(s, s.currentId, 'top', ctx.now, logs);
    } else if (pending.kind === 'action') {
      resolveAction(s, ctx, logs);
    } else if (pending.kind === 'favor') {
      if (s.players[pending.giverId].hand.length) giveCard(s, pickRandom(pending.giverId), logs, ctx.now);
      else s.pending = null;
    } else if (pending.kind === 'defuse') {
      placeBomb(s, ctx.rng.int(s.deck.length + 1), ctx, logs);
    } else if (pending.kind === 'implode_place') {
      placeImploding(s, ctx.rng.int(s.deck.length + 1), ctx, logs);
    } else if (pending.kind === 'alter') {
      finishAlter(s, null, ctx, logs);
    } else if (pending.kind === 'steal_pick') {
      pickSteal(s, ctx.rng.int(pending.order.length), logs, ctx.now);
    } else if (pending.kind === 'garbage') {
      for (const pid of pending.waiting) if (s.players[pid].hand.length) pending.chosen[pid] = pickRandom(pid);
      pending.waiting = [];
      finishGarbage(s, ctx, logs);
    } else if (pending.kind === 'potluck') {
      choosePotluck(s, pending.queue[0], pickRandom(pending.queue[0]), ctx, logs);
    } else if (pending.kind === 'bury') {
      buryCard(s, ctx.rng.int(s.deck.length + 1), ctx, logs);
    } else if (pending.kind === 'dig') {
      digChoice(s, true, ctx, logs);
    }
    return { state: s, logs };
  },

  onPlayerGone(state, playerId, ctx) {
    const s = clone(state);
    const logs: EngineLog[] = [];
    const p = s.players[playerId];
    if (!p || !p.alive || s.phase !== 'PLAYING') return { state, logs };
    const pending = s.pending;
    let resolveGarbageAfter = false;
    let continuePotluck = false;
    if (pending) {
      switch (pending.kind) {
        case 'defuse':
          if (pending.playerId === playerId) {
            insertAt(s, pending.bomb, ctx.rng.int(s.deck.length + 1));
            s.pending = null;
          }
          break;
        case 'implode_place':
          if (pending.playerId === playerId) {
            insertAt(s, { ...pending.card, faceUp: true }, ctx.rng.int(s.deck.length + 1));
            s.pending = null;
          }
          break;
        case 'bury':
          if (pending.playerId === playerId) {
            insertAt(s, pending.card, ctx.rng.int(s.deck.length + 1));
            s.pending = null;
          }
          break;
        case 'favor':
          if (pending.giverId === playerId || pending.receiverId === playerId) s.pending = null;
          break;
        case 'steal_pick':
          if (pending.actorId === playerId || pending.targetId === playerId) s.pending = null;
          break;
        case 'alter':
        case 'dig':
          if (pending.playerId === playerId) s.pending = null;
          break;
        case 'action':
          if (pending.actorId === playerId) s.pending = null;
          break;
        case 'garbage':
          pending.waiting = pending.waiting.filter((x) => x !== playerId);
          delete pending.chosen[playerId];
          resolveGarbageAfter = pending.waiting.length === 0;
          break;
        case 'potluck':
          continuePotluck = pending.queue[0] === playerId;
          pending.queue = pending.queue.filter((x) => x !== playerId);
          if (pending.queue.length === 0) s.pending = null;
          break;
      }
    }
    logs.push({ text: `${p.nickname} rời ván.`, kind: 'warn' });
    const wasCurrent = s.currentId === playerId;
    const next = nextAlive(s, playerId);
    eliminate(s, playerId, logs);
    if (s.phase !== 'PLAYING') return { state: s, logs };
    if (wasCurrent && (!s.pending || s.pending.kind === 'garbage' || s.pending.kind === 'potluck')) {
      if (s.pending) s.pending = null;
      setTurn(s, next, 1, false, ctx.now, logs);
    } else if (resolveGarbageAfter) {
      finishGarbage(s, ctx, logs);
    } else if (continuePotluck && s.pending?.kind === 'potluck') {
      s.pending.deadline = ctx.now + s.config.choiceTimeMs;
    } else if (s.pending?.kind === 'action' && requiredPassers(s).every((x) => s.pending!.kind === 'action' && s.pending!.passes.includes(x))) {
      resolveAction(s, ctx, logs);
    }
    if (!s.pending && s.turnDeadline === null) resumeTurnClock(s, ctx.now);
    return { state: s, logs };
  },

  shiftDeadlines(state, delta) {
    const s = clone(state);
    if (s.turnDeadline !== null) s.turnDeadline += delta;
    if (s.pending) s.pending.deadline += delta;
    return s;
  },

  tablePolicy: (cfg) => ({
    midRoundJoin: cfg.midRoundJoin,
    disconnectGraceMs: cfg.disconnectPolicy === 'eliminate' ? cfg.disconnectTimeoutMs : null,
  }),

  isFinished: (s) => s.phase === 'ROUND_FINISHED',

  getOutcome(s) {
    return {
      winners: s.winnerId ? [s.winnerId] : [],
      title: s.winnerId ? `${nameOf(s, s.winnerId)} là chú mèo sống sót cuối cùng!` : 'Ván kết thúc',
      settlements: [],
      detail: { eliminated: s.eliminated, winnerId: s.winnerId },
    };
  },

  projectView(s, viewerId): CatsRoundView {
    const me = viewerId ? s.players[viewerId] : undefined;
    const pending = s.pending;
    const markedDefs = (pid: string) => {
      const ids = s.marked[pid] ?? [];
      return s.players[pid].hand.filter((c) => ids.includes(c.id)).map((c) => c.def);
    };
    let pendingView: CatsPendingView | null = null;
    if (pending?.kind === 'action') {
      const last = pending.nopes.length ? pending.nopes[pending.nopes.length - 1].playerId : pending.actorId;
      const need = requiredPassers(s);
      pendingView = {
        kind: 'action',
        actorId: pending.actorId,
        cardDefs: pending.cards.map((c) => c.def),
        effect: pending.effect,
        targetId: pending.targetId,
        namedDef: pending.namedDef,
        nopeChain: pending.nopes.map((n) => n.playerId),
        willResolve: pending.nopes.length % 2 === 0,
        deadline: pending.deadline,
        canNope: !!me?.alive && last !== me.id && me.hand.some((c) => c.def === 'nope'),
        canPass: !!me?.alive && need.includes(me.id) && !pending.passes.includes(me.id),
        waitingFor: need.filter((x) => !pending.passes.includes(x)),
      };
    } else if (pending?.kind === 'favor') {
      pendingView = { kind: 'favor', giverId: pending.giverId, receiverId: pending.receiverId, deadline: pending.deadline };
    } else if (pending?.kind === 'defuse') {
      pendingView = { kind: 'defuse', playerId: pending.playerId, deadline: pending.deadline, deckCount: s.deck.length };
    } else if (pending?.kind === 'implode_place') {
      pendingView = { kind: 'implode_place', playerId: pending.playerId, deadline: pending.deadline, deckCount: s.deck.length };
    } else if (pending?.kind === 'alter') {
      pendingView = {
        kind: 'alter',
        playerId: pending.playerId,
        share: pending.share,
        sharedWith: pending.share ? nextAlive(s, pending.playerId) : null,
        deadline: pending.deadline,
        cards: viewerId === pending.playerId ? s.deck.slice(0, 3).map((c) => ({ id: c.id, def: c.def })) : null,
      };
    } else if (pending?.kind === 'steal_pick') {
      const marks = s.marked[pending.targetId] ?? [];
      const hand = s.players[pending.targetId].hand;
      pendingView = {
        kind: 'steal_pick',
        actorId: pending.actorId,
        targetId: pending.targetId,
        deadline: pending.deadline,
        // Chỉ lá đã bị Đánh Dấu (vốn công khai) mới lộ mặt; còn lại úp.
        slots: pending.order.map((cid) => (marks.includes(cid) ? (hand.find((c) => c.id === cid)?.def ?? null) : null)),
      };
    } else if (pending?.kind === 'garbage') {
      pendingView = { kind: 'garbage', waitingFor: pending.waiting, deadline: pending.deadline };
    } else if (pending?.kind === 'potluck') {
      pendingView = { kind: 'potluck', currentId: pending.queue[0], queue: pending.queue, deadline: pending.deadline };
    } else if (pending?.kind === 'bury') {
      pendingView = {
        kind: 'bury',
        playerId: pending.playerId,
        deadline: pending.deadline,
        deckCount: s.deck.length,
        cardDef: viewerId === pending.playerId ? pending.card.def : null,
      };
    } else if (pending?.kind === 'dig') {
      pendingView = { kind: 'dig', playerId: pending.playerId, deadline: pending.deadline, topDef: viewerId === pending.playerId ? (s.deck[0]?.def ?? null) : null };
    }
    const implodingIdx = s.deck.findIndex((c) => c.def === 'imploding' && c.faceUp);
    const bombsInHands = Object.values(s.players).reduce((a, p) => a + p.hand.filter((c) => c.def === 'exploding').length, 0);
    return {
      phase: s.phase,
      order: s.order,
      direction: s.direction,
      currentId: s.currentId,
      turnsRemaining: s.turnsRemaining,
      underAttack: s.underAttack,
      deckCount: s.deck.length,
      bombsLeft: s.deck.filter((c) => c.def === 'exploding').length + bombsInHands,
      implodingPos: implodingIdx >= 0 ? implodingIdx : null,
      timeBombs: s.timeBombs.map((b) => ({ holderId: b.holderId, turnsLeft: b.turnsLeft })),
      claims: Object.entries(s.claims).map(([targetId, claimerId]) => ({ targetId, claimerId })),
      discardTop: s.discard.slice(-5).map((c) => c.def),
      discardCount: s.discard.length,
      players: s.order.map((pid) => ({
        id: pid,
        nickname: s.players[pid].nickname,
        cardCount: s.players[pid].hand.length,
        alive: s.players[pid].alive,
        marked: markedDefs(pid),
      })),
      myHand: me ? me.hand.map((c) => ({ id: c.id, def: c.def })) : null,
      myMarked: me ? (s.marked[me.id] ?? []).filter((cid) => me.hand.some((c) => c.id === cid)) : [],
      seeFuture: viewerId ? (s.privateInfo[viewerId]?.seeFuture ?? null) : null,
      pending: pendingView,
      deadline: catsEngine.getDeadline(s),
      lastEvent: s.lastEvent,
      winnerId: s.winnerId,
      eliminated: s.eliminated,
      expansions: s.config.expansions,
      enabledCardIds: enabledDefs(s.config).map((d) => d.id),
    };
  },
};

export { nextAlive, aliveIds };
