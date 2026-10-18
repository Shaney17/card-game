import { describe, expect, it } from 'vitest';
import { catsEngine } from '../../src/games/exploding-cats/engine';
import { CATS_DEFAULT_CONFIG } from '../../src/games/exploding-cats/config';
import { buildAndDeal, planDeck } from '../../src/games/exploding-cats/deck';
import { seededRng } from '../../src/security/rng';
import { act, ctx, deckDefs, defs, expectRule, ids, passAll, playAndResolve, setup } from './helpers';

describe('Bộ bài với các bản mở rộng', () => {
  it('số Mèo Nổ: +1 với Tăng Tốc, −1 (thay bằng Mèo Sập Nguồn) với Hỗn Loạn', () => {
    const base = planDeck({ ...CATS_DEFAULT_CONFIG, expansions: [] }, 4);
    const streak = planDeck({ ...CATS_DEFAULT_CONFIG, expansions: ['tang-toc'] }, 4);
    const implode = planDeck({ ...CATS_DEFAULT_CONFIG, expansions: ['hon-loan'] }, 4);
    expect(base).toMatchObject({ bombs: 3, imploding: 0 });
    expect(streak).toMatchObject({ bombs: 4, imploding: 0 });
    expect(implode).toMatchObject({ bombs: 2, imploding: 1 });
  });

  it('chia bài đủ cả 3 bản mở rộng cho 8 người, mọi lá mới đều có mặt', () => {
    const cfg = { ...CATS_DEFAULT_CONFIG, expansions: ['hon-loan', 'tang-toc', 'dao-boi'] as never };
    expect(planDeck(cfg, 8)).not.toBeTypeOf('string');
    const { hands, deck } = buildAndDeal(cfg, 8, seededRng(9));
    const all = new Set([...hands.flat(), ...deck].map((c) => c.def));
    for (const d of ['feral_cat', 'imploding', 'super_skip', 'streaking', 'swap_top_bottom', 'catomic', 'garbage', 'mark', 'bury', 'personal_attack', 'potluck', 'share_future', 'dig_deeper']) {
      expect(all.has(d), d).toBe(true);
    }
    expect(hands.flat().some((c) => c.def === 'imploding' || c.def === 'exploding')).toBe(false);
  });

  it('cấu hình từ chối bản mở rộng không tồn tại hoặc trùng', () => {
    expect(catsEngine.parseConfig({ expansions: ['khong-co'] }).ok).toBe(false);
    expect(catsEngine.parseConfig({ expansions: ['dao-boi', 'dao-boi'] }).ok).toBe(false);
  });
});

describe('Hỗn Loạn: Mèo Hoang & Mèo Sập Nguồn', () => {
  it('Mèo Hoang ghép được với bất kỳ mèo nào', () => {
    let s = setup(['feral_cat cat_pho_bo', 'skip attack'], 'skip');
    s = passAll(act(s, 'p0', 'play', { cardIds: s.players.p0.hand.map((c) => c.id), targetId: 'p1' }));
    expect(s.pending?.kind).toBe('steal_pick');
  });

  it('Mèo Hoang không ghép hai loại mèo khác nhau', () => {
    const s = setup(['feral_cat cat_pho_bo cat_tra_sua', 'skip'], 'skip');
    expectRule(() => act(s, 'p0', 'play', { cardIds: s.players.p0.hand.map((c) => c.id), targetId: 'p1', namedDef: 'skip' }), /giống nhau/);
  });

  it('rút Mèo Sập Nguồn lần đầu: lật ngửa và đặt lại, vị trí công khai; lần hai: bị loại không cứu được', () => {
    let s = setup(['defuse', 'defuse', 'skip'], 'imploding skip skip skip');
    s = act(s, 'p0', 'draw');
    expect(s.pending?.kind).toBe('implode_place');
    s = act(s, 'p0', 'placeImploding', { position: 1 });
    expect(s.deck[1]).toMatchObject({ def: 'imploding', faceUp: true });
    expect(s.currentId).toBe('p1');
    expect((catsEngine.projectView(s, 'p2') as { implodingPos: number }).implodingPos).toBe(1);
    s = act(s, 'p1', 'draw'); // rút skip
    s = act(s, 'p2', 'draw'); // rút Mèo Sập Nguồn ngửa
    expect(s.players.p2.alive).toBe(false);
    expect(s.players.p0.hand.map((c) => c.def)).toEqual(['defuse']); // không ai mất Gỡ Bom
  });
});

