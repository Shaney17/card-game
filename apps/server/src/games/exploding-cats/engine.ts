import { CATS_CARD_BY_ID } from '@chieu-bai/shared';
import { z } from 'zod';
import {
  GameRuleError,
  type EngineContext,
  type EngineLog,
  type EngineResult,
  type GameEngine,
} from '../../game-registry/types';
import { CATS_DEFAULT_CONFIG, parseCatsConfig, type CatsConfig } from './config';
import { aliveIds, cardName, drawCard, eliminate, endOneTurn, event, nameOf, nextAlive, removeFromHand, setTurn } from './core';
import { buildAndDeal, copiesFor, enabledDefs, planDeck } from './deck';
import { EFFECTS } from './effects';
import type { CatsState, PlayIntent } from './state';

export const CATS_RULES_VERSION = 'meo-no-1.0.0';

const id = z.string().min(1).max(32);
const schemas = {
  play: z.object({ cardIds: z.array(id).min(1).max(3), targetId: id.optional(), namedDef: id.optional() }).strict(),
  nope: z.object({ cardId: id }).strict(),
  pass: z.object({}).strict(),
  draw: z.object({}).strict(),
  giveFavor: z.object({ cardId: id }).strict(),
  placeBomb: z.object({ position: z.number().int().min(0).max(500) }).strict(),
  alterFuture: z.object({ order: z.array(id).min(1).max(3) }).strict(),
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
    if (d.effectType === 'explode') throw new GameRuleError('Không thể đánh lá này.');
    return { ...base, effect: d.effectType };
  }
  if (!defs.every((d) => d.id === defs[0].id) || defs[0].category !== 'collection') {
    throw new GameRuleError('Combo phải gồm 2 hoặc 3 lá mèo sưu tập giống hệt nhau.');
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
    const label = `${play.cards.length} lá ${cardName(play.cards[0].def)}`;
    return play.cards.length === 3
      ? `${actor} đánh ${label}${target}, đòi lá ${cardName(play.namedDef!)}.`
      : `${actor} đánh ${label}${target}.`;
  }
  return `${actor} đánh ${cardName(play.cards[0].def)}${target}.`;
}

/** Hoàn tất cửa sổ "Không!": số lá "Không!" lẻ thì hành động bị hủy. */
function resolveAction(s: CatsState, ctx: EngineContext, logs: EngineLog[]) {
  const pending = s.pending;
  if (!pending || pending.kind !== 'action') return;
  s.pending = null;
  s.turnDeadline = ctx.now + s.config.turnTimeMs;
  const canceled = pending.nopes.length % 2 === 1;
  if (canceled) {
    event(s, { type: 'cancel', actorId: pending.actorId, cardDefs: pending.cards.map((c) => c.def) });
    logs.push({ text: `Hành động của ${nameOf(s, pending.actorId)} đã bị chặn.`, kind: 'info', sfx: 'nope' });
    return;
  }
  if (!s.players[pending.actorId].alive) return;
  EFFECTS[pending.effect].resolve(s, pending.actorId, pending, ctx, logs);
}

/** Người cần bấm "Cho qua" để kết thúc sớm cửa sổ phản ứng. */
function requiredPassers(s: CatsState): string[] {
  if (!s.pending || s.pending.kind !== 'action') return [];
  const last = s.pending.nopes.length ? s.pending.nopes[s.pending.nopes.length - 1].playerId : s.pending.actorId;
  return aliveIds(s).filter((id) => id !== last);
}

function placeBomb(s: CatsState, position: number, ctx: EngineContext, logs: EngineLog[]) {
  const pending = s.pending;
  if (!pending || pending.kind !== 'defuse') return;
  const pos = Math.max(0, Math.min(position, s.deck.length));
  s.deck.splice(pos, 0, pending.bomb);
  s.pending = null;
  for (const id of Object.keys(s.privateInfo)) delete s.privateInfo[id].seeFuture;
  event(s, { type: 'defuse', actorId: pending.playerId });
  logs.push({ text: `${nameOf(s, pending.playerId)} đã bí mật nhét Mèo Nổ trở lại chồng bài.`, kind: 'info', sfx: 'place' });
  endOneTurn(s, ctx.now, logs);
}

