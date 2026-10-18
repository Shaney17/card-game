import { describe, expect, it } from 'vitest';
import { samEngine } from '../../src/games/sam/engine';
import { SAM_DEFAULT_CONFIG, type SamConfig } from '../../src/games/sam/config';
import type { SamState } from '../../src/games/sam/state';
import { seededRng } from '../../src/security/rng';
import { GameRuleError } from '../../src/game-registry/types';

const ctx = (now = 1000) => ({ rng: seededRng(1), now });
const players = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, nickname: `Người ${i}` }));

/** Tạo ván với bài định sẵn, bỏ qua giai đoạn báo Sâm. */
function setup(hands: string[], cfg: Partial<SamConfig> = {}, starter = 0): SamState {
  const config = { ...SAM_DEFAULT_CONFIG, enableInstantWin: false, enableSam: false, ...cfg };
  const { state } = samEngine.createRound(players(hands.length), config, ctx(), { roundId: 'r1', previousWinnerId: `p${starter}` });
  state.players.forEach((p, i) => (p.hand = hands[i].split(' ')));
  return state;
}

const act = (s: SamState, pid: string, type: string, payload: unknown = {}, now = 2000) =>
  samEngine.applyAction(s, pid, type, payload, ctx(now)).state;

function expectRule(fn: () => unknown, msg?: RegExp) {
  expect(fn).toThrow(GameRuleError);
  if (msg) expect(fn).toThrow(msg);
}

describe('Sâm engine — chia bài', () => {
  it('chia mỗi người 10 lá không trùng, người thắng ván trước đánh trước', () => {
    const { state } = samEngine.createRound(players(5), { ...SAM_DEFAULT_CONFIG, enableInstantWin: false }, ctx(), {
      roundId: 'r',
      previousWinnerId: 'p3',
    });
    const all = state.players.flatMap((p) => p.hand);
    expect(all).toHaveLength(50);
    expect(new Set(all).size).toBe(50);
    expect(state.phase).toBe('DECLARE');
    expect(state.starterIdx).toBe(3);
  });

  it('kiểm tra số người hợp lệ', () => {
    expect(samEngine.validateStart(SAM_DEFAULT_CONFIG, 1)).toMatch(/ít nhất 2/);
    expect(samEngine.validateStart(SAM_DEFAULT_CONFIG, 6)).toMatch(/tối đa 5/);
    expect(samEngine.validateStart(SAM_DEFAULT_CONFIG, 5)).toBeNull();
  });
});

