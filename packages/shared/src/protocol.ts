import type { GameId } from './games';

/** Trạng thái bàn chơi (spec §2.2). */
export type TableStatus = 'WAITING' | 'READY' | 'PLAYING' | 'ROUND_FINISHED' | 'PAUSED' | 'CLOSED';

export const TABLE_STATUS_LABEL: Record<TableStatus, string> = {
  WAITING: 'Đang chờ người chơi',
  READY: 'Đủ người — chờ sẵn sàng',
  PLAYING: 'Đang chơi',
  ROUND_FINISHED: 'Ván đã kết thúc',
  PAUSED: 'Tạm dừng',
  CLOSED: 'Tạm ngừng nhận người chơi',
};

export interface PublicPlayer {
  id: string;
  nickname: string;
  avatar: string;
}

export interface SeatView {
  player: PublicPlayer;
  seat: number;
  connected: boolean;
  ready: boolean;
  /** Vào khi ván đang diễn ra — chờ ván kế tiếp. */
  waitingNextRound: boolean;
  /** Đã rời bàn giữa ván (máy tự chơi tới khi hết ván). */
  leaving: boolean;
  /** Số dư tiền ảo (chỉ với game có dùng tiền ảo). */
  balance: number | null;
}

export type LogKind = 'info' | 'play' | 'warn' | 'win' | 'lose' | 'system';

export interface LogEntry {
  id: number;
  ts: number;
  text: string;
  kind: LogKind;
  /** Khóa âm thanh trong sound manifest. */
  sfx?: string;
}

export interface SettlementView {
  playerId: string;
  amount: number;
  reason: string;
}

export interface RoundResultView {
  roundId: string;
  roundNumber: number;
  winners: string[];
  title: string;
  settlements: SettlementView[];
  /** Tổng thay đổi và số dư mới theo người chơi. */
  totals: { playerId: string; delta: number; balance: number | null }[];
  /** Dữ liệu riêng từng game (ví dụ: bài còn lại của Sâm). */
  detail: unknown;
}

export interface TableView<RoundView = unknown> {
  gameId: GameId;
  tableId: string;
  status: TableStatus;
  version: number;
  minPlayers: number;
  maxPlayers: number;
  seats: SeatView[];
  config: unknown;
  rulesVersion: string;
  round: { id: string; number: number; stateVersion: number; view: RoundView } | null;
  lastResult: RoundResultView | null;
  log: LogEntry[];
  you: { playerId: string | null; seated: boolean; isAdmin: boolean };
  serverTime: number;
  /** Lý do không thể bắt đầu (ví dụ: cấu hình bộ bài không hợp lệ). */
  startBlocker: string | null;
}

export interface LobbyGameSummary {
  gameId: GameId;
  tableId: string;
  playerCount: number;
  maxPlayers: number;
  status: TableStatus;
}

export interface SessionInfo {
  player: PublicPlayer;
  token: string;
  isAdmin: boolean;
}

/** Hành động gửi lên server (spec §6.2). */
export interface ActionEnvelope {
  actionId: string;
  gameId: GameId;
  tableId: string;
  roundId: string | null;
  stateVersion: number;
  type: string;
  payload: unknown;
}

export type Ack<T = unknown> = { ok: true; data?: T } | { ok: false; error: string; code?: string };

/** Tên sự kiện Socket.IO. */
export const EV = {
  // client -> server
  hello: 'session:hello',
  profile: 'session:profile',
  lobbyWatch: 'lobby:watch',
  tableWatch: 'table:watch',
  tableUnwatch: 'table:unwatch',
  tableJoin: 'table:join',
  tableLeave: 'table:leave',
  tableReady: 'table:ready',
  gameAction: 'game:action',
  adminLogin: 'admin:login',
  adminConfig: 'admin:config',
  adminStatus: 'admin:status',
  // server -> client
  lobbyUpdate: 'lobby:update',
  tableUpdate: 'table:update',
} as const;
