import { z } from 'zod';
import {
  GameRuleError,
  type EngineContext,
  type EngineLog,
  type EngineResult,
  type GameEngine,
  type RoundOutcome,
} from '../../game-registry/types';
import { parseCard, RANK_2, shuffledDeck, sortCodes } from './cards';
import { INSTANT_WIN_LABEL, parseSamConfig, SAM_DEFAULT_CONFIG, type SamConfig } from './config';
import { detectInstantWin } from './instant-win';
import { canBeat, describeCombo, detectCombo, enumerateCombos, type Combo, type ComboRules } from './rules';
import { computeTransfers, transfersToSettlements } from './scoring';
import type { SamPlayerState, SamState } from './state';

export const SAM_RULES_VERSION = 'sam-loc-1.0.0';
/** Thời gian chờ lượt của người đã rời bàn (máy tự đánh). */
const AUTO_TURN_MS = 1200;

const playSchema = z.object({ cards: z.array(z.string().max(4)).min(1).max(10) }).strict();
const declareSchema = z.object({ declare: z.boolean() }).strict();

function rulesOf(cfg: SamConfig): ComboRules {
  return { lowStraights: cfg.lowStraights, quadBeatsTwo: cfg.quadBeatsTwo, quadBeatsPairTwo: cfg.quadBeatsPairTwo };
}

function clone(s: SamState): SamState {
  return structuredClone(s);
}

function nameOf(s: SamState, id: string) {
  return s.players.find((p) => p.id === id)?.nickname ?? '?';
}

function turnDeadline(s: SamState, now: number): number {
  const p = s.players[s.turn];
  return now + (p.auto ? AUTO_TURN_MS : s.config.turnTimeMs);
}

function isLeading(s: SamState) {
  return s.trick.length === 0;
}

/** Bộ có làm người chơi "về bằng 2" khi luật cấm không. */
function violatesLastTwo(s: SamState, p: SamPlayerState, combo: Combo) {
  return s.config.lastCardTwo === 'forbidden' && combo.hasTwo && p.hand.length === combo.length;
}

/** Khi đang dẫn vòng mà mọi bộ đều vi phạm luật "về bằng 2" thì được phép nhường. */
function leaderStuck(s: SamState, p: SamPlayerState) {
  return enumerateCombos(p.hand, rulesOf(s.config)).every((c) => violatesLastTwo(s, p, c));
}

function startPlay(s: SamState, starterIdx: number, now: number, logs: EngineLog[]) {
  s.turn = starterIdx;
  s.phase = s.samDeclarerId ? 'SAM_DECLARED' : 'PLAYING';
  s.deadline = turnDeadline(s, now);
  logs.push({ text: `${s.players[starterIdx].nickname} đánh trước.`, kind: 'info', sfx: 'turn' });
}

function finishRound(s: SamState, finish: SamState['finish'], logs: EngineLog[]) {
  s.finish = finish;
  s.phase = 'ROUND_FINISHED';
  s.deadline = null;
  const f = finish!;
  const w = nameOf(s, f.winnerId);
  if (f.reason === 'instant') logs.push({ text: `${w} ăn trắng với ${INSTANT_WIN_LABEL[f.instantKind!]}!`, kind: 'win', sfx: 'win' });
  else if (f.reason === 'samSuccess') logs.push({ text: `${w} báo Sâm thành công!`, kind: 'win', sfx: 'win' });
  else if (f.reason === 'samFail')
    logs.push({
      text: `${nameOf(s, s.samDeclarerId!)} báo Sâm thất bại — bị ${nameOf(s, f.blockerId!)} chặn. ${w} thắng ván.`,
      kind: 'lose',
      sfx: 'lose',
    });
  else logs.push({ text: `${w} đã hết bài và thắng ván!`, kind: 'win', sfx: 'win' });
}

