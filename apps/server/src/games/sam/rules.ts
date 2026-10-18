import { parseCard, RANK_2, RANK_A, rankLabel, type Card, type CardCode } from './cards';

export type ComboType = 'single' | 'pair' | 'triple' | 'quad' | 'straight';

export interface Combo {
  type: ComboType;
  cards: CardCode[];
  length: number;
  /** Giá trị so sánh trong cùng loại & cùng độ dài. */
  value: number;
  /** Bộ chứa quân 2 (phục vụ luật thối/chặt). */
  hasTwo: boolean;
}

export interface ComboRules {
  /** Cho phép sảnh thấp A-2-3…, 2-3-4… */
  lowStraights: boolean;
  /** Tứ quý chặt được 2 lẻ. */
  quadBeatsTwo: boolean;
  /** Tứ quý chặt được đôi 2. */
  quadBeatsPairTwo: boolean;
}

export const COMBO_LABEL: Record<ComboType, string> = {
  single: 'bài lẻ',
  pair: 'đôi',
  triple: 'sám cô',
  quad: 'tứ quý',
  straight: 'sảnh',
};

export function describeCombo(c: Combo): string {
  const cards = c.cards.map(parseCard);
  if (c.type === 'straight') {
    return `sảnh ${c.length} lá (${cards.map((x) => rankLabel(x.rank)).join('-')})`;
  }
  const label = rankLabel(cards[0].rank);
  if (c.type === 'single') return `lá ${label}`;
  return `${COMBO_LABEL[c.type]} ${label}`;
}

function consecutive(values: number[]): boolean {
  for (let i = 1; i < values.length; i++) if (values[i] !== values[i - 1] + 1) return false;
  return true;
}

/** Giá trị sảnh nếu hợp lệ, ngược lại null. */
function straightValue(cards: Card[], rules: ComboRules): number | null {
  if (cards.length < 3) return null;
  const ranks = cards.map((c) => c.rank);
  if (new Set(ranks).size !== ranks.length) return null;
  // Cách 1: thứ tự thường 3..A, không có 2.
  if (!ranks.includes(RANK_2)) {
    const hi = [...ranks].sort((a, b) => a - b);
    if (consecutive(hi)) return hi[hi.length - 1];
  }
  // Cách 2: sảnh thấp, A = 1, 2 = 2 (không vòng K-A-2).
  if (rules.lowStraights) {
    const lo = ranks.map((r) => (r === RANK_A ? 1 : r === RANK_2 ? 2 : r)).sort((a, b) => a - b);
    if (consecutive(lo)) return lo[lo.length - 1];
  }
  return null;
}

/** Nhận diện tổ hợp. Trả về null nếu không phải tổ hợp hợp lệ. */
export function detectCombo(codes: CardCode[], rules: ComboRules): Combo | null {
  if (codes.length === 0) return null;
  if (new Set(codes).size !== codes.length) return null;
  let cards: Card[];
  try {
    cards = codes.map(parseCard);
  } catch {
    return null;
  }
  const hasTwo = cards.some((c) => c.rank === RANK_2);
  const sameRank = cards.every((c) => c.rank === cards[0].rank);
  const base = { cards: codes.slice(), length: codes.length, hasTwo };
  if (sameRank) {
    const type: ComboType | null =
      codes.length === 1 ? 'single' : codes.length === 2 ? 'pair' : codes.length === 3 ? 'triple' : codes.length === 4 ? 'quad' : null;
    if (type) return { ...base, type, value: cards[0].rank };
    return null;
  }
  const sv = straightValue(cards, rules);
  if (sv !== null) return { ...base, type: 'straight', value: sv };
  return null;
}

export type CutKind = 'two' | 'pairTwo' | 'quad';

export interface BeatCheck {
  ok: boolean;
  /** Nếu là chặt (tứ quý chặt 2 / đôi 2 / tứ quý nhỏ hơn). */
  cut?: CutKind;
}

/** `next` có chặn được `prev` không. Trong Sâm, bằng nhau không chặn được. */
export function canBeat(next: Combo, prev: Combo, rules: ComboRules): BeatCheck {
  if (next.type === prev.type && next.length === prev.length) {
    if (next.value > prev.value) return { ok: true, cut: next.type === 'quad' ? 'quad' : undefined };
    return { ok: false };
  }
  if (next.type === 'quad') {
    if (prev.type === 'single' && prev.value === RANK_2 && rules.quadBeatsTwo) return { ok: true, cut: 'two' };
    if (prev.type === 'pair' && prev.value === RANK_2 && rules.quadBeatsPairTwo) return { ok: true, cut: 'pairTwo' };
  }
  return { ok: false };
}

/** Liệt kê mọi tổ hợp có thể tạo từ bài trên tay (dùng cho gợi ý/tự đánh). */
export function enumerateCombos(hand: CardCode[], rules: ComboRules): Combo[] {
  const cards = hand.map(parseCard);
  const byRank = new Map<number, Card[]>();
  for (const c of cards) byRank.set(c.rank, [...(byRank.get(c.rank) ?? []), c]);
  const out: Combo[] = [];
  for (const [, group] of byRank) {
    for (let n = 1; n <= group.length; n++) {
      const combo = detectCombo(group.slice(0, n).map((c) => c.code), rules);
      if (combo) out.push(combo);
    }
  }
  // Sảnh: chọn 1 lá đại diện cho mỗi bậc liên tiếp.
  const sequences: number[][] = [];
  const hiOrder = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
  sequences.push(hiOrder);
  if (rules.lowStraights) sequences.push([RANK_A, RANK_2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
  const seen = new Set<string>();
  for (const seq of sequences) {
    for (let start = 0; start < seq.length; start++) {
      for (let end = start + 3; end <= seq.length; end++) {
        const ranks = seq.slice(start, end);
        if (!ranks.every((r) => byRank.has(r))) break;
        const codes = ranks.map((r) => byRank.get(r)![0].code);
        const key = ranks.join(',');
        if (seen.has(key)) continue;
        seen.add(key);
        const combo = detectCombo(codes, rules);
        if (combo) out.push(combo);
      }
    }
  }
  return out;
}
