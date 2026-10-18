import { CATS_CARD_BY_ID, CATS_CARDS } from '@chieu-bai/shared';
import { GameRuleError, type EngineContext, type EngineLog } from '../../../game-registry/types';
import { shuffle } from '../../../security/rng';
import { cardName, drawCard, endOneTurn, event, nameOf, nextAlive, setTurn } from '../core';
import type { CatsState, PlayIntent } from '../state';

/**
 * Registry handler hiệu ứng phía server (spec §5.5).
 * Dữ liệu lá bài chỉ chứa `effectType`; logic nằm ở đây, không bao giờ thực thi code từ dữ liệu.
 *
 * Mỗi handler khai báo:
 *  - validate: điều kiện sử dụng, số lượng/loại mục tiêu, lựa chọn bắt buộc;
 *  - resolve: thay đổi trạng thái hợp lệ & bước tiếp theo của lượt.
 *  Hủy bởi "Không!": lõi engine bỏ qua resolve, lá vẫn vào chồng bỏ, lượt tiếp tục.
 *  Mục tiêu bị loại/không còn bài lúc resolve: hiệu ứng mất tác dụng (fizzle).
 */
export interface EffectHandler {
  validate(s: CatsState, actorId: string, play: PlayIntent): void;
  resolve(s: CatsState, actorId: string, play: PlayIntent, ctx: EngineContext, logs: EngineLog[]): void;
}

function requireTarget(s: CatsState, actorId: string, targetId: string | null, needCards: boolean) {
  if (!targetId) throw new GameRuleError('Hãy chọn một người chơi làm mục tiêu.');
  const t = s.players[targetId];
  if (!t || !t.alive) throw new GameRuleError('Mục tiêu không hợp lệ.');
  if (targetId === actorId) throw new GameRuleError('Không thể chọn chính mình.');
  if (needCards && t.hand.length === 0) throw new GameRuleError(`${t.nickname} không còn lá bài nào.`);
}

function targetUsable(s: CatsState, targetId: string | null, needCards: boolean) {
  const t = targetId ? s.players[targetId] : null;
  return !!t && t.alive && (!needCards || t.hand.length > 0);
}

const noop = () => {};

function attackTurns(s: CatsState) {
  return s.config.attackStacking && s.underAttack ? s.turnsRemaining + 2 : 2;
}

