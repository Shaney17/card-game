import type { GameId, LogKind } from '@chieu-bai/shared';
import type { Rng } from '../security/rng';

export interface EngineContext {
  rng: Rng;
  now: number;
}

export interface RoundPlayer {
  id: string;
  nickname: string;
}

export interface EngineLog {
  text: string;
  kind?: LogKind;
  sfx?: string;
  /** Nếu có: chỉ những người chơi này thấy dòng log. */
  visibleTo?: string[];
  /** Dữ liệu kiểm tra nội bộ (chỉ lưu DB, không gửi client). */
  audit?: unknown;
}

export interface EngineResult<S> {
  state: S;
  logs: EngineLog[];
}

/** Một khoản thay đổi số dư. `key` là duy nhất trong một ván để chống quyết toán trùng. */
export interface Settlement {
  key: string;
  playerId: string;
  amount: number;
  reason: string;
}

export interface RoundOutcome {
  winners: string[];
  title: string;
  settlements: Settlement[];
  detail: unknown;
}

export class GameRuleError extends Error {
  constructor(message: string, readonly code = 'RULE') {
    super(message);
  }
}

export type ConfigParseResult<C> = { ok: true; config: C } | { ok: false; error: string };

export interface TablePolicy {
  midRoundJoin: 'waitNextRound' | 'reject';
  /** Sau bao lâu mất kết nối thì coi như rời ván (null = không bao giờ, chỉ dùng đồng hồ lượt). */
  disconnectGraceMs: number | null;
}

export interface StartInfo {
  /** Người thắng ván trước (nếu còn ở bàn). */
  previousWinnerId?: string | null;
  roundId: string;
}

/**
 * Giao diện engine dùng chung (spec §13 "Game engine").
 * Engine thuần: không phụ thuộc React, Socket.IO hay DB.
 */
export interface GameEngine<C = any, S = any> {
  id: GameId;
  rulesVersion: string;
  minPlayers: number;
  maxPlayers: number;
  usesBalance: boolean;
  defaultConfig: C;
  /** Kiểm tra & chuẩn hoá cấu hình (giới hạn hợp lệ). */
  parseConfig(input: unknown): ConfigParseResult<C>;
  /** Số người tối đa theo cấu hình (≤ maxPlayers). */
  maxPlayersFor(config: C): number;
  /** Kiểm tra có thể khởi tạo ván với số người này không. Trả về thông báo lỗi tiếng Việt. */
  validateStart(config: C, playerCount: number): string | null;
  createRound(players: RoundPlayer[], config: C, ctx: EngineContext, info: StartInfo): EngineResult<S>;
  /** Ném GameRuleError nếu hành động không hợp lệ. Không được sửa `state` đầu vào. */
  applyAction(state: S, playerId: string, type: string, payload: unknown, ctx: EngineContext): EngineResult<S>;
  getDeadline(state: S): number | null;
  onDeadline(state: S, ctx: EngineContext): EngineResult<S>;
  /** Người chơi rời bàn giữa ván hoặc mất kết nối quá lâu. */
  onPlayerGone(state: S, playerId: string, ctx: EngineContext): EngineResult<S>;
  /** Dời mọi mốc thời gian (dùng khi bàn tạm dừng rồi tiếp tục). */
  shiftDeadlines(state: S, deltaMs: number): S;
  /** Chính sách bàn chơi theo cấu hình: tham gia giữa ván & thời gian chờ khi mất kết nối. */
  tablePolicy(config: C): TablePolicy;
  isFinished(state: S): boolean;
  getOutcome(state: S): RoundOutcome;
  /** Trạng thái riêng cho từng người xem (null = khán giả). */
  projectView(state: S, viewerId: string | null): unknown;
}
