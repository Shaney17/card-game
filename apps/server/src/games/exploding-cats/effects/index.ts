import { CATS_CARD_BY_ID, CATS_CARDS } from '@chieu-bai/shared';
import { GameRuleError, type EngineContext, type EngineLog } from '../../../game-registry/types';
import { shuffle } from '../../../security/rng';
import {
  aliveFrom,
  aliveIds,
  cardName,
  deckChanged,
  drawCard,
  endOneTurn,
  event,
  nameOf,
  nextAlive,
  setTurn,
  tickTimeBombs,
  transferCard,
  turnEndedFor,
} from '../core';
import type { CatsState, PlayIntent } from '../state';

/**
 * Registry handler hiệu ứng phía server (spec §5.5).
 * Dữ liệu lá bài chỉ chứa `effectType`; logic nằm ở đây, không bao giờ thực thi code từ dữ liệu.
 *
 * Mỗi handler khai báo:
 *  - validate: điều kiện sử dụng, số lượng/loại mục tiêu, lựa chọn bắt buộc;
 *  - resolve: thay đổi trạng thái hợp lệ & bước tiếp theo của lượt (có thể tạo lựa chọn chờ `pending`).
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
const requireDeck = (min: number, msg: string) => (s: CatsState) => {
  if (s.deck.length < min) throw new GameRuleError(msg);
};

function attackTurns(s: CatsState) {
  return s.config.attackStacking && s.underAttack ? s.turnsRemaining + 2 : 2;
}

export const EFFECTS: Record<string, EffectHandler> = {
  attack: {
    validate: noop,
    resolve(s, actorId, _p, ctx, logs) {
      const turns = attackTurns(s);
      // Lượt của người tấn công kết thúc → Mèo Hẹn Giờ của họ đếm ngược.
      turnEndedFor(s, actorId, logs);
      if (s.phase !== 'PLAYING') return;
      const next = nextAlive(s, actorId);
      logs.push({ text: `${nameOf(s, next)} bị tấn công!`, kind: 'warn', sfx: 'attack' });
      setTurn(s, next, turns, true, ctx.now, logs);
    },
  },
  targeted_attack: {
    validate: (s, a, p) => requireTarget(s, a, p.targetId, false),
    resolve(s, actorId, p, ctx, logs) {
      if (!targetUsable(s, p.targetId, false)) return;
      const turns = attackTurns(s);
      turnEndedFor(s, actorId, logs);
      if (s.phase !== 'PLAYING' || !s.players[p.targetId!].alive) return;
      logs.push({ text: `${nameOf(s, p.targetId!)} bị tấn công chỉ định!`, kind: 'warn', sfx: 'attack' });
      setTurn(s, p.targetId!, turns, true, ctx.now, logs);
    },
  },
  personal_attack: {
    validate: noop,
    resolve(s, actorId, _p, _ctx, logs) {
      s.turnsRemaining += 2;
      s.underAttack = true;
      logs.push({ text: `${nameOf(s, actorId)} tự tấn công — còn ${s.turnsRemaining} lượt!`, kind: 'warn', sfx: 'attack' });
    },
  },
  skip: {
    validate: noop,
    resolve(s, actorId, _p, ctx, logs) {
      logs.push({ text: `${nameOf(s, actorId)} né một lượt.`, kind: 'info' });
      endOneTurn(s, ctx.now, logs);
    },
  },
  super_skip: {
    validate: noop,
    resolve(s, actorId, _p, ctx, logs) {
      logs.push({ text: `${nameOf(s, actorId)} siêu né — bỏ qua toàn bộ ${s.turnsRemaining} lượt!`, kind: 'info', sfx: 'shuffle' });
      turnEndedFor(s, actorId, logs);
      if (s.phase !== 'PLAYING') return;
      setTurn(s, nextAlive(s, actorId), 1, false, ctx.now, logs);
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
      drawCard(s, actorId, 'bottom', ctx.now, logs);
    },
  },
  shuffle: {
    validate: noop,
    resolve(s, actorId, _p, ctx, logs) {
      s.deck = shuffle(s.deck, ctx.rng);
      deckChanged(s);
      event(s, { type: 'shuffle', actorId });
      logs.push({ text: `${nameOf(s, actorId)} xáo tung chồng bài.`, kind: 'info', sfx: 'shuffle' });
    },
  },
  swap_top_bottom: {
    validate: requireDeck(2, 'Chồng bài cần ít nhất 2 lá.'),
    resolve(s, actorId, _p, _ctx, logs) {
      if (s.deck.length < 2) return;
      const last = s.deck.length - 1;
      [s.deck[0], s.deck[last]] = [s.deck[last], s.deck[0]];
      deckChanged(s);
      event(s, { type: 'shuffle', actorId });
      logs.push({ text: `${nameOf(s, actorId)} đổi chỗ lá trên cùng và dưới cùng.`, kind: 'info', sfx: 'shuffle' });
    },
  },
  catomic: {
    validate: noop,
    resolve(s, actorId, _p, ctx, logs) {
      const bombs = s.deck.filter((c) => c.def === 'exploding');
      const rest = shuffle(
        s.deck.filter((c) => c.def !== 'exploding'),
        ctx.rng,
      );
      s.deck = [...bombs, ...rest];
      deckChanged(s);
      event(s, { type: 'shuffle', actorId });
      logs.push({
        text: `${nameOf(s, actorId)} thả Bom Nguyên Tử: ${bombs.length} Mèo Nổ đã nằm trên cùng chồng bài!`,
        kind: 'warn',
        sfx: 'attack',
      });
      endOneTurn(s, ctx.now, logs);
    },
  },
  see_future: {
    validate: noop,
    resolve(s, actorId, _p, _ctx, logs) {
      const defs = s.deck.slice(0, 3).map((c) => c.def);
      s.seq += 1;
      s.privateInfo[actorId] = { ...s.privateInfo[actorId], seeFuture: { defs, seq: s.seq } };
      logs.push({ text: `${nameOf(s, actorId)} soi 3 lá trên cùng.`, kind: 'info', sfx: 'magic' });
      logs.push({ text: `3 lá trên cùng: ${defs.map(cardName).join(', ') || '(trống)'}.`, kind: 'info', visibleTo: [actorId] });
    },
  },
  alter_future: {
    validate: noop,
    resolve(s, actorId, _p, ctx, logs) {
      if (s.deck.length === 0) return;
      s.pending = { kind: 'alter', playerId: actorId, share: false, deadline: ctx.now + s.config.choiceTimeMs };
      logs.push({ text: `${nameOf(s, actorId)} đang sắp đặt tương lai…`, kind: 'info', sfx: 'magic' });
    },
  },
  share_future: {
    validate: noop,
    resolve(s, actorId, _p, ctx, logs) {
      if (s.deck.length === 0) return;
      s.pending = { kind: 'alter', playerId: actorId, share: true, deadline: ctx.now + s.config.choiceTimeMs };
      logs.push({ text: `${nameOf(s, actorId)} đang sắp xếp 3 lá để chia sẻ với ${nameOf(s, nextAlive(s, actorId))}…`, kind: 'info', sfx: 'magic' });
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
  mark: {
    validate: (s, a, p) => {
      requireTarget(s, a, p.targetId, true);
      const t = s.players[p.targetId!];
      const marked = s.marked[t.id] ?? [];
      if (t.hand.every((c) => marked.includes(c.id))) throw new GameRuleError(`Mọi lá của ${t.nickname} đã bị đánh dấu.`);
    },
    resolve(s, actorId, p, ctx, logs) {
      if (!targetUsable(s, p.targetId, true)) return;
      const t = s.players[p.targetId!];
      const marked = s.marked[t.id] ?? [];
      const candidates = t.hand.filter((c) => !marked.includes(c.id));
      if (!candidates.length) return;
      const card = candidates[ctx.rng.int(candidates.length)];
      s.marked[t.id] = [...marked, card.id];
      event(s, { type: 'mark', actorId, targetId: t.id, cardDefs: [card.def] });
      logs.push({ text: `${nameOf(s, actorId)} đánh dấu bài của ${t.nickname}: lộ ra lá ${cardName(card.def)}!`, kind: 'warn', sfx: 'magic' });
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
      if (p.cards.length === 2) {
        // Người đánh tự chọn 1 lá úp; thứ tự được xáo bí mật để vị trí không lộ thông tin.
        s.pending = {
          kind: 'steal_pick',
          actorId,
          targetId: target.id,
          order: shuffle(
            target.hand.map((c) => c.id),
            ctx.rng,
          ),
          deadline: ctx.now + s.config.choiceTimeMs,
        };
        logs.push({ text: `${actor.nickname} đang chọn 1 lá trên tay ${target.nickname}…`, kind: 'info' });
        return;
      }
      const card = target.hand.find((c) => c.def === p.namedDef);
      if (!card) {
        logs.push({ text: `${target.nickname} không có lá ${cardName(p.namedDef!)}.`, kind: 'info' });
        return;
      }
      transferCard(s, target.id, actorId, card.id);
      event(s, { type: 'steal', actorId, targetId: target.id });
      logs.push({ text: `${actor.nickname} lấy được lá ${cardName(card.def)} của ${target.nickname}!`, kind: 'warn', sfx: 'steal' });
    },
  },
  garbage: {
    validate: noop,
    resolve(s, _actorId, _p, ctx, logs) {
      const waiting = aliveIds(s).filter((id) => s.players[id].hand.length > 0);
      if (!waiting.length) return;
      s.pending = { kind: 'garbage', waiting, chosen: {}, deadline: ctx.now + s.config.choiceTimeMs };
      logs.push({ text: 'Dọn Rác! Mỗi người chọn 1 lá trên tay để xáo vào chồng bài.', kind: 'warn', sfx: 'shuffle' });
    },
  },
  potluck: {
    validate: noop,
    resolve(s, actorId, _p, ctx, logs) {
      const queue = aliveFrom(s, actorId).filter((id) => s.players[id].hand.length > 0);
      if (!queue.length) return;
      s.pending = { kind: 'potluck', queue, deadline: ctx.now + s.config.choiceTimeMs };
      logs.push({ text: `Góp Lẩu! Lần lượt từ ${nameOf(s, queue[0])}, mỗi người úp 1 lá lên chồng bài.`, kind: 'warn', sfx: 'shuffle' });
    },
  },
  bury: {
    validate: requireDeck(1, 'Chồng bài đã hết.'),
    resolve(s, actorId, _p, ctx, logs) {
      const top = s.deck[0];
      if (!top) return;
      if (top.def === 'imploding' && top.faceUp) {
        // Lá trên cùng là Mèo Sập Nguồn lật ngửa: chôn bài cũng là rút bài.
        drawCard(s, actorId, 'top', ctx.now, logs);
        return;
      }
      s.deck.shift();
      s.pending = { kind: 'bury', playerId: actorId, card: top, deadline: ctx.now + s.config.choiceTimeMs };
      logs.push({ text: `${nameOf(s, actorId)} rút một lá để chôn…`, kind: 'info', sfx: 'draw' });
    },
  },
  dig_deeper: {
    validate: requireDeck(1, 'Chồng bài đã hết.'),
    resolve(s, actorId, _p, ctx, logs) {
      if (!s.deck.length) return;
      if (s.deck.length === 1) {
        drawCard(s, actorId, 'top', ctx.now, logs);
        return;
      }
      s.pending = { kind: 'dig', playerId: actorId, deadline: ctx.now + s.config.choiceTimeMs };
      logs.push({ text: `${nameOf(s, actorId)} đang đào sâu…`, kind: 'info', sfx: 'magic' });
    },
  },
  pass_bomb: {
    validate(s, a, p) {
      if (!s.timeBombs.some((b) => b.holderId === a)) throw new GameRuleError('Bạn không giữ Mèo Hẹn Giờ nào để chuyền.');
      requireTarget(s, a, p.targetId, false);
    },
    resolve(s, actorId, p, _ctx, logs) {
      const bomb = s.timeBombs.find((b) => b.holderId === actorId);
      if (!bomb || !targetUsable(s, p.targetId, false)) return;
      bomb.holderId = p.targetId!;
      event(s, { type: 'timebomb', actorId, targetId: p.targetId! });
      logs.push({ text: `${nameOf(s, actorId)} chuyền Mèo Hẹn Giờ cho ${nameOf(s, p.targetId!)} (còn ${bomb.turnsLeft} lượt)!`, kind: 'warn', sfx: 'steal' });
    },
  },
  fast_forward: {
    validate(s) {
      if (!s.timeBombs.length) throw new GameRuleError('Không có Mèo Hẹn Giờ nào đang đếm ngược.');
    },
    resolve(s, actorId, _p, ctx, logs) {
      logs.push({ text: `${nameOf(s, actorId)} tua nhanh đồng hồ!`, kind: 'warn', sfx: 'alert' });
      const died = tickTimeBombs(s, null, logs);
      if (s.phase === 'PLAYING' && died.includes(s.currentId)) setTurn(s, nextAlive(s, s.currentId), 1, false, ctx.now, logs);
    },
  },
  take_that: {
    validate(s, a, p) {
      requireTarget(s, a, p.targetId, false);
      if (s.claims[p.targetId!]) throw new GameRuleError(`Lá tiếp theo của ${nameOf(s, p.targetId!)} đã có người giành rồi.`);
    },
    resolve(s, actorId, p, _ctx, logs) {
      if (!targetUsable(s, p.targetId, false) || s.claims[p.targetId!]) return;
      s.claims[p.targetId!] = actorId;
      event(s, { type: 'mark', actorId, targetId: p.targetId! });
      logs.push({ text: `${nameOf(s, actorId)}: "Ta lấy nhé!" — lá tiếp theo ${nameOf(s, p.targetId!)} rút sẽ về tay ${nameOf(s, actorId)}.`, kind: 'warn', sfx: 'magic' });
    },
  },
};

/** Hiệu ứng do lõi engine xử lý, không đánh như một hành động chính. */
export const CORE_EFFECTS = new Set(['nope', 'defuse', 'explode', 'implode', 'time_bomb', 'passive']);

// Kiểm tra lúc khởi động: mọi effectType trong dữ liệu đều có handler được cho phép.
for (const d of CATS_CARDS) {
  if (!CORE_EFFECTS.has(d.effectType) && !EFFECTS[d.effectType]) {
    throw new Error(`Lá "${d.id}" dùng effectType "${d.effectType}" chưa có handler.`);
  }
}