/** Chuyển lượt sau khi `from` vừa đánh hoặc bỏ lượt. */
function advance(s: SamState, from: number, now: number, logs: EngineLog[]) {
  const n = s.players.length;
  const owner = s.trick.length ? s.players.findIndex((p) => p.id === s.trick[s.trick.length - 1].playerId) : -1;
  for (let step = 1; step <= n; step++) {
    const i = (from + step) % n;
    if (i === owner) {
      s.trick = [];
      for (const p of s.players) p.passed = false;
      s.turn = i;
      logs.push({ text: `Mọi người bỏ lượt — ${s.players[i].nickname} được đánh vòng mới.`, kind: 'info', sfx: 'turn' });
      s.deadline = turnDeadline(s, now);
      return;
    }
    if (!s.players[i].passed) {
      s.turn = i;
      s.deadline = turnDeadline(s, now);
      return;
    }
  }
  // Không ai còn lượt (không xảy ra nếu dữ liệu đúng) — người vừa đi dẫn vòng mới.
  s.trick = [];
  for (const p of s.players) p.passed = false;
  s.turn = from;
  s.deadline = turnDeadline(s, now);
}

function doPlay(s: SamState, idx: number, cards: string[], now: number, logs: EngineLog[]) {
  const p = s.players[idx];
  const hand = new Set(p.hand);
  if (!cards.every((c) => hand.has(c))) throw new GameRuleError('Bạn không có những lá bài này.');
  const rules = rulesOf(s.config);
  const combo = detectCombo(sortCodes(cards), rules);
  if (!combo) throw new GameRuleError('Tổ hợp bài không hợp lệ.');
  if (violatesLastTwo(s, p, combo)) throw new GameRuleError('Luật bàn này không cho phép về bằng quân 2.');
  const top = s.trick[s.trick.length - 1];
  let cut: ReturnType<typeof canBeat>['cut'];
  if (top) {
    const check = canBeat(combo, top.combo, rules);
    if (!check.ok) throw new GameRuleError(`Bộ này không chặn được ${describeCombo(top.combo)}.`);
    cut = check.cut;
  }
  p.hand = p.hand.filter((c) => !cards.includes(c));
  p.playedAny = true;
  s.seq += 1;
  s.trick.push({ playerId: p.id, combo, cut, seq: s.seq });
  if (cut && top) {
    const amount =
      cut === 'two' ? s.config.cutTwoPenalty : cut === 'pairTwo' ? s.config.cutPairTwoPenalty : s.config.cutQuadPenalty;
    s.cuts.push({ cutterId: p.id, victimId: top.playerId, kind: cut, amount });
    logs.push({
      text: `${p.nickname} chặt ${describeCombo(top.combo)} của ${nameOf(s, top.playerId)} bằng ${describeCombo(combo)}!`,
      kind: 'warn',
      sfx: 'cut',
    });
  } else {
    logs.push({ text: `${p.nickname} đánh ${describeCombo(combo)}.`, kind: 'play', sfx: combo.hasTwo ? 'playStrong' : 'play' });
  }
  if (p.hand.length === 1) logs.push({ text: `${p.nickname} báo 1 lá!`, kind: 'warn', sfx: 'alert' });

  // Sâm đã báo: người khác chặn được là Sâm thất bại ngay.
  if (s.phase === 'SAM_DECLARED' && p.id !== s.samDeclarerId) {
    finishRound(s, { reason: 'samFail', winnerId: p.id, blockerId: p.id }, logs);
    return;
  }
  if (p.hand.length === 0) {
    finishRound(s, { reason: s.phase === 'SAM_DECLARED' ? 'samSuccess' : 'normal', winnerId: p.id }, logs);
    return;
  }
  advance(s, idx, now, logs);
}

