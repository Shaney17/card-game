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
  chainBomb: number;
  smokeBomb: number;
  extraDefuses: number;
}

/** Lá không chia trực tiếp mà thêm vào chồng bài theo luật riêng. */
const SPECIAL = new Set(['exploding', 'imploding', 'time_bomb', 'chain_bomb', 'smoke_bomb', 'defuse']);
/** Giới hạn an toàn cho số Mèo Nổ. */
const MAX_BOMBS = 12;

/**
 * Kiểm tra bộ bài có đủ cho số người & luật đã chọn (spec §5.3).
 * Số Mèo Nổ = số người − 1 + extraBombs, +1 nếu bật "Tăng Tốc" (Mèo Liều), −1 nếu bật "Hỗn Loạn" (thay bằng Mèo Nổ Sập).
 * Mèo Nổ là lá do dự án tự thiết kế nên không bị giới hạn theo số lá in sẵn.
 */
export function planDeck(cfg: CatsConfig, players: number): DeckPlan | string {
  const defs = enabledDefs(cfg);
  const copies = copiesFor(cfg, players);
  const pool = defs.filter((d) => !SPECIAL.has(d.id)).reduce((a, d) => a + d.count, 0) * copies;
  const defuses = (defs.find((d) => d.id === 'defuse')?.count ?? 0) * copies;
  const imploding = defs.some((d) => d.id === 'imploding') ? 1 : 0;
  const streaking = cfg.expansions.includes('tang-toc') ? 1 : 0;
  const kho = cfg.expansions.includes('hen-gio');
  const timeBomb = kho ? (players >= 5 ? 2 : 1) : 0;
  const chainBomb = kho ? 1 : 0;
  const smokeBomb = kho ? 2 : 0;
  const bombs = Math.max(0, players - 1 + cfg.extraBombs + streaking - imploding);
  if (players < 2) return 'Cần ít nhất 2 người để chơi Mèo Nổ.';
  if (players > cfg.maxPlayers) return `Bàn Mèo Nổ chỉ cho tối đa ${cfg.maxPlayers} người.`;
  if (defuses < players) return `Bộ bài chỉ có ${defuses} lá Gỡ Bom, không đủ chia cho ${players} người. Hãy tăng số bộ bài.`;
  if (bombs > MAX_BOMBS) return `Quá nhiều Mèo Nổ (${bombs}). Hãy giảm số Mèo Nổ thêm.`;
  const need = players * cfg.handSize + players * 2;
  if (pool < need)
    return `Bộ bài có ${pool} lá thường, không đủ để chia ${cfg.handSize} lá cho ${players} người và còn bài để rút (cần ${need}). Hãy tăng số bộ bài hoặc giảm số lá chia.`;
  return { copies, pool, defuses, bombs, imploding, timeBomb, chainBomb, smokeBomb, extraDefuses: Math.min(cfg.extraDefuses, defuses - players) };
}

/** Số lá thường tối đa còn lại trong chồng bài khi bật rút gọn. */
export const trimmedSize = (players: number) => Math.max(20, players * 8);
/** Tỉ lệ tối đa lá mèo sưu tập trong chồng bốc sau khi rút gọn (còn lại là lá hành động). */
const MAX_CAT_SHARE = 0.3;

function isCollection(c: CardInst) {
  return c.def.startsWith('cat_') || c.def === 'feral_cat';
}

/** Rút gọn chồng bốc (đã xáo): giữ nhiều lá hành động, mèo sưu tập tối đa 30%. */
function trimPile(pile: CardInst[], size: number): CardInst[] {
  if (pile.length <= size) return pile;
  const maxCats = Math.floor(size * MAX_CAT_SHARE);
  const cats = pile.filter(isCollection).slice(0, maxCats);
  const actions = pile.filter((c) => !isCollection(c)).slice(0, size - cats.length);
  const kept = new Set([...cats, ...actions]);
  // Nếu thiếu lá hành động thì bù bằng mèo, giữ nguyên thứ tự đã xáo.
  for (const c of pile) {
    if (kept.size >= size) break;
    kept.add(c);
  }
  return pile.filter((c) => kept.has(c));
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
  const rest = cfg.trimDeck ? trimPile(shuffled, trimmedSize(players)) : [...shuffled];
  for (let i = 0; i < plan.bombs; i++) rest.push(inst('exploding'));
  for (let i = 0; i < plan.imploding; i++) rest.push(inst('imploding'));
  for (let i = 0; i < plan.timeBomb; i++) rest.push(inst('time_bomb'));
  for (let i = 0; i < plan.chainBomb; i++) rest.push(inst('chain_bomb'));
  for (let i = 0; i < plan.smokeBomb; i++) rest.push(inst('smoke_bomb'));
  for (let i = 0; i < plan.extraDefuses; i++) rest.push(inst('defuse'));
  return { hands, deck: shuffle(rest, rng) };
}
