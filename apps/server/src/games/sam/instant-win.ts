import { isRed, parseCard, RANK_2, type CardCode } from './cards';
import type { InstantWinKind } from './config';
import { detectCombo, type ComboRules } from './rules';

/** Kiểm tra ăn trắng ngay sau khi chia bài. Trả về loại đầu tiên khớp theo thứ tự cấu hình. */
export function detectInstantWin(hand: CardCode[], kinds: InstantWinKind[], rules: ComboRules): InstantWinKind | null {
  const cards = hand.map(parseCard);
  const counts = new Map<number, number>();
  for (const c of cards) counts.set(c.rank, (counts.get(c.rank) ?? 0) + 1);
  const checks: Record<InstantWinKind, () => boolean> = {
    fourTwos: () => (counts.get(RANK_2) ?? 0) === 4,
    dragon: () => hand.length === 10 && detectCombo(hand, rules)?.type === 'straight',
    fivePairs: () => {
      // 5 đôi: chia được 10 lá thành 5 cặp cùng bậc (tứ quý tính là 2 đôi).
      let pairs = 0;
      for (const n of counts.values()) pairs += Math.floor(n / 2);
      return hand.length === 10 && [...counts.values()].every((n) => n % 2 === 0) && pairs === 5;
    },
    threeTriples: () => [...counts.values()].filter((n) => n >= 3).length >= 3,
    sameColor: () => cards.every((c) => isRed(c)) || cards.every((c) => !isRed(c)),
  };
  for (const k of kinds) if (checks[k]()) return k;
  return null;
}