describe('Sâm engine — lượt và chặn bài', () => {
  it('không cho đánh khi chưa đến lượt hoặc bài không có trên tay', () => {
    const s = setup(['3S 4S', '5H 6H']);
    expectRule(() => act(s, 'p1', 'play', { cards: ['5H'] }), /Chưa đến lượt/);
    expectRule(() => act(s, 'p0', 'play', { cards: ['9S'] }), /không có/);
    expectRule(() => act(s, 'p0', 'play', { cards: ['3S', '4S'] }), /không hợp lệ/);
  });

  it('người dẫn vòng không được bỏ lượt', () => {
    const s = setup(['3S 4S', '5H 6H']);
    expectRule(() => act(s, 'p0', 'pass'), /dẫn vòng/);
  });

  it('phải chặn đúng loại; bỏ lượt hết thì người đánh cuối dẫn vòng mới', () => {
    let s = setup(['3S 9S KD', '5H 6H 8D', '4C 7C JC']);
    s = act(s, 'p0', 'play', { cards: ['3S'] });
    expect(s.turn).toBe(1);
    expectRule(() => act(s, 'p1', 'play', { cards: ['5H', '6H'] }));
    s = act(s, 'p1', 'play', { cards: ['5H'] });
    s = act(s, 'p2', 'pass');
    s = act(s, 'p0', 'pass');
    // Cả p2 và p0 đã bỏ — p1 dẫn vòng mới
    expect(s.turn).toBe(1);
    expect(s.trick).toHaveLength(0);
    expect(s.players.every((p) => !p.passed)).toBe(true);
  });

  it('người đã bỏ lượt không được vào lại vòng đó', () => {
    let s = setup(['3S 9S KD', '5H 6H 8D', '4C 7C JC']);
    s = act(s, 'p0', 'play', { cards: ['3S'] });
    s = act(s, 'p1', 'pass');
    s = act(s, 'p2', 'play', { cards: ['4C'] });
    // lượt quay về p0, p1 bị bỏ qua
    expect(s.turn).toBe(0);
    s = act(s, 'p0', 'play', { cards: ['9S'] });
    expect(s.turn).toBe(2);
  });

  it('hết bài thì thắng và quyết toán theo số lá + thối 2', () => {
    let s = setup(['3S', '5H 6H 2D', '4C 7C JC 9D 9S 9H 9C 10D 10S 10H'], {}, 0);
    s = act(s, 'p0', 'play', { cards: ['3S'] });
    expect(s.phase).toBe('ROUND_FINISHED');
    const out = samEngine.getOutcome(s);
    expect(out.winners).toEqual(['p0']);
    const sum = out.settlements.reduce((a, x) => a + x.amount, 0);
    expect(sum).toBe(0);
    const delta = (id: string) => out.settlements.filter((x) => x.playerId === id).reduce((a, x) => a + x.amount, 0);
    // p1: 3 lá × 10 + thối một quân 2 × 50 = 80
    expect(delta('p1')).toBe(-80);
    // p2 chưa đánh lá nào và còn đủ 10 lá -> cóng 150
    expect(delta('p2')).toBe(-150);
    expect(delta('p0')).toBe(230);
  });

  it('cấm về bằng 2 khi luật bật', () => {
    let s = setup(['3S 2D', '5H 6H 8D']);
    s = act(s, 'p0', 'play', { cards: ['3S'] });
    s = act(s, 'p1', 'pass');
    expectRule(() => act(s, 'p0', 'play', { cards: ['2D'] }), /về bằng quân 2/);
    // chỉ còn quân 2 khi dẫn vòng -> được nhường lượt
    s = act(s, 'p0', 'pass');
    expect(s.turn).toBe(1);
  });

  it('cho phép về bằng 2 khi luật cho phép', () => {
    let s = setup(['3S 2D', '5H 6H 8D'], { lastCardTwo: 'allowed' });
    s = act(s, 'p0', 'play', { cards: ['3S'] });
    s = act(s, 'p1', 'pass');
    s = act(s, 'p0', 'play', { cards: ['2D'] });
    expect(s.phase).toBe('ROUND_FINISHED');
  });

  it('tứ quý chặt 2 ghi nhận tiền chặt', () => {
    let s = setup(['2D 3S', '5H 5S 5D 5C 9H', 'KC QC']);
    s = act(s, 'p0', 'play', { cards: ['2D'] });
    s = act(s, 'p1', 'play', { cards: ['5H', '5S', '5D', '5C'] });
    expect(s.cuts).toEqual([{ cutterId: 'p1', victimId: 'p0', kind: 'two', amount: SAM_DEFAULT_CONFIG.cutTwoPenalty }]);
  });
});

