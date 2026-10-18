import { CATS_CARD_BY_ID } from '@chieu-bai/shared';
import type { EngineLog } from '../../game-registry/types';
import type { CardInst, CatsEvent, CatsState } from './state';

export const cardName = (def: string) => CATS_CARD_BY_ID[def]?.name ?? def;
export const nameOf = (s: CatsState, id: string) => s.players[id]?.nickname ?? '?';
export const aliveIds = (s: CatsState) => s.order.filter((id) => s.players[id].alive);

export function event(s: CatsState, e: Omit<CatsEvent, 'seq'>) {
  s.seq += 1;
  s.lastEvent = { ...e, seq: s.seq };
}

export function nextAlive(s: CatsState, fromId: string): string {
  const n = s.order.length;
  let idx = s.order.indexOf(fromId);
  for (let step = 0; step < n; step++) {
    idx = (idx + s.direction + n) % n;
    if (s.players[s.order[idx]].alive) return s.order[idx];
  }
  return fromId;
}

export function setTurn(s: CatsState, playerId: string, turns: number, attacked: boolean, now: number, logs: EngineLog[]) {
  const changed = s.currentId !== playerId;
  if (changed && s.privateInfo[s.currentId]) delete s.privateInfo[s.currentId].seeFuture;
  s.currentId = playerId;
  s.turnsRemaining = turns;
  s.underAttack = attacked;
  s.turnDeadline = now + s.config.turnTimeMs;
  logs.push({
    text: turns > 1 ? `Đến lượt ${nameOf(s, playerId)} — phải chơi ${turns} lượt.` : `Đến lượt ${nameOf(s, playerId)}.`,
    kind: 'info',
    sfx: 'turn',
  });
}

/** Hoàn tất một lượt (sau khi rút bài hoặc né lượt). */
export function endOneTurn(s: CatsState, now: number, logs: EngineLog[]) {
  if (s.phase !== 'PLAYING') return;
  s.turnsRemaining -= 1;
  if (s.turnsRemaining > 0 && s.players[s.currentId].alive) {
    s.turnDeadline = now + s.config.turnTimeMs;
    logs.push({ text: `${nameOf(s, s.currentId)} còn ${s.turnsRemaining} lượt.`, kind: 'info', sfx: 'turn' });
    return;
  }
  setTurn(s, nextAlive(s, s.currentId), 1, false, now, logs);
}

export function removeFromHand(s: CatsState, playerId: string, cardId: string): CardInst {
  const p = s.players[playerId];
  const i = p.hand.findIndex((c) => c.id === cardId);
  if (i < 0) throw new Error('card not in hand');
  return p.hand.splice(i, 1)[0];
}

export function eliminate(s: CatsState, playerId: string, logs: EngineLog[], bomb?: CardInst) {
  const p = s.players[playerId];
  if (!p.alive) return;
  p.alive = false;
  s.discard.push(...p.hand);
  if (bomb) s.discard.push(bomb);
  p.hand = [];
  s.eliminated.push(playerId);
  event(s, { type: 'eliminate', actorId: playerId });
  logs.push({ text: `${p.nickname} đã bị loại!`, kind: 'lose', sfx: 'explode' });
  const alive = aliveIds(s);
  if (alive.length === 1) {
    s.phase = 'ROUND_FINISHED';
    s.winnerId = alive[0];
    s.pending = null;
    s.turnDeadline = null;
    event(s, { type: 'win', actorId: alive[0] });
    logs.push({ text: `${nameOf(s, alive[0])} là chú mèo sống sót cuối cùng!`, kind: 'win', sfx: 'win' });
  }
}

/** Rút một lá (từ trên hoặc dưới cùng) — xử lý Mèo Nổ/Gỡ Bom. */
export function drawCard(s: CatsState, playerId: string, fromBottom: boolean, now: number, logs: EngineLog[]) {
  const p = s.players[playerId];
  const card = fromBottom ? s.deck.pop() : s.deck.shift();
  if (!card) {
    // Không xảy ra khi luật đúng (luôn còn ít nhất một Mèo Nổ), nhưng xử lý an toàn.
    logs.push({ text: 'Chồng bài đã hết.', kind: 'warn' });
    endOneTurn(s, now, logs);
    return;
  }
  if (card.def === 'exploding') {
    const defuse = p.hand.find((c) => c.def === 'defuse');
    event(s, { type: 'explode', actorId: playerId, cardDefs: ['exploding'] });
    if (defuse) {
      removeFromHand(s, playerId, defuse.id);
      s.discard.push(defuse);
      s.pending = { kind: 'defuse', playerId, bomb: card, deadline: now + s.config.choiceTimeMs };
      logs.push({ text: `${p.nickname} rút phải Mèo Nổ… nhưng đã kịp Gỡ Bom!`, kind: 'warn', sfx: 'defuse' });
      return;
    }
    logs.push({ text: `${p.nickname} rút phải Mèo Nổ và không có Gỡ Bom!`, kind: 'lose', sfx: 'explode' });
    eliminate(s, playerId, logs, card);
    if (s.phase === 'PLAYING') setTurn(s, nextAlive(s, playerId), 1, false, now, logs);
    return;
  }
  p.hand.push(card);
  event(s, { type: 'draw', actorId: playerId });
  logs.push({ text: `${p.nickname} rút một lá${fromBottom ? ' từ đáy chồng bài' : ''}.`, kind: 'play', sfx: 'draw' });
  logs.push({ text: `Bạn rút được: ${cardName(card.def)}.`, kind: 'info', visibleTo: [playerId] });
  endOneTurn(s, now, logs);
}
