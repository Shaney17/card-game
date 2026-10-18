import type { CatsConfig } from './config';

export interface CardInst {
  id: string;
  def: string;
  /** Lá đang lật ngửa trong chồng bài (Mèo Nổ Sập sau lần rút đầu). */
  faceUp?: boolean;
}

export interface CatsPlayer {
  id: string;
  nickname: string;
  hand: CardInst[];
  alive: boolean;
}

export interface PlayIntent {
  cards: CardInst[];
  effect: string;
  targetId: string | null;
  namedDef: string | null;
}

export type Pending =
  | ({ kind: 'action'; actorId: string; nopes: { playerId: string; cardId: string }[]; passes: string[]; deadline: number } & PlayIntent)
  | { kind: 'favor'; giverId: string; receiverId: string; deadline: number }
  /** endsTurn = false khi bom nổ do Mèo Liều rời tay (không phải do rút bài). */
  | { kind: 'defuse'; playerId: string; bomb: CardInst; endsTurn: boolean; deadline: number }
  | { kind: 'alter'; playerId: string; share: boolean; deadline: number }
  /** Cặp mèo: người đánh chọn 1 lá úp. `order` là thứ tự đã xáo bí mật của bài mục tiêu. */
  | { kind: 'steal_pick'; actorId: string; targetId: string; order: string[]; deadline: number }
  | { kind: 'implode_place'; playerId: string; card: CardInst; deadline: number }
  | { kind: 'garbage'; waiting: string[]; chosen: Record<string, string>; deadline: number }
  /** queue[0] là người đang chọn lá úp lên chồng bài. */
  | { kind: 'potluck'; queue: string[]; deadline: number }
  | { kind: 'bury'; playerId: string; card: CardInst; deadline: number }
  | { kind: 'dig'; playerId: string; deadline: number };

export type PendingKind = Pending['kind'];

export interface CatsEvent {
  seq: number;
  type:
    | 'play'
    | 'nope'
    | 'draw'
    | 'explode'
    | 'implode'
    | 'defuse'
    | 'steal'
    | 'favor'
    | 'shuffle'
    | 'eliminate'
    | 'win'
    | 'cancel'
    | 'turn'
    | 'mark'
    | 'timebomb';
  actorId?: string;
  targetId?: string;
  cardDefs?: string[];
}

export interface CatsState {
  roundId: string;
  config: CatsConfig;
  phase: 'PLAYING' | 'ROUND_FINISHED';
  order: string[];
  direction: 1 | -1;
  players: Record<string, CatsPlayer>;
  currentId: string;
  turnsRemaining: number;
  underAttack: boolean;
  /** Phần tử 0 là lá trên cùng. KHÔNG bao giờ gửi xuống client. */
  deck: CardInst[];
  discard: CardInst[];
  pending: Pending | null;
  turnDeadline: number | null;
  privateInfo: Record<string, { seeFuture?: { defs: string[]; seq: number; from?: string } }>;
  /** Lá bị Đánh Dấu (công khai) theo người giữ. */
  marked: Record<string, string[]>;
  /** Mèo Hẹn Giờ đang đặt ngửa trước mặt người giữ, đếm theo lượt của chính người giữ. */
  timeBombs: { card: CardInst; holderId: string; turnsLeft: number }[];
  /** "Ta Lấy Nhé": người bị nhắm → người sẽ nhận lá tiếp theo họ rút. */
  claims: Record<string, string>;
  lastEvent: CatsEvent | null;
  seq: number;
  winnerId: string | null;
  eliminated: string[];
}
