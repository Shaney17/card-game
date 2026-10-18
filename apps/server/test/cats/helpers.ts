import { expect } from 'vitest';
import { catsEngine } from '../../src/games/exploding-cats/engine';
import { CATS_DEFAULT_CONFIG, type CatsConfig } from '../../src/games/exploding-cats/config';
import type { CardInst, CatsState } from '../../src/games/exploding-cats/state';
import { seededRng } from '../../src/security/rng';
import { GameRuleError } from '../../src/game-registry/types';

export const ctx = (now = 1000) => ({ rng: seededRng(7), now });
const players = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, nickname: `Mèo ${i}` }));

let uid = 0;
export const card = (def: string): CardInst => ({ id: `${def}#${uid++}`, def });
export const cards = (s: string) => s.split(' ').filter(Boolean).map(card);

/** Ván với bài & chồng bài định sẵn (lá đầu chuỗi `deck` là lá trên cùng). p0 đi trước. */
export function setup(hands: string[], deck: string, cfg: Partial<CatsConfig> = {}): CatsState {
  const config = { ...CATS_DEFAULT_CONFIG, expansions: ['hon-loan', 'tang-toc', 'dao-boi', 'hen-gio'] as CatsConfig['expansions'], ...cfg };
  const { state } = catsEngine.createRound(players(hands.length), config, ctx(), { roundId: 'r', previousWinnerId: 'p0' });
  hands.forEach((h, i) => (state.players[`p${i}`].hand = cards(h)));
  state.deck = cards(deck);
  return state;
}

export const act = (s: CatsState, pid: string, type: string, payload: unknown = {}, now = 2000) =>
  catsEngine.applyAction(s, pid, type, payload, ctx(now)).state;
export const ids = (s: CatsState, pid: string, def: string) => s.players[pid].hand.filter((c) => c.def === def).map((c) => c.id);
export const defs = (s: CatsState, pid: string) => s.players[pid].hand.map((c) => c.def);
export const deckDefs = (s: CatsState) => s.deck.map((c) => c.def);

/** Đánh 1 lá theo loại rồi mọi người "Cho qua". */
export function playAndResolve(s: CatsState, pid: string, def: string, extra: Record<string, unknown> = {}) {
  return passAll(act(s, pid, 'play', { cardIds: [ids(s, pid, def)[0]], ...extra }));
}

export function passAll(s: CatsState) {
  for (const id of s.order) {
    if (s.pending?.kind !== 'action') break;
    const v = catsEngine.projectView(s, id) as { pending: { canPass?: boolean } | null };
    if (v.pending?.canPass) s = act(s, id, 'pass');
  }
  return s;
}

export const expectRule = (fn: () => unknown, msg?: RegExp) => {
  expect(fn).toThrow(GameRuleError);
  if (msg) expect(fn).toThrow(msg);
};
