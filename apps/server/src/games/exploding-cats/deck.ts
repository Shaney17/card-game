import { CATS_CARDS, type CatsCardDefinition } from '@chieu-bai/shared';
import { randomId, shuffle, type Rng } from '../../security/rng';
import type { CatsConfig } from './config';
import type { CardInst } from './state';

export function enabledDefs(cfg: CatsConfig): CatsCardDefinition[] {
  const exps = new Set<string>(['base', ...cfg.expansions]);
  return CATS_CARDS.filter((d) => exps.has(d.expansionId));
}

export function copiesFor(cfg: CatsConfig, players: number): number {
  return cfg.deckCopies === 'auto' ? (players > 5 ? 2 : 1) : cfg.deckCopies;
}

export interface DeckPlan {
  copies: number;
  pool: number;
  defuses: number;
  bombs: number;
  imploding: number;
  timeBomb: number;
  extraDefuses: number;
}

/** Lá không chia trực tiếp mà thêm vào chồng bài theo luật riêng. */
const SPECIAL = new Set(['exploding', 'imploding', 'time_bomb', 'defuse']);

/**
 * Kiểm tra bộ bài có đủ cho số người & luật đã chọn (spec §5.3).
 * Số Mèo Nổ = số người − 1, +1 nếu bật "Tăng Tốc" (Mèo Liều), −1 nếu bật "Hỗn Loạn" (thay bằng Mèo Sập Nguồn).
 */
export function planDeck(cfg: CatsConfig, players: number): DeckPlan | string {
  const defs = enabledDefs(cfg);
  const copies = copiesFor(cfg, players);
  const pool = defs.filter((d) => !SPECIAL.has(d.id)).reduce((a, d) => a + d.count, 0) * copies;
  const defuses = (defs.find((d) => d.id === 'defuse')?.count ?? 0) * copies;
  const bombsAvail = (defs.find((d) => d.id === 'exploding')?.count ?? 0) * copies;
  const imploding = defs.some((d) => d.id === 'imploding') ? 1 : 0;
  const streaking = cfg.expansions.includes('tang-toc') ? 1 : 0;
  const timeBomb = cfg.expansions.includes('hen-gio') ? 1 : 0;
  const bombs = Math.max(0, players - 1 + streaking - imploding);
  if (players < 2) return 'Cần ít nhất 2 người để chơi Mèo Nổ.';
  if (players > cfg.maxPlayers) return `Bàn Mèo Nổ chỉ cho tối đa ${cfg.maxPlayers} người.`;
  if (defuses < players) return `Bộ bài chỉ có ${defuses} lá Gỡ Bom, không đủ chia cho ${players} người. Hãy tăng số bộ bài.`;
  if (bombs > bombsAvail) return `Bộ bài chỉ có ${bombsAvail} lá Mèo Nổ, cần ${bombs}. Hãy tăng số bộ bài.`;
  const need = players * cfg.handSize + players * 2;
  if (pool < need)
    return `Bộ bài có ${pool} lá thường, không đủ để chia ${cfg.handSize} lá cho ${players} người và còn bài để rút (cần ${need}). Hãy tăng số bộ bài hoặc giảm số lá chia.`;
  return { copies, pool, defuses, bombs, imploding, timeBomb, extraDefuses: Math.min(cfg.extraDefuses, defuses - players) };
}

/** Số lá thường tối đa còn lại trong chồng bài khi bật rút gọn. */
export const trimmedSize = (players: number) => Math.max(12, players * 5);

export interface DealResult {
  hands: CardInst[][];
  deck: CardInst[];
}

export function buildAndDeal(cfg: CatsConfig, players: number, rng: Rng): DealResult {
  const plan = planDeck(cfg, players);
  if (typeof plan === 'string') throw new Error(plan);
  const defs = enabledDefs(cfg);
  const usedIds = new Set<string>();
  // ID ngẫu nhiên để không lộ vị trí/loại lá qua ID.
  const inst = (def: string): CardInst => {
    let id = '';
    do id = randomId(rng, 6);
    while (usedIds.has(id));
    usedIds.add(id);
    return { id, def };
  };
  const pool: CardInst[] = [];
  for (const d of defs) {
    if (SPECIAL.has(d.id)) continue;
    for (let i = 0; i < d.count * plan.copies; i++) pool.push(inst(d.id));
  }
  const shuffled = shuffle(pool, rng);
  const hands: CardInst[][] = [];
  for (let p = 0; p < players; p++) {
    hands.push([inst('defuse'), ...shuffled.splice(0, cfg.handSize)]);
  }
  // Phần còn lại đã được xáo nên cắt bớt là bỏ ngẫu nhiên.
  const rest = cfg.trimDeck ? shuffled.slice(0, trimmedSize(players)) : [...shuffled];
  for (let i = 0; i < plan.bombs; i++) rest.push(inst('exploding'));
  for (let i = 0; i < plan.imploding; i++) rest.push(inst('imploding'));
  for (let i = 0; i < plan.timeBomb; i++) rest.push(inst('time_bomb'));
  for (let i = 0; i < plan.extraDefuses; i++) rest.push(inst('defuse'));
  return { hands, deck: shuffle(rest, rng) };
}