function doPass(s: SamState, idx: number, now: number, logs: EngineLog[], timedOut = false) {
  const p = s.players[idx];
  if (isLeading(s)) {
    if (!leaderStuck(s, p)) throw new GameRuleError('Bạn đang dẫn vòng nên phải đánh bài.');
    logs.push({ text: `${p.nickname} chỉ còn quân 2 nên nhường lượt dẫn.`, kind: 'info', sfx: 'pass' });
    // Nhường: người kế tiếp dẫn vòng mới.
    s.turn = (idx + 1) % s.players.length;
    s.deadline = turnDeadline(s, now);
    return;
  }
  p.passed = true;
  logs.push({ text: timedOut ? `${p.nickname} hết giờ — tự bỏ lượt.` : `${p.nickname} bỏ lượt.`, kind: 'info', sfx: 'pass' });
  advance(s, idx, now, logs);
}

/** Nước đi tự động khi hết giờ / người chơi đã rời bàn. */
function autoMove(s: SamState, now: number, logs: EngineLog[]) {
  const idx = s.turn;
  const p = s.players[idx];
  if (!isLeading(s)) return doPass(s, idx, now, logs, !p.auto);
  const legal = enumerateCombos(p.hand, rulesOf(s.config))
    .filter((c) => !violatesLastTwo(s, p, c))
    .sort((a, b) => (a.type === 'single' ? 0 : 1) - (b.type === 'single' ? 0 : 1) || a.value - b.value);
  if (legal.length === 0) return doPass(s, idx, now, logs, true);
  if (!p.auto) logs.push({ text: `${p.nickname} hết giờ — hệ thống đánh lá nhỏ nhất.`, kind: 'info' });
  doPlay(s, idx, legal[0].cards, now, logs);
}

function resolveDeclarePhase(s: SamState, now: number, logs: EngineLog[], starterIdx: number) {
  const yes = s.players.find((p) => p.samChoice === 'yes');
  if (yes) {
    s.samDeclarerId = yes.id;
    logs.push({ text: `${yes.nickname} BÁO SÂM! Cả bàn phải chặn được bộ bài của ${yes.nickname}.`, kind: 'warn', sfx: 'sam' });
    startPlay(s, s.players.indexOf(yes), now, logs);
  } else {
    for (const p of s.players) p.samChoice ??= 'no';
    logs.push({ text: 'Không ai báo Sâm. Bắt đầu đánh!', kind: 'info' });
    startPlay(s, starterIdx, now, logs);
  }
}

