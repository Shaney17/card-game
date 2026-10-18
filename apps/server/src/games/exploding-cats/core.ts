import { CATS_CARD_BY_ID } from '@chieu-bai/shared';
import type { EngineLog } from '../../game-registry/types';
import type { Rng } from '../../security/rng';
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

/** Thứ tự người còn sống theo chiều chơi, bắt đầu từ `fromId`. */
export function aliveFrom(s: CatsState, fromId: string): string[] {
  const out: string[] = [];
  let id = fromId;
  for (let i = 0; i < s.order.length; i++) {
    if (s.players[id].alive && !out.includes(id)) out.push(id);
    id = nextAlive(s, id);
  }
  return out;
}

/** Chồng bài vừa đổi thứ tự: thông tin Xem Trước Tương Lai cũ không còn đúng. */
export function deckChanged(s: CatsState) {
  for (const id of Object.keys(s.privateInfo)) delete s.privateInfo[id].seeFuture;
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

/** Mèo Hẹn Giờ phát nổ trước mặt người giữ. Trả về true nếu người đó bị loại. */
function detonateTimeBomb(s: CatsState, bomb: CatsState['timeBombs'][number], logs: EngineLog[]): boolean {
  s.timeBombs = s.timeBombs.filter((b) => b !== bomb);
  s.discard.push(bomb.card);
  const p = s.players[bomb.holderId];
  event(s, { type: 'explode', actorId: p.id, cardDefs: ['time_bomb'] });
  const defuse = p.hand.find((c) => c.def === 'defuse');
  if (defuse) {
    removeFromHand(s, p.id, defuse.id);
    s.discard.push(defuse);
    logs.push({ text: `Mèo Hẹn Giờ trước mặt ${p.nickname} phát nổ… nhưng đã kịp Gỡ Bom!`, kind: 'warn', sfx: 'defuse' });
    return false;
  }
  logs.push({ text: `Mèo Hẹn Giờ trước mặt ${p.nickname} phát nổ!`, kind: 'lose', sfx: 'explode' });
  eliminate(s, p.id, logs);
  return true;
}

/** Giảm đếm ngược của Mèo Hẹn Giờ do `holderId` giữ (hoặc mọi quả nếu không truyền). Trả về danh sách người bị loại. */
export function tickTimeBombs(s: CatsState, holderId: string | null, logs: EngineLog[]): string[] {
  const died: string[] = [];
  for (const bomb of [...s.timeBombs]) {
    if (holderId && bomb.holderId !== holderId) continue;
    bomb.turnsLeft -= 1;
    if (bomb.turnsLeft > 0) {
      logs.push({
        text: `Mèo Hẹn Giờ trước mặt ${nameOf(s, bomb.holderId)}: còn ${bomb.turnsLeft} lượt!`,
        kind: 'warn',
        sfx: 'alert',
      });
      continue;
    }
    if (detonateTimeBomb(s, bomb, logs)) died.push(bomb.holderId);
    if (s.phase !== 'PLAYING') break;
  }
  return died;
}

/**
 * Một lượt của `playerId` vừa kết thúc theo cách không qua endOneTurn (Tấn Công, Siêu Né…):
 * đếm ngược Mèo Hẹn Giờ của họ. Trả về true nếu họ bị loại.
 */
export function turnEndedFor(s: CatsState, playerId: string, logs: EngineLog[]): boolean {
  return tickTimeBombs(s, playerId, logs).includes(playerId);
}

/** Hoàn tất một lượt (sau khi rút bài hoặc né lượt). */
export function endOneTurn(s: CatsState, now: number, logs: EngineLog[]) {
  if (s.phase !== 'PLAYING') return;
  const current = s.currentId;
  if (turnEndedFor(s, current, logs)) {
    if (s.phase === 'PLAYING') setTurn(s, nextAlive(s, current), 1, false, now, logs);
    return;
  }
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
  const [card] = p.hand.splice(i, 1);
  const marks = s.marked[playerId];
  if (marks) s.marked[playerId] = marks.filter((id) => id !== cardId);
  return card;
}

/** Chuyển một lá giữa hai người (cướp, xin, đưa). */
export function transferCard(s: CatsState, fromId: string, toId: string, cardId: string): CardInst {
  const card = removeFromHand(s, fromId, cardId);
  s.players[toId].hand.push(card);
  return card;
}

export function eliminate(s: CatsState, playerId: string, logs: EngineLog[], bomb?: CardInst) {
  const p = s.players[playerId];
  if (!p.alive) return;
  p.alive = false;
  s.discard.push(...p.hand);
  if (bomb) s.discard.push(bomb);
  p.hand = [];
  delete s.marked[playerId];
  for (const b of s.timeBombs.filter((x) => x.holderId === playerId)) s.discard.push(b.card);
  s.timeBombs = s.timeBombs.filter((x) => x.holderId !== playerId);
  for (const [target, claimer] of Object.entries(s.claims)) if (target === playerId || claimer === playerId) delete s.claims[target];
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

/** Loại người chơi; nếu đang là lượt của họ thì chuyển lượt. */
export function eliminateAndAdvance(s: CatsState, playerId: string, now: number, logs: EngineLog[], bomb?: CardInst) {
  const wasCurrent = s.currentId === playerId;
  const next = nextAlive(s, playerId);
  eliminate(s, playerId, logs, bomb);
  if (s.phase === 'PLAYING' && wasCurrent) setTurn(s, next, 1, false, now, logs);
}

const count = (hand: CardInst[], def: string) => hand.filter((c) => c.def === def).length;

/** Một người dính bom (Dây Chuyền): tự dùng Gỡ Bom nếu có, không thì bị loại. Trả về true nếu bị loại. */
function blast(s: CatsState, playerId: string, logs: EngineLog[]): boolean {
  const p = s.players[playerId];
  if (!p.alive) return false;
  const defuse = p.hand.find((c) => c.def === 'defuse');
  if (defuse) {
    removeFromHand(s, playerId, defuse.id);
    s.discard.push(defuse);
    logs.push({ text: `${p.nickname} dùng Gỡ Bom thoát chết!`, kind: 'warn', sfx: 'defuse' });
    return false;
  }
  logs.push({ text: `${p.nickname} không có Gỡ Bom!`, kind: 'lose', sfx: 'explode' });
  eliminate(s, playerId, logs);
  return true;
}

/**
 * Mèo Liều: số Mèo Nổ được giữ trên tay không vượt quá số Mèo Liều.
 * Gọi sau mọi lần bài rời/đến tay. Xử lý từng quả một (mỗi lần tối đa một lựa chọn Gỡ Bom).
 */
export function checkHeldBombs(s: CatsState, now: number, logs: EngineLog[]) {
  if (s.phase !== 'PLAYING' || s.pending) return;
  for (const id of aliveFrom(s, s.currentId)) {
    const p = s.players[id];
    if (count(p.hand, 'exploding') <= count(p.hand, 'streaking')) continue;
    const bomb = removeFromHand(s, id, p.hand.find((c) => c.def === 'exploding')!.id);
    event(s, { type: 'explode', actorId: id, cardDefs: ['exploding'] });
    const defuse = p.hand.find((c) => c.def === 'defuse');
    if (defuse) {
      removeFromHand(s, id, defuse.id);
      s.discard.push(defuse);
      s.pending = { kind: 'defuse', playerId: id, bomb, endsTurn: false, deadline: now + s.config.choiceTimeMs };
      logs.push({ text: `Mèo Nổ trên tay ${p.nickname} phát nổ… may mà kịp Gỡ Bom!`, kind: 'warn', sfx: 'defuse' });
      return;
    }
    logs.push({ text: `Mèo Nổ trên tay ${p.nickname} phát nổ!`, kind: 'lose', sfx: 'explode' });
    eliminateAndAdvance(s, id, now, logs, bomb);
    if (s.phase !== 'PLAYING') return;
  }
}

/**
 * Rút một lá — xử lý Mèo Nổ, Mèo Liều, Gỡ Bom, Mèo Nổ Sập, Mèo Hẹn Giờ và "Ta Lấy Nhé".
 * Lượt luôn là của `playerId`; lá có thể về tay người khác nếu `playerId` đang bị giành lá.
 */
export function drawCard(s: CatsState, playerId: string, from: 'top' | 'bottom' | number, now: number, logs: EngineLog[], rng: Rng) {
  const drawer = s.players[playerId];
  const index = from === 'top' ? 0 : from === 'bottom' ? s.deck.length - 1 : from;
  const card = index >= 0 && index < s.deck.length ? s.deck.splice(index, 1)[0] : undefined;
  if (!card) {
    logs.push({ text: 'Chồng bài đã hết.', kind: 'warn' });
    endOneTurn(s, now, logs);
    return;
  }
  const where = from === 'bottom' ? ' từ đáy chồng bài' : '';

  // "Ta Lấy Nhé": lá về tay người giành.
  let recipientId = playerId;
  const claimer = s.claims[playerId];
  if (claimer) {
    delete s.claims[playerId];
    if (s.players[claimer]?.alive) recipientId = claimer;
  }
  const p = s.players[recipientId];
  const redirected = recipientId !== playerId;
  const via = redirected ? ` — lá về tay ${p.nickname} (Ta Lấy Nhé)` : '';

  /** Người nhận lá bị loại; nếu không phải người đang rút thì lượt của người rút vẫn kết thúc. */
  const lose = (bomb: CardInst) => {
    if (!redirected) return eliminateAndAdvance(s, recipientId, now, logs, bomb);
    eliminate(s, recipientId, logs, bomb);
    endOneTurn(s, now, logs);
  };

  if (card.def === 'imploding') {
    event(s, { type: 'implode', actorId: recipientId, cardDefs: ['imploding'] });
    if (card.faceUp) {
      logs.push({ text: `${drawer.nickname} rút trúng Mèo Nổ Sập đang lật ngửa${via} — nổ sập!`, kind: 'lose', sfx: 'explode' });
      lose(card);
      return;
    }
    s.pending = { kind: 'implode_place', playerId: recipientId, card, deadline: now + s.config.choiceTimeMs };
    logs.push({ text: `${drawer.nickname} rút phải Mèo Nổ Sập${via}! Lá này sẽ được lật ngửa và nhét lại chồng bài.`, kind: 'warn', sfx: 'alert' });
    return;
  }

  if (card.def === 'time_bomb') {
    event(s, { type: 'timebomb', actorId: recipientId, cardDefs: ['time_bomb'] });
    logs.push({
      text: `${drawer.nickname} rút phải Mèo Hẹn Giờ${via}! Nổ sau ${s.config.timeBombTurns} lượt của ${redirected ? p.nickname : 'người này'} nếu không chuyền đi.`,
      kind: 'warn',
      sfx: 'alert',
    });
    // Lượt rút bom không tính vào đếm ngược.
    endOneTurn(s, now, logs);
    if (s.phase === 'PLAYING' && s.players[recipientId].alive) {
      s.timeBombs.push({ card, holderId: recipientId, turnsLeft: s.config.timeBombTurns });
    } else {
      s.discard.push(card);
    }
    return;
  }

  if (card.def === 'chain_bomb') {
    s.discard.push(card);
    event(s, { type: 'explode', actorId: recipientId, cardDefs: ['chain_bomb'] });
    const second = nextAlive(s, recipientId);
    logs.push({
      text: `${drawer.nickname} rút phải Mèo Nổ Dây Chuyền${via}! ${p.nickname}${second !== recipientId ? ` và ${nameOf(s, second)}` : ''} đều dính bom!`,
      kind: 'lose',
      sfx: 'explode',
    });
    for (const victim of second !== recipientId ? [recipientId, second] : [recipientId]) {
      blast(s, victim, logs);
      if (s.phase !== 'PLAYING') return;
    }
    if (s.players[playerId].alive) endOneTurn(s, now, logs);
    else setTurn(s, nextAlive(s, playerId), 1, false, now, logs);
    return;
  }

  if (card.def === 'smoke_bomb') {
    s.discard.push(card);
    event(s, { type: 'explode', actorId: recipientId, cardDefs: ['smoke_bomb'] });
    const lost: string[] = [];
    for (let i = 0; i < 2 && p.hand.length > 0; i++) {
      const c = p.hand[rng.int(p.hand.length)];
      removeFromHand(s, recipientId, c.id);
      s.discard.push(c);
      lost.push(cardName(c.def));
    }
    logs.push({
      text: `${drawer.nickname} rút phải Mèo Bom Khói${via}! ${p.nickname} đánh rơi ${lost.length ? lost.join(' và ') : 'không lá nào (tay trống)'}.`,
      kind: 'warn',
      sfx: 'shuffle',
    });
    endOneTurn(s, now, logs);
    checkHeldBombs(s, now, logs);
    return;
  }

  if (card.def === 'exploding') {
    if (count(p.hand, 'streaking') > count(p.hand, 'exploding')) {
      // Mèo Liều: giữ bom bí mật — công khai chỉ thấy "rút một lá".
      p.hand.push(card);
      event(s, { type: 'draw', actorId: playerId });
      logs.push({ text: `${drawer.nickname} rút một lá${where}${via}.`, kind: 'play', sfx: 'draw' });
      logs.push({ text: 'Bạn nhận phải Mèo Nổ — Mèo Liều giúp bạn giữ nó trên tay!', kind: 'warn', visibleTo: [recipientId] });
      endOneTurn(s, now, logs);
      return;
    }
    const defuse = p.hand.find((c) => c.def === 'defuse');
    event(s, { type: 'explode', actorId: recipientId, cardDefs: ['exploding'] });
    if (defuse) {
      removeFromHand(s, recipientId, defuse.id);
      s.discard.push(defuse);
      s.pending = { kind: 'defuse', playerId: recipientId, bomb: card, endsTurn: true, deadline: now + s.config.choiceTimeMs };
      logs.push({ text: `${drawer.nickname} rút phải Mèo Nổ${via}… ${p.nickname} đã kịp Gỡ Bom!`, kind: 'warn', sfx: 'defuse' });
      return;
    }
    logs.push({ text: `${drawer.nickname} rút phải Mèo Nổ${via} — ${p.nickname} không có Gỡ Bom!`, kind: 'lose', sfx: 'explode' });
    lose(card);
    return;
  }

  p.hand.push(card);
  event(s, { type: 'draw', actorId: playerId });
  logs.push({ text: `${drawer.nickname} rút một lá${where}${via}.`, kind: 'play', sfx: redirected ? 'steal' : 'draw' });
  logs.push({ text: `Bạn ${redirected ? 'giành được' : 'rút được'}: ${cardName(card.def)}.`, kind: 'info', visibleTo: [recipientId] });
  if (redirected) logs.push({ text: `Lá bạn rút đã về tay ${p.nickname}.`, kind: 'info', visibleTo: [playerId] });
  endOneTurn(s, now, logs);
}

/** Chèn lá vào chồng bài ở vị trí (0 = trên cùng), giới hạn trong khoảng hợp lệ. */
export function insertAt(s: CatsState, card: CardInst, position: number) {
  const pos = Math.max(0, Math.min(position, s.deck.length));
  s.deck.splice(pos, 0, card);
  deckChanged(s);
}
