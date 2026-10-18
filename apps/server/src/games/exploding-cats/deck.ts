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
  extraDefuses: number;
}

/** Kiểm tra bộ bài có đủ cho số người & luật đã chọn (spec §5.3). */
export function planDeck(cfg: CatsConfig, players: number): DeckPlan | string {
  const defs = enabledDefs(cfg);
  const copies = copiesFor(cfg, players);
  const pool = defs.filter((d) => d.category !== 'exploding' && d.category !== 'defuse').reduce((a, d) => a + d.count, 0) * copies;
  const defuses = (defs.find((d) => d.id === 'defuse')?.count ?? 0) * copies;
  const bombsAvail = (defs.find((d) => d.id === 'exploding')?.count ?? 0) * copies;
  const bombs = players - 1;
  if (players < 2) return 'Cần ít nhất 2 người để chơi Mèo Nổ.';
  if (players > cfg.maxPlayers) return `Bàn Mèo Nổ chỉ cho tối đa ${cfg.maxPlayers} người.`;
  if (defuses < players) return `Bộ bài chỉ có ${defuses} lá Gỡ Bom, không đủ chia cho ${players} người. Hãy tăng số bộ bài.`;
  if (bombs > bombsAvail) return `Bộ bài chỉ có ${bombsAvail} lá Mèo Nổ, cần ${bombs}. Hãy tăng số bộ bài.`;
  const need = players * cfg.handSize + players * 2;
  if (pool < need)
    return `Bộ bài có ${pool} lá thường, không đủ để chia ${cfg.handSize} lá cho ${players} người và còn bài để rút (cần ${need}). Hãy tăng số bộ bài hoặc giảm số lá chia.`;
  return { copies, pool, defuses, bombs, extraDefuses: Math.min(cfg.extraDefuses, defuses - players) };
}

export interface DealResult {
  hands: CardInst[][];
  deck: CardInst[];
}

export function buildAndDeal(cfg: CatsConfig, players: number, rng: Rng): DealResult {
  const plan = planDeck(cfg, players);
  if (typeof plan === 'string') throw new Error(plan);
  const defs = enabledDefs(cfg);
  const usedIds = new Set<string>();
  const inst = (def: string): CardInst => {
    let id = '';
    do id = randomId(rng, 6);
    while (usedIds.has(id));
    usedIds.add(id);
    return { id, def };
  };
  const pool: CardInst[] = [];
  for (const d of defs) {
    if (d.category === 'exploding' || d.category === 'defuse') continue;
    for (let i = 0; i < d.count * plan.copies; i++) pool.push(inst(d.id));
  }
  const shuffled = shuffle(pool, rng);
  const hands: CardInst[][] = [];
  for (let p = 0; p < players; p++) {
    hands.push([inst('defuse'), ...shuffled.splice(0, cfg.handSize)]);
  }
  const rest = [...shuffled];
  for (let i = 0; i < plan.bombs; i++) rest.push(inst('exploding'));
  for (let i = 0; i < plan.extraDefuses; i++) rest.push(inst('defuse'));
  return { hands, deck: shuffle(rest, rng) };
}
