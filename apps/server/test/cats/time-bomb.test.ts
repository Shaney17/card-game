import { describe, expect, it } from 'vitest';
import { catsEngine } from '../../src/games/exploding-cats/engine';
import { CATS_DEFAULT_CONFIG } from '../../src/games/exploding-cats/config';
import { buildAndDeal, planDeck } from '../../src/games/exploding-cats/deck';
import { seededRng } from '../../src/security/rng';
import { act, deckDefs, defs, expectRule, ids, playAndResolve, setup } from './helpers';

const bombOf = (s: ReturnType<typeof setup>) => s.timeBombs.map((b) => ({ holderId: b.holderId, turnsLeft: b.turnsLeft }));

describe('Hẹn Giờ: bộ bài', () => {
  it('thêm đúng 1 Mèo Hẹn Giờ vào chồng bài, không chia lên tay', () => {
    const cfg = { ...CATS_DEFAULT_CONFIG, expansions: ['hen-gio'] as never };
    expect(planDeck(cfg, 4)).toMatchObject({ timeBomb: 1, bombs: 3 });
    const { hands, deck } = buildAndDeal(cfg, 4, seededRng(2));
    expect(deck.filter((c) => c.def === 'time_bomb')).toHaveLength(1);
    expect(hands.flat().some((c) => c.def === 'time_bomb')).toBe(false);
  });
});

describe('Mèo Hẹn Giờ', () => {
  it('rút phải: đặt ngửa trước mặt, đếm theo lượt của người giữ, hết giờ không Gỡ Bom thì bị loại', () => {
    let s = setup(['skip', 'skip', 'skip'], ['time_bomb', ...Array(10).fill('cat_pho_bo')].join(' '));
    s = act(s, 'p0', 'draw');
    expect(bombOf(s)).toEqual([{ holderId: 'p0', turnsLeft: 3 }]); // lượt rút không tính
    expect(defs(s, 'p0')).toEqual(['skip']);
    expect((catsEngine.projectView(s, 'p1') as any).timeBombs).toEqual([{ holderId: 'p0', turnsLeft: 3 }]);
    s = act(s, 'p1', 'draw');
    s = act(s, 'p2', 'draw');
    expect(bombOf(s)[0].turnsLeft).toBe(3); // lượt người khác không làm giảm
    s = act(s, 'p0', 'draw'); // 2
    s = act(s, 'p1', 'draw');
    s = act(s, 'p2', 'draw');
    s = act(s, 'p0', 'draw'); // 1
    expect(bombOf(s)[0].turnsLeft).toBe(1);
    s = act(s, 'p1', 'draw');
    s = act(s, 'p2', 'draw');
    s = act(s, 'p0', 'draw'); // 0 → nổ
    expect(s.players.p0.alive).toBe(false);
    expect(s.timeBombs).toHaveLength(0);
    expect(s.currentId).toBe('p1');
  });

  it('nổ khi có Gỡ Bom thì chỉ mất Gỡ Bom, bom bị vô hiệu', () => {
    let s = setup(['defuse', 'skip'], 'cat_pho_bo cat_pho_bo cat_pho_bo');
    s.timeBombs = [{ card: { id: 'tb', def: 'time_bomb' }, holderId: 'p0', turnsLeft: 1 }];
    s = act(s, 'p0', 'draw');
    expect(s.players.p0.alive).toBe(true);
    expect(defs(s, 'p0')).toEqual(['cat_pho_bo']);
    expect(s.timeBombs).toHaveLength(0);
    expect(s.currentId).toBe('p1');
  });

  it('Né Lượt và Tấn Công cũng làm bom đếm ngược', () => {
    let s = setup(['skip attack', 'skip'], 'cat_pho_bo cat_pho_bo');
    s.timeBombs = [{ card: { id: 'tb', def: 'time_bomb' }, holderId: 'p0', turnsLeft: 3 }];
    s = playAndResolve(s, 'p0', 'skip');
    expect(bombOf(s)[0].turnsLeft).toBe(2);
    s = act(s, 'p1', 'draw');
    s = playAndResolve(s, 'p0', 'attack');
    expect(bombOf(s)[0].turnsLeft).toBe(1);
  });

  it('Chuyền Bom: chuyển cho người khác, giữ nguyên số lượt; không giữ bom thì không đánh được', () => {
    let s = setup(['pass_bomb pass_bomb', 'skip', 'skip'], 'cat_pho_bo cat_pho_bo');
    expectRule(() => act(s, 'p0', 'play', { cardIds: [ids(s, 'p0', 'pass_bomb')[0]], targetId: 'p2' }), /không giữ/);
    s.timeBombs = [{ card: { id: 'tb', def: 'time_bomb' }, holderId: 'p0', turnsLeft: 2 }];
    s = playAndResolve(s, 'p0', 'pass_bomb', { targetId: 'p2' });
    expect(bombOf(s)).toEqual([{ holderId: 'p2', turnsLeft: 2 }]);
    expect(s.currentId).toBe('p0'); // chuyền bom không kết thúc lượt
  });

  it('Tua Nhanh: trừ 1 lượt mọi bom, nổ ngay nếu về 0', () => {
    let s = setup(['fast_forward', 'skip', 'defuse'], 'cat_pho_bo');
    expectRule(() => act(s, 'p0', 'play', { cardIds: ids(s, 'p0', 'fast_forward') }), /Không có Mèo Hẹn Giờ/);
    s.timeBombs = [
      { card: { id: 'a', def: 'time_bomb' }, holderId: 'p1', turnsLeft: 1 },
      { card: { id: 'b', def: 'time_bomb' }, holderId: 'p2', turnsLeft: 1 },
    ];
    s = playAndResolve(s, 'p0', 'fast_forward');
    expect(s.players.p1.alive).toBe(false);
    expect(s.players.p2.alive).toBe(true); // có Gỡ Bom
    expect(defs(s, 'p2')).toEqual([]);
    expect(s.timeBombs).toHaveLength(0);
  });
});

