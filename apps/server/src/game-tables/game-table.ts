import type {
  Ack,
  ActionEnvelope,
  GameMeta,
  LobbyGameSummary,
  LogEntry,
  RoundResultView,
  SeatView,
  TableStatus,
  TableView,
} from '@chieu-bai/shared';
import { z } from 'zod';
import type { PlayerDirectory } from '../auth/players';
import { GameRuleError, type EngineLog, type EngineResult, type GameEngine } from '../game-registry/types';
import type { Store } from '../persistence/db';
import { cryptoRng, randomId, type Rng } from '../security/rng';

interface Seat {
  playerId: string;
  seat: number;
  connected: boolean;
  disconnectedAt: number | null;
  ready: boolean;
  waiting: boolean;
  leaving: boolean;
  goneHandled: boolean;
}

interface StoredLog extends LogEntry {
  visibleTo?: string[];
}

interface Round {
  id: string;
  number: number;
  state: unknown;
  stateVersion: number;
  players: string[];
}

export interface TableOptions {
  now?: () => number;
  rng?: Rng;
  /** Tự đặt timer (tắt trong test để điều khiển thời gian thủ công). */
  autoTimers?: boolean;
  /** Ngắt kết nối khi không có ván: sau bao lâu thì tự rời bàn. */
  idleSeatTimeoutMs?: number;
  /** Thời gian hiển thị kết quả trước khi bàn về trạng thái chờ. */
  resultDisplayMs?: number;
}

const envelopeSchema = z
  .object({
    actionId: z.string().min(8).max(64),
    gameId: z.string(),
    tableId: z.string(),
    roundId: z.string().nullable(),
    stateVersion: z.number().int().nonnegative(),
    type: z.string().min(1).max(32),
    payload: z.unknown(),
  })
  .strict();

const LOG_LIMIT = 200;
const PROCESSED_LIMIT = 1000;

const ok = <T>(data?: T): Ack<T> => ({ ok: true, data });
const fail = (error: string, code?: string): Ack => ({ ok: false, error, code });

/**
 * Bàn chơi cố định duy nhất của một game. Không có khái niệm phòng/nhiều bàn.
 * Là nguồn trạng thái chính thức; client chỉ gửi ý định hành động.
 */
export class GameTable {
  readonly id: string;
  readonly gameId: GameMeta['id'];
  config: unknown;
  version = 0;
  private seats: Seat[] = [];
  private round: Round | null = null;
  private log: StoredLog[] = [];
  private logSeq = 0;
  private lastResult: RoundResultView | null = null;
  private resultUntil = 0;
  private lastWinnerId: string | null = null;
  private manual: 'PAUSED' | 'CLOSED' | null = null;
  private pausedAt: number | null = null;
  private processed = new Map<string, Ack>();
  private timer: NodeJS.Timeout | null = null;
  private roundCounter: number;
  private listeners = new Set<() => void>();
  private now: () => number;
  private rng: Rng;
  private opts: Required<Omit<TableOptions, 'now' | 'rng'>>;

  constructor(
    readonly meta: GameMeta,
    readonly engine: GameEngine,
    private store: Store,
    private players: PlayerDirectory,
    options: TableOptions = {},
  ) {
    this.id = meta.tableId;
    this.gameId = meta.id;
    this.now = options.now ?? Date.now;
    this.rng = options.rng ?? cryptoRng;
    this.opts = {
      autoTimers: options.autoTimers ?? true,
      idleSeatTimeoutMs: options.idleSeatTimeoutMs ?? 120_000,
      resultDisplayMs: options.resultDisplayMs ?? 20_000,
    };
    const saved = store.loadTable(this.id);
    const parsed = engine.parseConfig(saved?.config ?? engine.defaultConfig);
    this.config = parsed.ok ? parsed.config : engine.defaultConfig;
    if (saved?.status === 'CLOSED') this.manual = 'CLOSED';
    this.roundCounter = store.lastRoundNumber(this.id);
    store.saveTable(this.id, this.gameId, this.config, this.manual ?? 'OPEN');
  }