export const samEngine: GameEngine<SamConfig, SamState> = {
  id: 'sam',
  rulesVersion: SAM_RULES_VERSION,
  minPlayers: 2,
  maxPlayers: 5,
  usesBalance: true,
  defaultConfig: SAM_DEFAULT_CONFIG,
  parseConfig: parseSamConfig,
  maxPlayersFor: (cfg) => cfg.maxPlayers,

  validateStart(cfg, count) {
    if (count < 2) return 'Cần ít nhất 2 người để bắt đầu ván Sâm.';
    if (count > cfg.maxPlayers) return `Bàn Sâm chỉ cho tối đa ${cfg.maxPlayers} người.`;
    if (count * cfg.handSize > 52) return 'Không đủ bài để chia.';
    return null;
  },

  createRound(players, cfg, ctx, info) {
    const deck = shuffledDeck(ctx.rng);
    const logs: EngineLog[] = [{ text: 'Xáo bài và chia mỗi người 10 lá.', kind: 'info', sfx: 'deal' }];
    const ps: SamPlayerState[] = players.map((pl, i) => ({
      id: pl.id,
      nickname: pl.nickname,
      hand: sortCodes(deck.slice(i * cfg.handSize, (i + 1) * cfg.handSize)),
      passed: false,
      playedAny: false,
      samChoice: null,
      auto: false,
    }));
    const prevIdx = info.previousWinnerId ? ps.findIndex((p) => p.id === info.previousWinnerId) : -1;
    const starterIdx = prevIdx >= 0 ? prevIdx : ctx.rng.int(ps.length);
    const s: SamState = {
      roundId: info.roundId,
      config: cfg,
      phase: 'DECLARE',
      players: ps,
      turn: starterIdx,
      trick: [],
      samDeclarerId: null,
      cuts: [],
      finish: null,
      deadline: null,
      seq: 0,
      starterIdx,
    };
    if (cfg.enableInstantWin && cfg.instantWinKinds.length) {
      // Thứ tự xét: bắt đầu từ người đánh trước.
      for (let k = 0; k < ps.length; k++) {
        const p = ps[(starterIdx + k) % ps.length];
        const kind = detectInstantWin(p.hand, cfg.instantWinKinds, rulesOf(cfg));
        if (kind) {
          finishRound(s, { reason: 'instant', winnerId: p.id, instantKind: kind }, logs);
          return { state: s, logs };
        }
      }
    }
    if (cfg.enableSam) {
      s.deadline = ctx.now + cfg.samDeclareMs;
      logs.push({ text: 'Ai muốn báo Sâm thì báo ngay bây giờ!', kind: 'info', sfx: 'turn' });
    } else {
      startPlay(s, starterIdx, ctx.now, logs);
    }
    return { state: s, logs };
  },

  applyAction(state, playerId, type, payload, ctx) {
    const s = clone(state);
    const logs: EngineLog[] = [];
    const idx = s.players.findIndex((p) => p.id === playerId);
    if (idx < 0) throw new GameRuleError('Bạn không tham gia ván này.', 'NOT_IN_ROUND');
    const p = s.players[idx];
    if (s.phase === 'ROUND_FINISHED') throw new GameRuleError('Ván đã kết thúc.');

    if (type === 'declareSam') {
      const { declare } = parseOrThrow(declareSchema, payload);
      if (s.phase !== 'DECLARE') throw new GameRuleError('Đã hết thời điểm báo Sâm.');
      if (p.samChoice !== null) throw new GameRuleError('Bạn đã chọn rồi.');
      p.samChoice = declare ? 'yes' : 'no';
      if (declare) {
        resolveDeclarePhase(s, ctx.now, logs, s.starterIdx);
      } else {
        logs.push({ text: `${p.nickname} không báo Sâm.`, kind: 'info' });
        if (s.players.every((x) => x.samChoice !== null)) resolveDeclarePhase(s, ctx.now, logs, s.starterIdx);
      }
      return { state: s, logs };
    }

    if (s.phase === 'DECLARE') throw new GameRuleError('Đang chờ mọi người quyết định báo Sâm.');
    if (s.turn !== idx) throw new GameRuleError('Chưa đến lượt của bạn.', 'NOT_YOUR_TURN');

    if (type === 'play') {
      const { cards } = parseOrThrow(playSchema, payload);
      doPlay(s, idx, cards, ctx.now, logs);
    } else if (type === 'pass') {
      doPass(s, idx, ctx.now, logs);
    } else {
      throw new GameRuleError('Hành động không được hỗ trợ.', 'UNKNOWN_ACTION');
    }
    return { state: s, logs };
  },

  getDeadline: (s) => s.deadline,

  onDeadline(state, ctx) {
    const s = clone(state);
    const logs: EngineLog[] = [];
    if (s.deadline === null || ctx.now < s.deadline) return { state, logs };
    if (s.phase === 'DECLARE') resolveDeclarePhase(s, ctx.now, logs, s.starterIdx);
    else if (s.phase === 'PLAYING' || s.phase === 'SAM_DECLARED') autoMove(s, ctx.now, logs);
    return { state: s, logs };
  },

  onPlayerGone(state, playerId, ctx) {
    const s = clone(state);
    const logs: EngineLog[] = [];
    const p = s.players.find((x) => x.id === playerId);
    if (!p || p.auto || s.phase === 'ROUND_FINISHED') return { state, logs };
    p.auto = true;
    logs.push({ text: `${p.nickname} đã rời bàn — máy sẽ tự đánh thay tới hết ván.`, kind: 'warn' });
    if (s.phase === 'DECLARE' && p.samChoice === null) {
      p.samChoice = 'no';
      if (s.players.every((x) => x.samChoice !== null)) resolveDeclarePhase(s, ctx.now, logs, s.starterIdx);
    } else if (s.players[s.turn]?.id === playerId) {
      s.deadline = Math.min(s.deadline ?? Infinity, ctx.now + AUTO_TURN_MS);
    }
    return { state: s, logs };
  },

  shiftDeadlines(state, delta) {
    const s = clone(state);
    if (s.deadline !== null) s.deadline += delta;
    return s;
  },

  tablePolicy: (cfg) => ({ midRoundJoin: cfg.midRoundJoin, disconnectGraceMs: cfg.disconnectTimeoutMs }),

  isFinished: (s) => s.phase === 'ROUND_FINISHED',

  getOutcome(s): RoundOutcome {
    const f = s.finish!;
    const transfers = computeTransfers(s);
    const w = nameOf(s, f.winnerId);
    const title =
      f.reason === 'instant'
        ? `${w} ăn trắng — ${INSTANT_WIN_LABEL[f.instantKind!]}`
        : f.reason === 'samSuccess'
          ? `${w} báo Sâm thành công!`
          : f.reason === 'samFail'
            ? `${nameOf(s, s.samDeclarerId!)} báo Sâm thất bại`
            : `${w} thắng ván`;
    return {
      winners: [f.winnerId],
      title,
      settlements: transfersToSettlements(transfers),
      detail: {
        reason: f.reason,
        winnerId: f.winnerId,
        blockerId: f.blockerId ?? null,
        samDeclarerId: s.samDeclarerId,
        instantKind: f.instantKind ?? null,
        hands: s.players.map((p) => ({
          playerId: p.id,
          cards: p.hand,
          twos: p.hand.map(parseCard).filter((c) => c.rank === RANK_2).length,
          cong: !p.playedAny && p.hand.length === s.config.handSize,
        })),
      },
    };
  },

  projectView(s, viewerId) {
    const me = s.players.find((p) => p.id === viewerId);
    const finished = s.phase === 'ROUND_FINISHED';
    const top = s.trick[s.trick.length - 1];
    let canPass = false;
    if (me && !finished && s.phase !== 'DECLARE' && s.players[s.turn].id === me.id) {
      canPass = !isLeading(s) || leaderStuck(s, me);
    }
    return {
      phase: s.phase,
      turnPlayerId: s.phase === 'DECLARE' || finished ? null : s.players[s.turn].id,
      leading: isLeading(s),
      deadline: s.deadline,
      samDeclarerId: s.samDeclarerId,
      players: s.players.map((p) => ({
        id: p.id,
        nickname: p.nickname,
        cardCount: p.hand.length,
        passed: p.passed,
        auto: p.auto,
        samDecided: p.samChoice !== null,
        // Bài chỉ lộ cho chính chủ, hoặc cho mọi người khi ván đã kết thúc.
        cards: p.id === viewerId || finished ? p.hand : null,
      })),
      myHand: me ? me.hand : null,
      mySamChoice: me ? me.samChoice : null,
      canPass,
      trick: s.trick.slice(-4).map((t) => ({
        playerId: t.playerId,
        cards: t.combo.cards,
        type: t.combo.type,
        label: describeCombo(t.combo),
        cut: t.cut ?? null,
        seq: t.seq,
      })),
      toBeat: top ? { type: top.combo.type, length: top.combo.length, label: describeCombo(top.combo) } : null,
      rules: {
        lowStraights: s.config.lowStraights,
        quadBeatsTwo: s.config.quadBeatsTwo,
        quadBeatsPairTwo: s.config.quadBeatsPairTwo,
        lastCardTwo: s.config.lastCardTwo,
      },
    };
  },
};

function parseOrThrow<T>(schema: z.ZodType<T>, payload: unknown): T {
  const r = schema.safeParse(payload ?? {});
  if (!r.success) throw new GameRuleError('Dữ liệu hành động không hợp lệ.', 'BAD_PAYLOAD');
  return r.data;
}