describe('Sâm engine — báo Sâm', () => {
  function declareSetup(hands: string[]) {
    const config = { ...SAM_DEFAULT_CONFIG, enableInstantWin: false, enableSam: true };
    const { state } = samEngine.createRound(players(hands.length), config, ctx(), { roundId: 'r', previousWinnerId: 'p0' });
    state.players.forEach((p, i) => (p.hand = hands[i].split(' ')));
    return state;
  }

  it('báo Sâm thành công khi không ai chặn được', () => {
    let s = declareSetup(['2S 2H', '3S 4D', '5C 6D']);
    s = act(s, 'p1', 'declareSam', { declare: true });
    expect(s.phase).toBe('SAM_DECLARED');
    expect(s.turn).toBe(1);
    s = act(s, 'p1', 'play', { cards: ['3S'] });
    s = act(s, 'p2', 'pass');
    s = act(s, 'p0', 'pass');
    s = act(s, 'p1', 'play', { cards: ['4D'] });
    expect(s.finish?.reason).toBe('samSuccess');
    const out = samEngine.getOutcome(s);
    const delta = (id: string) => out.settlements.filter((x) => x.playerId === id).reduce((a, x) => a + x.amount, 0);
    expect(delta('p1')).toBe(2 * SAM_DEFAULT_CONFIG.samReward);
  });

  it('báo Sâm bị chặn thì thua ngay và đền', () => {
    let s = declareSetup(['2S 2H', '3S 4D', '5C 6D']);
    s = act(s, 'p1', 'declareSam', { declare: true });
    s = act(s, 'p1', 'play', { cards: ['3S'] });
    s = act(s, 'p2', 'play', { cards: ['5C'] });
    expect(s.finish).toEqual({ reason: 'samFail', winnerId: 'p2', blockerId: 'p2' });
    const out = samEngine.getOutcome(s);
    const delta = (id: string) => out.settlements.filter((x) => x.playerId === id).reduce((a, x) => a + x.amount, 0);
    expect(delta('p1')).toBe(-2 * SAM_DEFAULT_CONFIG.samPenalty);
    expect(delta('p0')).toBe(SAM_DEFAULT_CONFIG.samPenalty);
  });

  it('chỉ báo Sâm trong thời gian cho phép, hết giờ thì vào ván thường', () => {
    let s = declareSetup(['2S 2H', '3S 4D', '5C 6D']);
    expectRule(() => act(s, 'p0', 'play', { cards: ['2S'] }), /báo Sâm/);
    s = samEngine.onDeadline(s, ctx(1000 + SAM_DEFAULT_CONFIG.samDeclareMs + 1)).state;
    expect(s.phase).toBe('PLAYING');
    expectRule(() => act(s, 'p1', 'declareSam', { declare: true }), /hết thời điểm/);
  });

  it('mọi người đều không báo thì bắt đầu ngay', () => {
    let s = declareSetup(['2S 2H', '3S 4D']);
    s = act(s, 'p0', 'declareSam', { declare: false });
    s = act(s, 'p1', 'declareSam', { declare: false });
    expect(s.phase).toBe('PLAYING');
  });
});

describe('Sâm engine — hết giờ và rời bàn', () => {
  it('hết giờ khi dẫn vòng thì đánh lá nhỏ nhất, khi chặn thì bỏ lượt', () => {
    let s = setup(['9S 3S KD', '5H 6H 8D', '4C 7C']);
    s = samEngine.onDeadline(s, ctx(s.deadline! + 1)).state;
    expect(s.trick[0].combo.cards).toEqual(['3S']);
    s = samEngine.onDeadline(s, ctx(s.deadline! + 1)).state;
    expect(s.players[1].passed).toBe(true);
  });

  it('người rời bàn được máy đánh thay với thời gian ngắn', () => {
    let s = setup(['9S 3S KD', '5H 6H 8D']);
    s = samEngine.onPlayerGone(s, 'p0', ctx(1500)).state;
    expect(s.players[0].auto).toBe(true);
    expect(s.deadline).toBeLessThanOrEqual(1500 + 1200);
  });

  it('không làm thay đổi state đầu vào', () => {
    const s = setup(['9S 3S KD', '5H 6H 8D']);
    const snapshot = JSON.stringify(s);
    act(s, 'p0', 'play', { cards: ['3S'] });
    expect(JSON.stringify(s)).toBe(snapshot);
  });
});

describe('Sâm engine — dữ liệu riêng tư', () => {
  it('người xem chỉ thấy bài của mình, khán giả không thấy bài ai', () => {
    const s = setup(['9S 3S KD', '5H 6H 8D']);
    const v0 = samEngine.projectView(s, 'p0') as any;
    expect(v0.myHand).toEqual(['9S', '3S', 'KD']);
    expect(v0.players[1].cards).toBeNull();
    expect(v0.players[1].cardCount).toBe(3);
    const spectator = samEngine.projectView(s, null) as any;
    expect(spectator.myHand).toBeNull();
    expect(JSON.stringify(spectator)).not.toContain('5H');
  });
});