  onChange(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  // ------------------------------------------------------------------ trạng thái
  private roundActive(): boolean {
    return !!this.round && !this.engine.isFinished(this.round.state);
  }

  private activeSeats() {
    return this.seats.filter((s) => !s.leaving);
  }

  get status(): TableStatus {
    if (this.manual === 'PAUSED') return 'PAUSED';
    if (this.roundActive()) return 'PLAYING';
    if (this.manual === 'CLOSED') return 'CLOSED';
    if (this.lastResult && this.now() < this.resultUntil) return 'ROUND_FINISHED';
    return this.activeSeats().length >= this.engine.minPlayers ? 'READY' : 'WAITING';
  }

  get maxPlayers(): number {
    return this.engine.maxPlayersFor(this.config);
  }

  summary(): LobbyGameSummary {
    return { gameId: this.gameId, tableId: this.id, playerCount: this.seats.length, maxPlayers: this.maxPlayers, status: this.status };
  }

  isSeated(playerId: string) {
    return this.seats.some((s) => s.playerId === playerId);
  }

  private changed() {
    this.version += 1;
    this.schedule();
    for (const fn of this.listeners) fn();
  }

  private pushLogs(logs: EngineLog[]) {
    for (const l of logs) {
      const entry: StoredLog = { id: ++this.logSeq, ts: this.now(), text: l.text, kind: l.kind ?? 'info', sfx: l.sfx, visibleTo: l.visibleTo };
      this.log.push(entry);
      this.store.appendEvent({
        sessionId: this.round?.id ?? null,
        tableId: this.id,
        seq: entry.id,
        kind: entry.kind,
        text: entry.text,
        visibleTo: l.visibleTo ?? null,
        audit: l.audit,
      });
    }
    if (this.log.length > LOG_LIMIT) this.log.splice(0, this.log.length - LOG_LIMIT);
  }

  private sys(text: string, kind: EngineLog['kind'] = 'system', sfx?: string) {
    this.pushLogs([{ text, kind, sfx }]);
  }

  private nick(playerId: string) {
    return this.players.get(playerId)?.nickname ?? 'Người chơi';
  }

  // ------------------------------------------------------------------ tham gia / rời
  join(playerId: string): Ack {
    if (this.isSeated(playerId)) return ok();
    if (this.manual === 'CLOSED') return fail('Bàn đang tạm ngừng nhận người chơi.', 'CLOSED');
    if (this.manual === 'PAUSED') return fail('Bàn đang tạm dừng, vui lòng quay lại sau.', 'PAUSED');
    if (this.seats.length >= this.maxPlayers) return fail('Bàn đã đủ chỗ. Bạn có thể ở lại xem và chờ người khác rời bàn.', 'FULL');
    const playing = this.roundActive();
    if (playing && this.engine.tablePolicy(this.config).midRoundJoin === 'reject') {
      return fail('Ván đang diễn ra và bàn không nhận người giữa ván. Vui lòng chờ ván kết thúc.', 'MID_ROUND');
    }
    const used = new Set(this.seats.map((s) => s.seat));
    let seat = 0;
    while (used.has(seat)) seat++;
    this.seats.push({
      playerId,
      seat,
      connected: true,
      disconnectedAt: null,
      ready: false,
      waiting: playing,
      leaving: false,
      goneHandled: false,
    });
    this.seats.sort((a, b) => a.seat - b.seat);
    if (this.engine.usesBalance) this.store.ensureBalance(playerId, this.gameId, (this.config as { startingBalance: number }).startingBalance);
    this.sys(playing ? `${this.nick(playerId)} vào bàn và sẽ chơi từ ván sau.` : `${this.nick(playerId)} đã vào bàn.`, 'system', 'join');
    this.changed();
    return ok();
  }

  leave(playerId: string): Ack {
    const seat = this.seats.find((s) => s.playerId === playerId);
    if (!seat) return ok();
    if (this.roundActive() && this.round!.players.includes(playerId)) {
      if (!seat.leaving) {
        seat.leaving = true;
        seat.ready = false;
        this.applyEngine((st, ctx) => this.engine.onPlayerGone(st, playerId, ctx));
        seat.goneHandled = true;
        // Engine có thể đã kết thúc ván (ví dụ còn 1 người), lúc đó chỗ ngồi được dọn trong finishRound.
        this.changed();
      }
      return ok();
    }
    this.seats = this.seats.filter((s) => s.playerId !== playerId);
    this.sys(`${this.nick(playerId)} đã rời bàn.`, 'system', 'leave');
    this.changed();
    return ok();
  }

  setReady(playerId: string, ready: boolean): Ack {
    const seat = this.seats.find((s) => s.playerId === playerId);
    if (!seat) return fail('Bạn chưa tham gia bàn.', 'NOT_SEATED');
    if (this.roundActive()) return fail('Ván đang diễn ra.', 'PLAYING');
    if (this.manual) return fail(this.manual === 'CLOSED' ? 'Bàn đang tạm ngừng.' : 'Bàn đang tạm dừng.', this.manual);
    seat.ready = ready;
    if (ready) this.resultUntil = 0; // rời màn hình kết quả
    this.maybeStart();
    this.changed();
    return ok();
  }

  setConnected(playerId: string, connected: boolean) {
    const seat = this.seats.find((s) => s.playerId === playerId);
    if (!seat || seat.connected === connected) return;
    seat.connected = connected;
    seat.disconnectedAt = connected ? null : this.now();
    this.sys(connected ? `${this.nick(playerId)} đã kết nối lại.` : `${this.nick(playerId)} mất kết nối…`, 'system');
    this.changed();
  }

  /** Lý do không thể bắt đầu với số người hiện tại (nếu có). */
  startBlocker(): string | null {
    const n = this.activeSeats().length;
    if (n < this.engine.minPlayers) return `Cần ít nhất ${this.engine.minPlayers} người để bắt đầu.`;
    return this.engine.validateStart(this.config, n);
  }

  private maybeStart() {
    if (this.roundActive() || this.manual) return;
    const seats = this.activeSeats();
    if (seats.length < this.engine.minPlayers || !seats.every((s) => s.ready && s.connected)) return;
    const blocker = this.engine.validateStart(this.config, seats.length);
    if (blocker) {
      this.sys(`Không thể bắt đầu: ${blocker}`, 'warn');
      for (const s of seats) s.ready = false;
      return;
    }
    this.startRound(seats);
  }

  private startRound(seats: Seat[]) {
    const number = ++this.roundCounter;
    const id = `${this.id}:${number}:${randomId(this.rng, 6)}`;
    const config = structuredClone(this.config); // đóng băng cấu hình cho ván
    const roundPlayers = seats.map((s) => ({ id: s.playerId, nickname: this.nick(s.playerId) }));
    for (const s of this.seats) {
      s.waiting = false;
      s.ready = false;
    }
    this.store.createSession({
      id,
      tableId: this.id,
      gameId: this.gameId,
      roundNumber: number,
      rulesVersion: this.engine.rulesVersion,
      config,
      players: roundPlayers.map((p) => p.id),
    });
    if (this.engine.usesBalance) {
      for (const p of roundPlayers) this.store.ensureBalance(p.id, this.gameId, (config as { startingBalance: number }).startingBalance);
    }
    const prev = this.lastWinnerId && roundPlayers.some((p) => p.id === this.lastWinnerId) ? this.lastWinnerId : null;
    const res = this.engine.createRound(roundPlayers, config, { rng: this.rng, now: this.now() }, { roundId: id, previousWinnerId: prev });
    this.round = { id, number, state: res.state, stateVersion: 0, players: roundPlayers.map((p) => p.id) };
    this.lastResult = null;
    this.resultUntil = 0;
    this.sys(`Ván ${number} bắt đầu với ${roundPlayers.length} người.`, 'system', 'start');
    this.pushLogs(res.logs);
    if (this.engine.isFinished(res.state)) this.finishRound();
  }

  // ------------------------------------------------------------------ hành động
  action(playerId: string, raw: unknown): Ack {
    const parsed = envelopeSchema.safeParse(raw);
    if (!parsed.success) return fail('Hành động không hợp lệ.', 'BAD_ENVELOPE');
    const env = parsed.data as ActionEnvelope;
    const key = `${playerId}:${env.actionId}`;
    const cached = this.processed.get(key);
    if (cached) return cached; // gửi lặp: trả lại đúng kết quả cũ, không áp dụng lần nữa
    const result = this.processAction(playerId, env);
    this.processed.set(key, result);
    if (this.processed.size > PROCESSED_LIMIT) this.processed.delete(this.processed.keys().next().value!);
    return result;
  }

  private processAction(playerId: string, env: ActionEnvelope): Ack {
    if (env.gameId !== this.gameId || env.tableId !== this.id) return fail('Sai bàn chơi.', 'WRONG_TABLE');
    if (this.manual === 'PAUSED') return fail('Bàn đang tạm dừng.', 'PAUSED');
    const round = this.round;
    if (!round || !this.roundActive()) return fail('Hiện không có ván nào đang diễn ra.', 'NO_ROUND');
    if (env.roundId !== round.id) return fail('Hành động thuộc ván cũ.', 'STALE_ROUND');
    if (!round.players.includes(playerId)) return fail('Bạn không tham gia ván này.', 'NOT_IN_ROUND');
    const seat = this.seats.find((s) => s.playerId === playerId);
    if (!seat || seat.leaving) return fail('Bạn đã rời ván này.', 'LEFT');
    if (env.stateVersion !== round.stateVersion) return fail('Trạng thái ván đã thay đổi, hãy thử lại.', 'STALE_STATE');
    try {
      this.applyEngine((st, ctx) => this.engine.applyAction(st, playerId, env.type, env.payload, ctx));
    } catch (err) {
      if (err instanceof GameRuleError) return fail(err.message, err.code);
      console.error(`[${this.id}] lỗi xử lý hành động`, (err as Error).message);
      return fail('Máy chủ gặp lỗi khi xử lý hành động.', 'SERVER');
    }
    this.changed();
    return ok({ stateVersion: this.round?.stateVersion });
  }

  /** Áp dụng một biến đổi engine lên ván hiện tại (nguyên tử: lỗi thì không đổi gì). */
  private applyEngine(fn: (state: unknown, ctx: { rng: Rng; now: number }) => EngineResult<unknown>) {
    const round = this.round;
    if (!round || !this.roundActive()) return;
    const res = fn(round.state, { rng: this.rng, now: this.now() });
    if (res.state === round.state && res.logs.length === 0) return;
    round.state = res.state;
    round.stateVersion += 1;
    this.pushLogs(res.logs);
    if (this.engine.isFinished(res.state)) this.finishRound();
  }

  private finishRound() {
    const round = this.round!;
    const outcome = this.engine.getOutcome(round.state);
    const { applied } = this.store.settleSession(round.id, this.gameId, outcome, outcome.settlements);
    if (!applied) console.warn(`[${this.id}] ván ${round.id} đã được quyết toán trước đó — bỏ qua.`);
    const totals = round.players.map((pid) => ({
      playerId: pid,
      delta: outcome.settlements.filter((s) => s.playerId === pid).reduce((a, s) => a + s.amount, 0),
      balance: this.engine.usesBalance ? (this.store.getBalance(pid, this.gameId) ?? null) : null,
    }));
    this.lastResult = {
      roundId: round.id,
      roundNumber: round.number,
      winners: outcome.winners,
      title: outcome.title,
      settlements: outcome.settlements.map((s) => ({ playerId: s.playerId, amount: s.amount, reason: s.reason })),
      totals,
      detail: outcome.detail,
    };
    this.lastWinnerId = outcome.winners[0] ?? null;
    this.resultUntil = this.now() + this.opts.resultDisplayMs;
    const left = this.seats.filter((s) => s.leaving).map((s) => s.playerId);
    this.seats = this.seats.filter((s) => !s.leaving);
    for (const s of this.seats) {
      s.ready = false;
      s.waiting = false;
    }
    for (const pid of left) this.sys(`${this.nick(pid)} đã rời bàn.`, 'system');
    this.sys(`Ván ${round.number} kết thúc: ${outcome.title}`, 'win', 'roundEnd');
  }

  // ------------------------------------------------------------------ quản trị
  adminConfig(input: unknown): Ack {
    const r = this.engine.parseConfig(input);
    if (!r.ok) return fail(r.error, 'BAD_CONFIG');
    const nextMax = this.engine.maxPlayersFor(r.config);
    if (this.seats.length > nextMax) return fail(`Bàn đang có ${this.seats.length} người, không thể giảm tối đa xuống ${nextMax}.`, 'BAD_CONFIG');
    this.config = r.config;
    this.store.saveTable(this.id, this.gameId, this.config, this.manual ?? 'OPEN');
    this.sys(
      this.roundActive() ? 'Quản trị viên đã cập nhật luật — áp dụng từ ván sau.' : 'Quản trị viên đã cập nhật luật chơi.',
      'system',
    );
    this.changed();
    return ok();
  }

  adminStatus(next: 'OPEN' | 'PAUSED' | 'CLOSED'): Ack {
    const now = this.now();
    if (next === 'PAUSED') {
      if (this.manual === 'PAUSED') return ok();
      this.manual = 'PAUSED';
      this.pausedAt = now;
      this.sys('Quản trị viên đã tạm dừng bàn.', 'warn');
    } else {
      if (this.manual === 'PAUSED' && this.pausedAt !== null && this.round && this.roundActive()) {
        this.round.state = this.engine.shiftDeadlines(this.round.state, now - this.pausedAt);
      }
      this.pausedAt = null;
      this.manual = next === 'CLOSED' ? 'CLOSED' : null;
      this.sys(next === 'CLOSED' ? 'Bàn tạm ngừng nhận người chơi.' : 'Bàn đã mở lại.', 'system');
    }
    this.store.saveTable(this.id, this.gameId, this.config, this.manual ?? 'OPEN');
    this.changed();
    return ok();
  }

  // ------------------------------------------------------------------ thời gian
  private nextWakeAt(): number | null {
    const times: number[] = [];
    if (this.manual !== 'PAUSED' && this.round && this.roundActive()) {
      const d = this.engine.getDeadline(this.round.state);
      if (d !== null) times.push(d);
    }
    const grace = this.engine.tablePolicy(this.config).disconnectGraceMs;
    for (const s of this.seats) {
      if (s.connected || s.disconnectedAt === null) continue;
      const inRound = this.roundActive() && this.round!.players.includes(s.playerId);
      if (inRound && !s.goneHandled && grace !== null) times.push(s.disconnectedAt + grace);
      if (!inRound) times.push(s.disconnectedAt + this.opts.idleSeatTimeoutMs);
    }
    if (this.resultUntil > this.now()) times.push(this.resultUntil);
    return times.length ? Math.min(...times) : null;
  }

  private schedule() {
    if (!this.opts.autoTimers) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const at = this.nextWakeAt();
    if (at === null) return;
    this.timer = setTimeout(() => this.tick(), Math.max(0, at - this.now()) + 5);
  }

  /** Xử lý mọi mốc thời gian đã đến hạn. Gọi bởi timer hoặc test. */
  tick() {
    let dirty = false;
    const now = this.now();
    // Hạn lượt / hạn lựa chọn
    for (let guard = 0; guard < 50 && this.manual !== 'PAUSED' && this.round && this.roundActive(); guard++) {
      const d = this.engine.getDeadline(this.round.state);
      if (d === null || d > now) break;
      const before = this.round.stateVersion;
      this.applyEngine((st, ctx) => this.engine.onDeadline(st, ctx));
      dirty = true;
      if (this.round.stateVersion === before) break;
    }
    // Mất kết nối quá lâu
    const grace = this.engine.tablePolicy(this.config).disconnectGraceMs;
    for (const s of [...this.seats]) {
      if (s.connected || s.disconnectedAt === null) continue;
      const inRound = this.roundActive() && this.round!.players.includes(s.playerId);
      if (inRound && !s.goneHandled && grace !== null && now - s.disconnectedAt >= grace) {
        s.goneHandled = true;
        this.sys(`${this.nick(s.playerId)} mất kết nối quá lâu.`, 'warn');
        this.applyEngine((st, ctx) => this.engine.onPlayerGone(st, s.playerId, ctx));
        dirty = true;
      } else if (!inRound && now - s.disconnectedAt >= this.opts.idleSeatTimeoutMs) {
        this.seats = this.seats.filter((x) => x !== s);
        this.sys(`${this.nick(s.playerId)} rời bàn do mất kết nối.`, 'system');
        dirty = true;
      }
    }
    if (this.resultUntil && now >= this.resultUntil) {
      this.resultUntil = 0;
      dirty = true;
    }
    if (dirty) this.changed();
    else this.schedule();
  }

  dispose() {
    if (this.timer) clearTimeout(this.timer);
  }

  // ------------------------------------------------------------------ chiếu dữ liệu
  view(viewerId: string | null, isAdmin: boolean): TableView {
    const seated = !!viewerId && this.isSeated(viewerId);
    const seats: SeatView[] = this.seats.map((s) => {
      const p = this.players.get(s.playerId) ?? { id: s.playerId, nickname: 'Người chơi', avatar: 'meo-cam' };
      return {
        player: p,
        seat: s.seat,
        connected: s.connected,
        ready: s.ready,
        waitingNextRound: s.waiting,
        leaving: s.leaving,
        balance: this.engine.usesBalance ? (this.store.getBalance(s.playerId, this.gameId) ?? null) : null,
      };
    });
    const log = this.log.filter((l) => !l.visibleTo || (viewerId && l.visibleTo.includes(viewerId))).slice(-80);
    return {
      gameId: this.gameId,
      tableId: this.id,
      status: this.status,
      version: this.version,
      minPlayers: this.engine.minPlayers,
      maxPlayers: this.maxPlayers,
      seats,
      config: this.config,
      rulesVersion: this.engine.rulesVersion,
      round: this.round
        ? {
            id: this.round.id,
            number: this.round.number,
            stateVersion: this.round.stateVersion,
            // Người không thuộc ván chỉ xem trạng thái công khai.
            view: this.engine.projectView(this.round.state, viewerId && this.round.players.includes(viewerId) ? viewerId : null),
          }
        : null,
      lastResult: this.lastResult,
      log: log.map(({ visibleTo: _v, ...rest }) => rest),
      you: { playerId: viewerId, seated, isAdmin },
      serverTime: this.now(),
      startBlocker: this.roundActive() ? null : this.startBlocker(),
    };
  }
}