describe('Tăng Tốc', () => {
  it('Siêu Né bỏ qua toàn bộ lượt đang phải chơi', () => {
    let s = setup(['attack', 'super_skip', 'skip'], 'skip skip skip');
    s = playAndResolve(s, 'p0', 'attack');
    expect(s.turnsRemaining).toBe(2);
    s = playAndResolve(s, 'p1', 'super_skip');
    expect(s.currentId).toBe('p2');
    expect(s.turnsRemaining).toBe(1);
  });

  it('Mèo Liều: rút Mèo Nổ thì giữ bí mật; công khai chỉ thấy "rút một lá"', () => {
    let s = setup(['streaking', 'skip'], 'exploding skip');
    const res = catsEngine.applyAction(s, 'p0', 'draw', {}, ctx(2000));
    s = res.state;
    expect(defs(s, 'p0')).toEqual(['streaking', 'exploding']);
    expect(s.players.p0.alive).toBe(true);
    const publicLogs = res.logs.filter((l) => !l.visibleTo).map((l) => l.text).join(' ');
    expect(publicLogs).not.toMatch(/Mèo Nổ/);
    // Đối thủ không biết: số bom còn lại vẫn tính cả bom trên tay
    expect((catsEngine.projectView(s, 'p1') as { bombsLeft: number }).bombsLeft).toBe(1);
  });

  it('Mèo Liều rời tay (bị cướp) khi đang giữ bom → phải Gỡ Bom hoặc bị loại', () => {
    let s = setup(['cat_pho_bo cat_pho_bo', 'streaking exploding'], 'skip skip');
    s = passAll(act(s, 'p0', 'play', { cardIds: ids(s, 'p0', 'cat_pho_bo'), targetId: 'p1' }));
    const pending = s.pending as { order: string[] };
    const streakIdx = pending.order.findIndex((id) => s.players.p1.hand.find((c) => c.id === id)?.def === 'streaking');
    s = act(s, 'p0', 'pickSteal', { index: streakIdx });
    // p1 không có Gỡ Bom → bị loại, p0 thắng
    expect(s.players.p1.alive).toBe(false);
    expect(s.winnerId).toBe('p0');
  });

  it('Mèo Liều rời tay nhưng có Gỡ Bom: nhét bom lại mà không mất lượt của người đang chơi', () => {
    let s = setup(['cat_pho_bo cat_pho_bo', 'streaking exploding defuse', 'skip'], 'skip skip');
    s = passAll(act(s, 'p0', 'play', { cardIds: ids(s, 'p0', 'cat_pho_bo'), targetId: 'p1' }));
    const pending = s.pending as { order: string[] };
    const idx = pending.order.findIndex((id) => s.players.p1.hand.find((c) => c.id === id)?.def === 'streaking');
    s = act(s, 'p0', 'pickSteal', { index: idx });
    expect(s.pending).toMatchObject({ kind: 'defuse', playerId: 'p1', endsTurn: false });
    s = act(s, 'p1', 'placeBomb', { position: 0 });
    expect(s.currentId).toBe('p0');
    expect(s.turnsRemaining).toBe(1);
    expect(deckDefs(s)[0]).toBe('exploding');
  });

  it('Đổi Đầu Đuôi', () => {
    let s = setup(['swap_top_bottom', 'skip'], 'exploding skip attack');
    s = playAndResolve(s, 'p0', 'swap_top_bottom');
    expect(deckDefs(s)).toEqual(['attack', 'skip', 'exploding']);
  });

  it('Bom Nguyên Tử đưa mọi Mèo Nổ lên trên cùng và kết thúc lượt', () => {
    let s = setup(['catomic', 'skip'], 'skip exploding attack favor exploding');
    s = playAndResolve(s, 'p0', 'catomic');
    expect(deckDefs(s).slice(0, 2)).toEqual(['exploding', 'exploding']);
    expect(s.deck).toHaveLength(5);
    expect(s.currentId).toBe('p1');
  });

  it('Dọn Rác: mọi người chọn 1 lá xáo vào chồng bài', () => {
    let s = setup(['garbage attack', 'skip favor', 'nope'], 'skip');
    s = playAndResolve(s, 'p0', 'garbage');
    expect(s.pending?.kind).toBe('garbage');
    s = act(s, 'p0', 'garbageCard', { cardId: ids(s, 'p0', 'attack')[0] });
    expectRule(() => act(s, 'p0', 'garbageCard', { cardId: 'x' }), /đã chọn/);
    s = act(s, 'p1', 'garbageCard', { cardId: ids(s, 'p1', 'favor')[0] });
    s = act(s, 'p2', 'garbageCard', { cardId: ids(s, 'p2', 'nope')[0] });
    expect(s.pending).toBeNull();
    expect(s.deck).toHaveLength(4);
    expect(defs(s, 'p0')).toEqual([]);
    expect(defs(s, 'p1')).toEqual(['skip']);
    expect(s.currentId).toBe('p0');
  });

  it('Đánh Dấu: một lá của mục tiêu lộ ra cho cả bàn, hết lộ khi rời tay', () => {
    let s = setup(['mark favor', 'defuse'], 'skip');
    s = playAndResolve(s, 'p0', 'mark', { targetId: 'p1' });
    const v = catsEngine.projectView(s, 'p0') as { players: { id: string; marked: string[] }[] };
    expect(v.players.find((p) => p.id === 'p1')!.marked).toEqual(['defuse']);
    expect((catsEngine.projectView(s, 'p1') as { myMarked: string[] }).myMarked).toHaveLength(1);
    s = playAndResolve(s, 'p0', 'favor', { targetId: 'p1' });
    s = act(s, 'p1', 'giveFavor', { cardId: s.players.p1.hand[0].id });
    const v2 = catsEngine.projectView(s, 'p0') as { players: { id: string; marked: string[] }[] };
    expect(v2.players.find((p) => p.id === 'p1')!.marked).toEqual([]);
  });

  it('Mèo Liều không đánh ra được', () => {
    const s = setup(['streaking', 'skip'], 'skip');
    expectRule(() => act(s, 'p0', 'play', { cardIds: ids(s, 'p0', 'streaking') }), /trên tay/);
  });
});

