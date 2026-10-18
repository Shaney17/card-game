import { describe, expect, it } from 'vitest';
import { catsEngine } from '../../src/games/exploding-cats/engine';
import { CATS_DEFAULT_CONFIG, type CatsConfig } from '../../src/games/exploding-cats/config';
import { planDeck, buildAndDeal } from '../../src/games/exploding-cats/deck';
import type { CardInst, CatsState } from '../../src/games/exploding-cats/state';
import { seededRng } from '../../src/security/rng';
import { GameRuleError } from '../../src/game-registry/types';

const ctx = (now = 1000) => ({ rng: seededRng(7), now });
const players = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, nickname: `Mèo ${i}` }));

let uid = 0;
const card = (def: string): CardInst => ({ id: `${def}#${uid++}`, def });
const cards = (s: string) => s.split(' ').filter(Boolean).map(card);

/** Ván với bài & chồng bài định sẵn. p0 đi trước. */
function setup(hands: string[], deck: string, cfg: Partial<CatsConfig> = {}): CatsState {
  const config = { ...CATS_DEFAULT_CONFIG, ...cfg };
  const { state } = catsEngine.createRound(players(hands.length), config, ctx(), { roundId: 'r', previousWinnerId: 'p0' });
  hands.forEach((h, i) => (state.players[`p${i}`].hand = cards(h)));
  state.deck = cards(deck);
  return state;
}

const act = (s: CatsState, pid: string, type: string, payload: unknown = {}, now = 2000) =>
  catsEngine.applyAction(s, pid, type, payload, ctx(now)).state;
const handIds = (s: CatsState, pid: string, def: string) => s.players[pid].hand.filter((c) => c.def === def).map((c) => c.id);
/** Mọi người bấm "Cho qua" để xử lý ngay. */
function passAll(s: CatsState) {
  for (const id of s.order) {
    if (s.pending?.kind !== 'action') break;
    const v = catsEngine.projectView(s, id) as any;
    if (v.pending?.canPass) s = act(s, id, 'pass');
  }
  return s;
}
const expectRule = (fn: () => unknown, msg?: RegExp) => {
  expect(fn).toThrow(GameRuleError);
  if (msg) expect(fn).toThrow(msg);
};