function giveCard(s: CatsState, cardId: string, logs: EngineLog[], now: number) {
  const pending = s.pending;
  if (!pending || pending.kind !== 'favor') return;
  const card = removeFromHand(s, pending.giverId, cardId);
  s.players[pending.receiverId].hand.push(card);
  s.pending = null;
  s.turnDeadline = now + s.config.turnTimeMs;
  event(s, { type: 'favor', actorId: pending.giverId, targetId: pending.receiverId });
  logs.push({ text: `${nameOf(s, pending.giverId)} đưa cho ${nameOf(s, pending.receiverId)} một lá.`, kind: 'play', sfx: 'steal' });
  logs.push({ text: `Bạn nhận được: ${cardName(card.def)}.`, kind: 'info', visibleTo: [pending.receiverId] });
  logs.push({ text: `Bạn đã đưa: ${cardName(card.def)}.`, kind: 'info', visibleTo: [pending.giverId] });
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
      lastEvent: null,
      seq: 0,
      winnerId: null,
      eliminated: [],
    };
    const logs: EngineLog[] = [
      {
        text: `Chia mỗi người ${cfg.handSize} lá và 1 Gỡ Bom. Chồng bài có ${players.length - 1} Mèo Nổ (${copiesFor(cfg, players.length)} bộ bài).`,
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
        break;
      }
      case 'pass': {
        parse('pass', payload);
        if (!pending || pending.kind !== 'action') throw new GameRuleError('Không có gì để cho qua.');
        const need = requiredPassers(s);
        if (!need.includes(playerId)) throw new GameRuleError('Bạn không cần xác nhận lúc này.');
        if (!pending.passes.includes(playerId)) pending.passes.push(playerId);
        if (need.every((id) => pending.passes.includes(id))) resolveAction(s, ctx, logs);
        break;
      }
      case 'draw': {
        parse('draw', payload);
        if (pending) throw new GameRuleError('Hãy chờ hành động hiện tại được xử lý xong.');
        if (s.currentId !== playerId) throw new GameRuleError('Chưa đến lượt của bạn.', 'NOT_YOUR_TURN');
        drawCard(s, playerId, false, ctx.now, logs);
        break;
      }
      case 'giveFavor': {
        const { cardId } = parse('giveFavor', payload);
        if (!pending || pending.kind !== 'favor' || pending.giverId !== playerId) throw new GameRuleError('Bạn không cần đưa bài lúc này.');
        if (!me.hand.some((c) => c.id === cardId)) throw new GameRuleError('Bạn không có lá bài này.');
        giveCard(s, cardId, logs, ctx.now);
        break;
      }
      case 'placeBomb': {
        const { position } = parse('placeBomb', payload);
        if (!pending || pending.kind !== 'defuse' || pending.playerId !== playerId) throw new GameRuleError('Bạn không cần đặt bom lúc này.');
        if (position > s.deck.length) throw new GameRuleError('Vị trí không hợp lệ.');
        placeBomb(s, position, ctx, logs);
        break;
      }
      case 'alterFuture': {
        const { order } = parse('alterFuture', payload);
        if (!pending || pending.kind !== 'alter' || pending.playerId !== playerId) throw new GameRuleError('Bạn không cần sắp xếp lúc này.');
        const top = s.deck.slice(0, Math.min(3, s.deck.length));
        const ids = top.map((c) => c.id);
        if (order.length !== ids.length || !order.every((x) => ids.includes(x)) || new Set(order).size !== order.length) {
          throw new GameRuleError('Thứ tự sắp xếp không hợp lệ.');
        }
        const reordered = order.map((x) => top.find((c) => c.id === x)!);
        s.deck.splice(0, top.length, ...reordered);
        s.pending = null;
        s.turnDeadline = ctx.now + s.config.turnTimeMs;
        logs.push({ text: `${me.nickname} đã sắp đặt xong tương lai.`, kind: 'info', sfx: 'magic' });
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
    if (!pending) {
      logs.push({ text: `${nameOf(s, s.currentId)} hết giờ — tự động rút bài.`, kind: 'info' });
      drawCard(s, s.currentId, false, ctx.now, logs);
    } else if (pending.kind === 'action') {
      resolveAction(s, ctx, logs);
    } else if (pending.kind === 'favor') {
      const giver = s.players[pending.giverId];
      if (giver.hand.length) giveCard(s, giver.hand[ctx.rng.int(giver.hand.length)].id, logs, ctx.now);
      else s.pending = null;
    } else if (pending.kind === 'defuse') {
      placeBomb(s, ctx.rng.int(s.deck.length + 1), ctx, logs);
    } else if (pending.kind === 'alter') {
      s.pending = null;
      s.turnDeadline = ctx.now + s.config.turnTimeMs;
    }
    return { state: s, logs };
  },

  onPlayerGone(state, playerId, ctx) {
    const s = clone(state);
    const logs: EngineLog[] = [];
    const p = s.players[playerId];
    if (!p || !p.alive || s.phase !== 'PLAYING') return { state, logs };
    const pending = s.pending;
    if (pending) {
      if (pending.kind === 'defuse' && pending.playerId === playerId) {
        s.deck.splice(ctx.rng.int(s.deck.length + 1), 0, pending.bomb);
        s.pending = null;
      } else if (pending.kind === 'favor' && (pending.giverId === playerId || pending.receiverId === playerId)) {
        s.pending = null;
      } else if (pending.kind === 'alter' && pending.playerId === playerId) {
        s.pending = null;
      } else if (pending.kind === 'action' && pending.actorId === playerId) {
        s.pending = null;
      }
    }
    logs.push({ text: `${p.nickname} rời ván.`, kind: 'warn' });
    const wasCurrent = s.currentId === playerId;
    const next = nextAlive(s, playerId);
    eliminate(s, playerId, logs);
    if (s.phase === 'PLAYING') {
      if (wasCurrent) setTurn(s, next, 1, false, ctx.now, logs);
      else if (s.pending?.kind === 'action' && requiredPassers(s).every((id) => s.pending!.kind === 'action' && s.pending!.passes.includes(id))) {
        resolveAction(s, ctx, logs);
      }
      if (!s.pending && s.turnDeadline === null) s.turnDeadline = ctx.now + s.config.turnTimeMs;
    }
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

  projectView(s, viewerId) {
    const me = viewerId ? s.players[viewerId] : undefined;
    const pending = s.pending;
    let pendingView: unknown = null;
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
        waitingFor: need.filter((id) => !pending.passes.includes(id)),
      };
    } else if (pending?.kind === 'favor') {
      pendingView = { kind: 'favor', giverId: pending.giverId, receiverId: pending.receiverId, deadline: pending.deadline };
    } else if (pending?.kind === 'defuse') {
      pendingView = { kind: 'defuse', playerId: pending.playerId, deadline: pending.deadline, deckCount: s.deck.length };
    } else if (pending?.kind === 'alter') {
      pendingView = {
        kind: 'alter',
        playerId: pending.playerId,
        deadline: pending.deadline,
        cards: viewerId === pending.playerId ? s.deck.slice(0, 3) : null,
      };
    }
    return {
      phase: s.phase,
      order: s.order,
      direction: s.direction,
      currentId: s.currentId,
      turnsRemaining: s.turnsRemaining,
      underAttack: s.underAttack,
      deckCount: s.deck.length,
      bombsInDeck: s.deck.filter((c) => c.def === 'exploding').length,
      discardTop: s.discard.slice(-5).map((c) => c.def),
      discardCount: s.discard.length,
      players: s.order.map((id) => ({
        id,
        nickname: s.players[id].nickname,
        cardCount: s.players[id].hand.length,
        alive: s.players[id].alive,
      })),
      myHand: me ? me.hand : null,
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