describe('Đào Bới', () => {
  it('Chôn Bài: rút lá trên cùng (kể cả Mèo Nổ) và chôn lại ở vị trí tuỳ chọn, kết thúc lượt', () => {
    let s = setup(['bury', 'skip'], 'exploding skip attack');
    s = playAndResolve(s, 'p0', 'bury');
    expect(s.pending?.kind).toBe('bury');
    expect((catsEngine.projectView(s, 'p0') as any).pending.cardDef).toBe('exploding');
    expect((catsEngine.projectView(s, 'p1') as any).pending.cardDef).toBeNull();
    s = act(s, 'p0', 'buryCard', { position: 2 });
    expect(deckDefs(s)).toEqual(['skip', 'attack', 'exploding']);
    expect(s.players.p0.alive).toBe(true);
    expect(s.currentId).toBe('p1');
  });

  it('Tự Tấn Công: thêm 2 lượt cho chính mình', () => {
    let s = setup(['personal_attack', 'skip'], 'skip skip skip skip');
    s = playAndResolve(s, 'p0', 'personal_attack');
    expect(s.turnsRemaining).toBe(3);
    s = act(s, 'p0', 'draw');
    s = act(s, 'p0', 'draw');
    expect(s.currentId).toBe('p0');
    s = act(s, 'p0', 'draw');
    expect(s.currentId).toBe('p1');
  });

  it('Góp Lẩu: lần lượt từ người đánh, mỗi người úp 1 lá lên trên cùng', () => {
    let s = setup(['potluck attack', 'favor', 'nope'], 'skip');
    s = playAndResolve(s, 'p0', 'potluck');
    expect(s.pending).toMatchObject({ kind: 'potluck', queue: ['p0', 'p1', 'p2'] });
    expectRule(() => act(s, 'p1', 'potluckCard', { cardId: ids(s, 'p1', 'favor')[0] }), /Chưa đến lượt/);
    s = act(s, 'p0', 'potluckCard', { cardId: ids(s, 'p0', 'attack')[0] });
    s = act(s, 'p1', 'potluckCard', { cardId: ids(s, 'p1', 'favor')[0] });
    s = act(s, 'p2', 'potluckCard', { cardId: ids(s, 'p2', 'nope')[0] });
    expect(deckDefs(s)).toEqual(['nope', 'favor', 'attack', 'skip']);
    expect(s.pending).toBeNull();
  });

  it('Chia Sẻ Tương Lai: sắp xếp xong thì người kế tiếp được xem', () => {
    let s = setup(['share_future', 'skip', 'skip'], 'exploding skip attack favor');
    s = playAndResolve(s, 'p0', 'share_future');
    const top = s.deck.slice(0, 3).map((c) => c.id);
    s = act(s, 'p0', 'alterFuture', { order: [top[2], top[1], top[0]] });
    expect(deckDefs(s).slice(0, 3)).toEqual(['attack', 'skip', 'exploding']);
    expect((catsEngine.projectView(s, 'p1') as any).seeFuture).toMatchObject({ defs: ['attack', 'skip', 'exploding'], from: 'p0' });
    expect((catsEngine.projectView(s, 'p2') as any).seeFuture).toBeNull();
  });

  it('Đào Sâu: bỏ lá trên cùng để rút lá bên dưới', () => {
    let s = setup(['dig_deeper', 'skip'], 'exploding attack skip');
    s = playAndResolve(s, 'p0', 'dig_deeper');
    expect((catsEngine.projectView(s, 'p0') as any).pending.topDef).toBe('exploding');
    expect((catsEngine.projectView(s, 'p1') as any).pending.topDef).toBeNull();
    s = act(s, 'p0', 'digChoice', { keep: false });
    expect(defs(s, 'p0')).toEqual(['attack']);
    expect(deckDefs(s)).toEqual(['exploding', 'skip']);
    expect(s.currentId).toBe('p1');
  });
});

describe('Rút gọn chồng bài', () => {
  it('giữ tối đa max(12, số người × 5) lá thường trong chồng bài', () => {
    const cfg = { ...CATS_DEFAULT_CONFIG, expansions: ['hon-loan', 'tang-toc', 'dao-boi'] as never };
    const normal = (deck: { def: string }[]) => deck.filter((c) => !['exploding', 'imploding', 'defuse'].includes(c.def)).length;
    expect(normal(buildAndDeal(cfg, 3, seededRng(1)).deck)).toBe(15);
    expect(normal(buildAndDeal(cfg, 2, seededRng(1)).deck)).toBe(12);
    expect(normal(buildAndDeal({ ...cfg, trimDeck: false }, 3, seededRng(1)).deck)).toBeGreaterThan(50);
  });
});
