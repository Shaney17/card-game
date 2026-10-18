import { describe, expect, it } from 'vitest';
import { canBeat, detectCombo, enumerateCombos, type ComboRules } from '../../src/games/sam/rules';
import { detectInstantWin } from '../../src/games/sam/instant-win';
import { INSTANT_WIN_KINDS } from '../../src/games/sam/config';

const R: ComboRules = { lowStraights: true, quadBeatsTwo: true, quadBeatsPairTwo: false };
const c = (s: string) => s.split(' ');
const combo = (s: string, rules = R) => detectCombo(c(s), rules);

describe('Sâm — nhận diện tổ hợp', () => {
  it('nhận đúng bài lẻ, đôi, sám cô, tứ quý', () => {
    expect(combo('7H')?.type).toBe('single');
    expect(combo('7H 7S')?.type).toBe('pair');
    expect(combo('7H 7S 7D')?.type).toBe('triple');
    expect(combo('7H 7S 7D 7C')?.type).toBe('quad');
  });

  it('nhận sảnh từ 3 lá trở lên, không phân biệt chất', () => {
    expect(combo('3S 4H 5D')?.type).toBe('straight');
    expect(combo('9S 10H JD QC KS AH')?.value).toBe(14);
  });

  it('sảnh thấp A-2-3 và 2-3-4 khi bật luật', () => {
    expect(combo('AS 2H 3D')?.value).toBe(3);
    expect(combo('2H 3D 4S')?.value).toBe(4);
    expect(combo('AS 2H 3D', { ...R, lowStraights: false })).toBeNull();
  });

  it('không cho sảnh vòng K-A-2', () => {
    expect(combo('KS AH 2D')).toBeNull();
    expect(combo('QS KS AH 2D')).toBeNull();
  });

  it('từ chối tổ hợp không hợp lệ', () => {
    expect(combo('3S 5H')).toBeNull();
    expect(combo('3S 4H')).toBeNull(); // sảnh phải ≥ 3
    expect(combo('3S 4H 6D')).toBeNull();
    expect(combo('3S 3S')).toBeNull(); // trùng lá
    expect(combo('3S 3H 4D 4C')).toBeNull(); // đôi thông không có trong luật này
    expect(combo('')).toBeNull();
  });
});

describe('Sâm — chặn bài', () => {
  const beat = (a: string, b: string, rules = R) => canBeat(combo(a, rules)!, combo(b, rules)!, rules);

  it('cùng loại cùng độ dài, lớn hơn mới chặn được', () => {
    expect(beat('8S', '7H').ok).toBe(true);
    expect(beat('7S', '7H').ok).toBe(false); // Sâm: bằng nhau không chặn
    expect(beat('2S', 'AH').ok).toBe(true);
    expect(beat('KS KH', 'QS QD').ok).toBe(true);
    expect(beat('4S 5H 6D', '3S 4H 5D').ok).toBe(true);
    expect(beat('3S 4H 5D', 'AS 2H 3D').ok).toBe(true);
  });

  it('khác loại hoặc khác độ dài không chặn được', () => {
    expect(beat('9S 9H', '8S').ok).toBe(false);
    expect(beat('4S 5H 6D 7C', '3S 4H 5D').ok).toBe(false);
  });

  it('tứ quý chặt 2 lẻ theo cấu hình', () => {
    expect(beat('5S 5H 5D 5C', '2H')).toEqual({ ok: true, cut: 'two' });
    expect(beat('5S 5H 5D 5C', '2H', { ...R, quadBeatsTwo: false }).ok).toBe(false);
  });

  it('tứ quý chặt đôi 2 chỉ khi bật', () => {
    expect(beat('5S 5H 5D 5C', '2H 2S').ok).toBe(false);
    expect(beat('5S 5H 5D 5C', '2H 2S', { ...R, quadBeatsPairTwo: true })).toEqual({ ok: true, cut: 'pairTwo' });
  });

  it('tứ quý lớn chặt tứ quý nhỏ', () => {
    expect(beat('9S 9H 9D 9C', '5S 5H 5D 5C')).toEqual({ ok: true, cut: 'quad' });
  });

  it('tứ quý không chặt bài lẻ thường', () => {
    expect(beat('9S 9H 9D 9C', 'AS').ok).toBe(false);
  });
});

describe('Sâm — liệt kê tổ hợp', () => {
  it('liệt kê lẻ, đôi và sảnh', () => {
    const list = enumerateCombos(c('3S 4S 5H 5D'), R);
    const types = list.map((x) => `${x.type}:${x.length}`);
    expect(types).toContain('single:1');
    expect(types).toContain('pair:2');
    expect(types).toContain('straight:3');
  });
});

describe('Sâm — ăn trắng', () => {
  const kinds = [...INSTANT_WIN_KINDS];
  it('tứ quý 2', () => {
    expect(detectInstantWin(c('2S 2H 2D 2C 3S 5H 7D 9C JS KH'), kinds, R)).toBe('fourTwos');
  });
  it('sảnh rồng', () => {
    expect(detectInstantWin(c('3S 4H 5D 6C 7S 8H 9D 10C JS QH'), kinds, R)).toBe('dragon');
  });
  it('5 đôi', () => {
    expect(detectInstantWin(c('3S 3H 5D 5C 7S 7H 9D 9C JS JH'), kinds, R)).toBe('fivePairs');
  });
  it('3 sám cô', () => {
    expect(detectInstantWin(c('3S 3H 3D 5C 5S 5H 9D 9C 9S JH'), kinds, R)).toBe('threeTriples');
  });
  it('đồng màu', () => {
    expect(detectInstantWin(c('3D 4H 6D 7H 8D 9H 10D JH QD KH'), kinds, R)).toBe('sameColor');
  });
  it('bài thường không ăn trắng, và tôn trọng danh sách bật/tắt', () => {
    expect(detectInstantWin(c('3S 4H 6D 7C 8S 9H JD QC KS 2H'), kinds, R)).toBeNull();
    expect(detectInstantWin(c('2S 2H 2D 2C 3S 5H 7D 9C JS KH'), ['dragon'], R)).toBeNull();
  });
});
