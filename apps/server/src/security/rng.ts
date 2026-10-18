import { randomInt } from 'node:crypto';

/** Nguồn ngẫu nhiên cho engine. Server dùng CSPRNG; test có thể dùng bản có seed. */
export interface Rng {
  /** Số nguyên ngẫu nhiên trong [0, maxExclusive). */
  int(maxExclusive: number): number;
}

export const cryptoRng: Rng = {
  int(maxExclusive) {
    if (maxExclusive <= 1) return 0;
    return randomInt(maxExclusive);
  },
};

/** Fisher–Yates không thiên lệch (randomInt đã loại bỏ modulo bias). */
export function shuffle<T>(items: T[], rng: Rng): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** RNG có seed (mulberry32) — CHỈ dùng trong test. */
export function seededRng(seed: number): Rng {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { int: (max) => (max <= 1 ? 0 : Math.floor(next() * max)) };
}

const ID_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';
export function randomId(rng: Rng, len = 8): string {
  let out = '';
  for (let i = 0; i < len; i++) out += ID_ALPHABET[rng.int(ID_ALPHABET.length)];
  return out;
}
