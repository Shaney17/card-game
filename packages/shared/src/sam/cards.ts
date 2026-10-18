/** Thứ tự quân trong Sâm: 3 nhỏ nhất, 2 lớn nhất. Chất không ảnh hưởng độ lớn. */
export const RANK_LABELS = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'] as const;
export const SUITS = ['S', 'C', 'D', 'H'] as const; // bích, nhép, rô, cơ
export type Suit = (typeof SUITS)[number];

/** Mã lá bài, ví dụ "10H", "AS", "2D". */
export type CardCode = string;

export interface Card {
  code: CardCode;
  /** Giá trị 3..15 (A = 14, 2 = 15). */
  rank: number;
  suit: Suit;
}

export const RANK_A = 14;
export const RANK_2 = 15;

export function rankLabel(rank: number): string {
  return RANK_LABELS[rank - 3];
}

export function parseCard(code: CardCode): Card {
  const suit = code.slice(-1) as Suit;
  const label = code.slice(0, -1);
  const idx = RANK_LABELS.indexOf(label as (typeof RANK_LABELS)[number]);
  if (idx < 0 || !SUITS.includes(suit)) throw new Error(`Mã lá bài không hợp lệ: ${code}`);
  return { code, rank: idx + 3, suit };
}

export function isRed(card: Card): boolean {
  return card.suit === 'D' || card.suit === 'H';
}

export function fullDeck(): CardCode[] {
  const out: CardCode[] = [];
  for (const r of RANK_LABELS) for (const s of SUITS) out.push(`${r}${s}`);
  return out;
}

const SUIT_ORDER: Record<Suit, number> = { S: 0, C: 1, D: 2, H: 3 };
export function sortCodes(codes: CardCode[]): CardCode[] {
  return codes
    .map(parseCard)
    .sort((a, b) => a.rank - b.rank || SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit])
    .map((c) => c.code);
}