export const EFFECTS: Record<string, EffectHandler> = {
  attack: {
    validate: noop,
    resolve(s, actorId, _p, ctx, logs) {
      const turns = attackTurns(s);
      const next = nextAlive(s, actorId);
      logs.push({ text: `${nameOf(s, next)} bị tấn công!`, kind: 'warn', sfx: 'attack' });
      setTurn(s, next, turns, true, ctx.now, logs);
    },
  },
  targeted_attack: {
    validate: (s, a, p) => requireTarget(s, a, p.targetId, false),
    resolve(s, _a, p, ctx, logs) {
      if (!targetUsable(s, p.targetId, false)) return;
      const turns = attackTurns(s);
      logs.push({ text: `${nameOf(s, p.targetId!)} bị tấn công chỉ định!`, kind: 'warn', sfx: 'attack' });
      setTurn(s, p.targetId!, turns, true, ctx.now, logs);
    },
  },
  skip: {
    validate: noop,
    resolve(s, actorId, _p, ctx, logs) {
      logs.push({ text: `${nameOf(s, actorId)} né một lượt.`, kind: 'info' });
      endOneTurn(s, ctx.now, logs);
    },
  },
  reverse: {
    validate: noop,
    resolve(s, actorId, _p, ctx, logs) {
      s.direction = s.direction === 1 ? -1 : 1;
      logs.push({ text: `${nameOf(s, actorId)} quay xe — đảo chiều chơi!`, kind: 'info', sfx: 'shuffle' });
      endOneTurn(s, ctx.now, logs);
    },
  },
  draw_bottom: {
    validate: noop,
    resolve(s, actorId, _p, ctx, logs) {
      drawCard(s, actorId, true, ctx.now, logs);
    },
  },
  shuffle: {
    validate: noop,
    resolve(s, actorId, _p, ctx, logs) {
      s.deck = shuffle(s.deck, ctx.rng);
      for (const id of Object.keys(s.privateInfo)) delete s.privateInfo[id].seeFuture;
      event(s, { type: 'shuffle', actorId });
      logs.push({ text: `${nameOf(s, actorId)} xáo tung chồng bài.`, kind: 'info', sfx: 'shuffle' });
    },
  },
  see_future: {
    validate: noop,
    resolve(s, actorId, _p, _ctx, logs) {
      const defs = s.deck.slice(0, 3).map((c) => c.def);
      s.privateInfo[actorId] = { ...s.privateInfo[actorId], seeFuture: { defs, seq: s.seq + 1 } };
      s.seq += 1;
      logs.push({ text: `${nameOf(s, actorId)} soi 3 lá trên cùng.`, kind: 'info', sfx: 'magic' });
      logs.push({ text: `3 lá trên cùng: ${defs.map(cardName).join(', ') || '(trống)'}.`, kind: 'info', visibleTo: [actorId] });
    },
  },
  alter_future: {
    validate: noop,
    resolve(s, actorId, _p, ctx, logs) {
      if (s.deck.length === 0) return;
      s.pending = { kind: 'alter', playerId: actorId, deadline: ctx.now + s.config.choiceTimeMs };
      logs.push({ text: `${nameOf(s, actorId)} đang sắp đặt tương lai…`, kind: 'info', sfx: 'magic' });
    },
  },
  favor: {
    validate: (s, a, p) => requireTarget(s, a, p.targetId, true),
    resolve(s, actorId, p, ctx, logs) {
      if (!targetUsable(s, p.targetId, true)) {
        logs.push({ text: 'Xin Xỏ mất tác dụng vì mục tiêu không còn bài.', kind: 'info' });
        return;
      }
      s.pending = { kind: 'favor', giverId: p.targetId!, receiverId: actorId, deadline: ctx.now + s.config.choiceTimeMs };
      logs.push({ text: `${nameOf(s, p.targetId!)} phải chọn 1 lá đưa cho ${nameOf(s, actorId)}.`, kind: 'info' });
    },
  },
  cat_combo: {
    validate(s, a, p) {
      requireTarget(s, a, p.targetId, true);
      if (p.cards.length === 3) {
        if (!p.namedDef || !CATS_CARD_BY_ID[p.namedDef]) throw new GameRuleError('Hãy gọi tên lá bài bạn muốn lấy.');
      }
    },
    resolve(s, actorId, p, ctx, logs) {
      if (!targetUsable(s, p.targetId, true)) {
        logs.push({ text: 'Combo mèo mất tác dụng vì mục tiêu không còn bài.', kind: 'info' });
        return;
      }
      const target = s.players[p.targetId!];
      const actor = s.players[actorId];
      let idx: number;
      if (p.cards.length === 2) {
        idx = ctx.rng.int(target.hand.length);
      } else {
        idx = target.hand.findIndex((c) => c.def === p.namedDef);
        if (idx < 0) {
          logs.push({ text: `${target.nickname} không có lá ${cardName(p.namedDef!)}.`, kind: 'info' });
          return;
        }
      }
      const [card] = target.hand.splice(idx, 1);
      actor.hand.push(card);
      event(s, { type: 'steal', actorId, targetId: target.id });
      if (p.cards.length === 3) {
        logs.push({ text: `${actor.nickname} lấy được lá ${cardName(card.def)} của ${target.nickname}!`, kind: 'warn', sfx: 'steal' });
      } else {
        logs.push({ text: `${actor.nickname} cướp ngẫu nhiên một lá của ${target.nickname}.`, kind: 'warn', sfx: 'steal' });
        logs.push({ text: `Bạn cướp được: ${cardName(card.def)}.`, kind: 'info', visibleTo: [actorId] });
        logs.push({ text: `Bạn bị cướp mất: ${cardName(card.def)}.`, kind: 'info', visibleTo: [target.id] });
      }
    },
  },
};

/** Hiệu ứng do lõi engine xử lý, không đánh như một hành động chính. */
const CORE_EFFECTS = new Set(['nope', 'defuse', 'explode']);

// Kiểm tra lúc khởi động: mọi effectType trong dữ liệu đều có handler được cho phép.
for (const d of CATS_CARDS) {
  if (!CORE_EFFECTS.has(d.effectType) && !EFFECTS[d.effectType]) {
    throw new Error(`Lá "${d.id}" dùng effectType "${d.effectType}" chưa có handler.`);
  }
}