describe('Mèo Nổ — bộ bài', () => {
  it('kiểm tra bộ bài tương thích với số người', () => {
    expect(typeof planDeck({ ...CATS_DEFAULT_CONFIG, deckCopies: 1 }, 5)).toBe('object');
    expect(planDeck({ ...CATS_DEFAULT_CONFIG, deckCopies: 1 }, 7)).toMatch(/Gỡ Bom|Mèo Nổ|không đủ/);
    expect(typeof planDeck(CATS_DEFAULT_CONFIG, 8)).toBe('object'); // auto = 2 bộ
    expect(catsEngine.validateStart(CATS_DEFAULT_CONFIG, 1)).toMatch(/ít nhất 2/);
  });

  it('chia đúng: mỗi người 1 Gỡ Bom + handSize lá, chồng bài có (n-1) Mèo Nổ', () => {
    const { hands, deck } = buildAndDeal(CATS_DEFAULT_CONFIG, 4, seededRng(3));
    for (const h of hands) {
      expect(h).toHaveLength(8);
      expect(h.filter((c) => c.def === 'defuse')).toHaveLength(1);
      expect(h.some((c) => c.def === 'exploding')).toBe(false);
    }
    expect(deck.filter((c) => c.def === 'exploding')).toHaveLength(3);
    const ids = [...hands.flat(), ...deck].map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('bộ mở rộng chỉ xuất hiện khi được bật', () => {
    const base = buildAndDeal(CATS_DEFAULT_CONFIG, 3, seededRng(1));
    const all = [...base.hands.flat(), ...base.deck].map((c) => c.def);
    expect(all).not.toContain('reverse');
    const ext = buildAndDeal({ ...CATS_DEFAULT_CONFIG, expansions: ['hon-loan'] }, 3, seededRng(1));
    expect([...ext.hands.flat(), ...ext.deck].map((c) => c.def)).toContain('reverse');
  });
});

describe('Mèo Nổ — lượt chơi', () => {
  it('rút bài kết thúc lượt', () => {
    let s = setup(['skip', 'skip', 'skip'], 'cat_pho_bo cat_pho_bo cat_pho_bo');
    expectRule(() => act(s, 'p1', 'draw'), /Chưa đến lượt/);
    s = act(s, 'p0', 'draw');
    expect(s.currentId).toBe('p1');
    expect(s.players.p0.hand.map((c) => c.def)).toEqual(['skip', 'cat_pho_bo']);
  });

  it('Né Lượt kết thúc lượt mà không rút', () => {
    let s = setup(['skip', 'skip'], 'cat_pho_bo cat_pho_bo');
    s = act(s, 'p0', 'play', { cardIds: handIds(s, 'p0', 'skip') });
    expect(s.pending?.kind).toBe('action');
    s = passAll(s);
    expect(s.currentId).toBe('p1');
    expect(s.deck).toHaveLength(2);
  });

  it('Tấn Công: người kế tiếp chơi 2 lượt, cộng dồn khi đánh tiếp Tấn Công', () => {
    let s = setup(['attack', 'attack', 'skip'], 'cat_pho_bo cat_pho_bo cat_pho_bo cat_pho_bo cat_pho_bo cat_pho_bo');
    s = passAll(act(s, 'p0', 'play', { cardIds: handIds(s, 'p0', 'attack') }));
    expect(s.currentId).toBe('p1');
    expect(s.turnsRemaining).toBe(2);
    s = passAll(act(s, 'p1', 'play', { cardIds: handIds(s, 'p1', 'attack') }));
    expect(s.currentId).toBe('p2');
    expect(s.turnsRemaining).toBe(4);
    s = act(s, 'p2', 'draw');
    expect(s.currentId).toBe('p2');
    expect(s.turnsRemaining).toBe(3);
  });

  it('Tấn Công không cộng dồn khi tắt luật', () => {
    let s = setup(['attack', 'attack', 'skip'], 'cat_pho_bo cat_pho_bo', { attackStacking: false });
    s = passAll(act(s, 'p0', 'play', { cardIds: handIds(s, 'p0', 'attack') }));
    s = passAll(act(s, 'p1', 'play', { cardIds: handIds(s, 'p1', 'attack') }));
    expect(s.turnsRemaining).toBe(2);
  });

  it('lá mèo lẻ và "Không!" không được đánh như hành động chính', () => {
    const s = setup(['cat_pho_bo nope defuse', 'skip'], 'skip');
    expectRule(() => act(s, 'p0', 'play', { cardIds: handIds(s, 'p0', 'cat_pho_bo') }), /theo cặp/);
    expectRule(() => act(s, 'p0', 'play', { cardIds: handIds(s, 'p0', 'nope') }), /chặn/);
    expectRule(() => act(s, 'p0', 'play', { cardIds: handIds(s, 'p0', 'defuse') }), /tự động/);
  });
});

describe('Mèo Nổ — Mèo Nổ & Gỡ Bom', () => {
  it('rút Mèo Nổ khi có Gỡ Bom: chọn vị trí nhét lại bí mật', () => {
    let s = setup(['defuse', 'skip'], 'exploding cat_pho_bo cat_pho_bo');
    s = act(s, 'p0', 'draw');
    expect(s.pending?.kind).toBe('defuse');
    expect(s.players.p0.hand).toHaveLength(0);
    // người khác không được đặt bom
    expectRule(() => act(s, 'p1', 'placeBomb', { position: 0 }));
    s = act(s, 'p0', 'placeBomb', { position: 2 });
    expect(s.deck.map((c) => c.def)).toEqual(['cat_pho_bo', 'cat_pho_bo', 'exploding']);
    expect(s.currentId).toBe('p1');
    // khán giả & đối thủ không thấy vị trí bom
    const v = catsEngine.projectView(s, 'p1') as any;
    expect(JSON.stringify(v)).not.toContain('"deck"');
  });

  it('rút Mèo Nổ không có Gỡ Bom thì bị loại; còn 1 người là thắng', () => {
    let s = setup(['skip', 'skip'], 'exploding cat_pho_bo');
    s = act(s, 'p0', 'draw');
    expect(s.players.p0.alive).toBe(false);
    expect(s.phase).toBe('ROUND_FINISHED');
    expect(s.winnerId).toBe('p1');
    expect(catsEngine.getOutcome(s).winners).toEqual(['p1']);
  });

  it('hết giờ đặt bom thì đặt ngẫu nhiên', () => {
    let s = setup(['defuse', 'skip'], 'exploding cat_pho_bo cat_pho_bo');
    s = act(s, 'p0', 'draw', {}, 2000);
    s = catsEngine.onDeadline(s, ctx(2000 + CATS_DEFAULT_CONFIG.choiceTimeMs + 1)).state;
    expect(s.pending).toBeNull();
    expect(s.deck.filter((c) => c.def === 'exploding')).toHaveLength(1);
  });
});

describe('Mèo Nổ — "Không!"', () => {
  it('một lá "Không!" hủy hành động, hai lá thì khôi phục', () => {
    let s = setup(['skip', 'nope', 'nope'], 'cat_pho_bo cat_pho_bo cat_pho_bo');
    s = act(s, 'p0', 'play', { cardIds: handIds(s, 'p0', 'skip') });
    s = act(s, 'p1', 'nope', { cardId: handIds(s, 'p1', 'nope')[0] });
    s = passAll(s);
    expect(s.currentId).toBe('p0'); // Né Lượt bị hủy
    expect(s.pending).toBeNull();

    let t = setup(['skip', 'nope', 'nope'], 'cat_pho_bo cat_pho_bo cat_pho_bo');
    t = act(t, 'p0', 'play', { cardIds: handIds(t, 'p0', 'skip') });
    t = act(t, 'p1', 'nope', { cardId: handIds(t, 'p1', 'nope')[0] });
    t = act(t, 'p2', 'nope', { cardId: handIds(t, 'p2', 'nope')[0] });
    t = passAll(t);
    expect(t.currentId).toBe('p1'); // Né Lượt có hiệu lực
  });

  it('không tự chặn lá của mình, không chặn khi không có hành động', () => {
    let s = setup(['skip nope', 'nope'], 'cat_pho_bo');
    expectRule(() => act(s, 'p1', 'nope', { cardId: handIds(s, 'p1', 'nope')[0] }), /Không có hành động/);
    s = act(s, 'p0', 'play', { cardIds: handIds(s, 'p0', 'skip') });
    expectRule(() => act(s, 'p0', 'nope', { cardId: handIds(s, 'p0', 'nope')[0] }), /tự chặn/);
  });

  it('hành động chỉ được xử lý khi hết cửa sổ phản ứng', () => {
    let s = setup(['skip', 'skip'], 'cat_pho_bo');
    s = act(s, 'p0', 'play', { cardIds: handIds(s, 'p0', 'skip') }, 2000);
    expect(catsEngine.onDeadline(s, ctx(2500)).state.pending).not.toBeNull();
    s = catsEngine.onDeadline(s, ctx(2000 + CATS_DEFAULT_CONFIG.nopeWindowMs)).state;
    expect(s.pending).toBeNull();
    expect(s.currentId).toBe('p1');
  });

  it('không cho đánh bài khác hoặc rút bài khi đang chờ phản ứng', () => {
    let s = setup(['skip skip', 'skip'], 'cat_pho_bo');
    s = act(s, 'p0', 'play', { cardIds: [handIds(s, 'p0', 'skip')[0]] });
    expectRule(() => act(s, 'p0', 'play', { cardIds: [handIds(s, 'p0', 'skip')[0]] }), /chờ/);
    expectRule(() => act(s, 'p0', 'draw'), /chờ/);
  });
});

describe('Mèo Nổ — mục tiêu & combo', () => {
  it('Xin Xỏ: mục tiêu chọn lá đưa', () => {
    let s = setup(['favor', 'cat_pho_bo attack'], 'skip');
    expectRule(() => act(s, 'p0', 'play', { cardIds: handIds(s, 'p0', 'favor') }), /mục tiêu/);
    s = passAll(act(s, 'p0', 'play', { cardIds: handIds(s, 'p0', 'favor'), targetId: 'p1' }));
    expect(s.pending?.kind).toBe('favor');
    expectRule(() => act(s, 'p0', 'giveFavor', { cardId: handIds(s, 'p1', 'attack')[0] }));
    s = act(s, 'p1', 'giveFavor', { cardId: handIds(s, 'p1', 'attack')[0] });
    expect(s.players.p0.hand.map((c) => c.def)).toEqual(['attack']);
    expect(s.currentId).toBe('p0');
  });

  it('cặp mèo cướp ngẫu nhiên 1 lá', () => {
    let s = setup(['cat_tra_sua cat_tra_sua', 'defuse'], 'skip');
    expectRule(() => act(s, 'p0', 'play', { cardIds: [s.players.p0.hand[0].id, 'x'] }));
    s = passAll(act(s, 'p0', 'play', { cardIds: handIds(s, 'p0', 'cat_tra_sua'), targetId: 'p1' }));
    expect(s.players.p0.hand.map((c) => c.def)).toEqual(['defuse']);
    expect(s.players.p1.hand).toHaveLength(0);
  });

  it('bộ ba mèo đòi đúng lá được gọi tên', () => {
    let s = setup(['cat_xoi_gac cat_xoi_gac cat_xoi_gac', 'skip defuse'], 'skip');
    expectRule(() => act(s, 'p0', 'play', { cardIds: handIds(s, 'p0', 'cat_xoi_gac'), targetId: 'p1' }), /gọi tên/);
    s = passAll(act(s, 'p0', 'play', { cardIds: handIds(s, 'p0', 'cat_xoi_gac'), targetId: 'p1', namedDef: 'defuse' }));
    expect(s.players.p0.hand.map((c) => c.def)).toEqual(['defuse']);
  });

  it('combo phải giống hệt nhau', () => {
    const s = setup(['cat_tra_sua cat_pho_bo', 'skip'], 'skip');
    expectRule(() => act(s, 'p0', 'play', { cardIds: s.players.p0.hand.map((c) => c.id), targetId: 'p1' }), /giống hệt/);
  });
});

describe('Mèo Nổ — thông tin riêng tư', () => {
  it('Mắt Thần chỉ cho người đánh thấy 3 lá trên cùng', () => {
    let s = setup(['see_future', 'skip'], 'attack exploding skip cat_pho_bo');
    s = passAll(act(s, 'p0', 'play', { cardIds: handIds(s, 'p0', 'see_future') }));
    const v0 = catsEngine.projectView(s, 'p0') as any;
    const v1 = catsEngine.projectView(s, 'p1') as any;
    expect(v0.seeFuture.defs).toEqual(['attack', 'exploding', 'skip']);
    expect(v1.seeFuture).toBeNull();
    expect(v1.myHand.map((c: CardInst) => c.def)).toEqual(['skip']);
    expect(JSON.stringify(v1)).not.toContain(s.players.p0.hand[0]?.id ?? '__none__');
  });

  it('bài trên tay đối thủ không bao giờ xuất hiện trong dữ liệu gửi đi', () => {
    const s = setup(['attack favor defuse', 'nope shuffle'], 'skip exploding');
    const v = JSON.stringify(catsEngine.projectView(s, 'p1'));
    for (const c of s.players.p0.hand) expect(v).not.toContain(c.id);
    for (const c of s.deck) expect(v).not.toContain(c.id);
    const spectator = JSON.stringify(catsEngine.projectView(s, null));
    expect(spectator).not.toContain('nope#');
  });
});

describe('Mèo Nổ — bộ mở rộng Hỗn Loạn', () => {
  const ext = { expansions: ['hon-loan' as const] };
  it('Quay Xe đảo chiều', () => {
    let s = setup(['reverse', 'skip', 'skip'], 'cat_pho_bo cat_pho_bo', ext);
    s = passAll(act(s, 'p0', 'play', { cardIds: handIds(s, 'p0', 'reverse') }));
    expect(s.direction).toBe(-1);
    expect(s.currentId).toBe('p2');
  });

  it('Rút Đáy lấy lá dưới cùng', () => {
    let s = setup(['draw_bottom', 'skip'], 'exploding cat_pho_bo', ext);
    s = passAll(act(s, 'p0', 'play', { cardIds: handIds(s, 'p0', 'draw_bottom') }));
    expect(s.players.p0.hand.map((c) => c.def)).toEqual(['cat_pho_bo']);
    expect(s.players.p0.alive).toBe(true);
  });

  it('Sắp Đặt Tương Lai đổi thứ tự 3 lá trên cùng', () => {
    let s = setup(['alter_future', 'skip'], 'exploding skip attack favor', ext);
    s = passAll(act(s, 'p0', 'play', { cardIds: handIds(s, 'p0', 'alter_future') }));
    expect(s.pending?.kind).toBe('alter');
    const top = s.deck.slice(0, 3).map((c) => c.id);
    expectRule(() => act(s, 'p0', 'alterFuture', { order: [top[0], top[0], top[1]] }));
    s = act(s, 'p0', 'alterFuture', { order: [top[2], top[1], top[0]] });
    expect(s.deck.map((c) => c.def)).toEqual(['attack', 'skip', 'exploding', 'favor']);
  });

  it('Tấn Công Chỉ Định chuyển lượt cho mục tiêu', () => {
    let s = setup(['targeted_attack', 'skip', 'skip', 'skip'], 'cat_pho_bo', ext);
    s = passAll(act(s, 'p0', 'play', { cardIds: handIds(s, 'p0', 'targeted_attack'), targetId: 'p2' }));
    expect(s.currentId).toBe('p2');
    expect(s.turnsRemaining).toBe(2);
  });
});

describe('Mèo Nổ — rời ván', () => {
  it('người rời ván bị loại và lượt chuyển tiếp', () => {
    let s = setup(['skip', 'skip', 'skip'], 'cat_pho_bo');
    s = catsEngine.onPlayerGone(s, 'p0', ctx(3000)).state;
    expect(s.players.p0.alive).toBe(false);
    expect(s.currentId).toBe('p1');
  });

  it('người phải đưa bài rời ván thì Xin Xỏ mất tác dụng', () => {
    let s = setup(['favor', 'skip', 'skip'], 'cat_pho_bo');
    s = passAll(act(s, 'p0', 'play', { cardIds: handIds(s, 'p0', 'favor'), targetId: 'p1' }));
    s = catsEngine.onPlayerGone(s, 'p1', ctx(3000)).state;
    expect(s.pending).toBeNull();
    expect(s.currentId).toBe('p0');
  });
});