describe('Ta Lấy Nhé', () => {
  it('lá tiếp theo mục tiêu rút sẽ về tay người giành; lượt của mục tiêu vẫn kết thúc', () => {
    let s = setup(['take_that', 'skip', 'skip'], 'cat_pho_bo attack favor');
    s = playAndResolve(s, 'p0', 'take_that', { targetId: 'p1' });
    expect((catsEngine.projectView(s, 'p2') as any).claims).toEqual([{ targetId: 'p1', claimerId: 'p0' }]);
    s = act(s, 'p0', 'draw'); // p0 rút cat_pho_bo
    s = act(s, 'p1', 'draw'); // attack về tay p0
    expect(defs(s, 'p0')).toEqual(['cat_pho_bo', 'attack']);
    expect(defs(s, 'p1')).toEqual(['skip']);
    expect(s.currentId).toBe('p2');
    expect(s.claims).toEqual({});
  });

  it('giành được Mèo Nổ thì người giành phải Gỡ Bom; xong thì lượt của người rút kết thúc', () => {
    let s = setup(['take_that defuse', 'skip', 'skip'], 'cat_pho_bo exploding favor');
    s = playAndResolve(s, 'p0', 'take_that', { targetId: 'p1' });
    s = act(s, 'p0', 'draw');
    s = act(s, 'p1', 'draw');
    expect(s.pending).toMatchObject({ kind: 'defuse', playerId: 'p0', endsTurn: true });
    s = act(s, 'p0', 'placeBomb', { position: 1 });
    expect(s.currentId).toBe('p2');
    expect(deckDefs(s)).toEqual(['favor', 'exploding']);
  });

  it('giành được Mèo Nổ mà không có Gỡ Bom thì người giành bị loại', () => {
    let s = setup(['take_that', 'skip', 'skip'], 'cat_pho_bo exploding favor');
    s = playAndResolve(s, 'p0', 'take_that', { targetId: 'p1' });
    s = act(s, 'p0', 'draw');
    s = act(s, 'p1', 'draw');
    expect(s.players.p0.alive).toBe(false);
    expect(s.players.p1.alive).toBe(true);
    expect(s.currentId).toBe('p2');
  });

  it('không giành chồng lên cùng một người', () => {
    let s = setup(['take_that take_that', 'skip'], 'cat_pho_bo');
    s = playAndResolve(s, 'p0', 'take_that', { targetId: 'p1' });
    expectRule(() => act(s, 'p0', 'play', { cardIds: [ids(s, 'p0', 'take_that')[0]], targetId: 'p1' }), /đã có người giành/);
  });
});
