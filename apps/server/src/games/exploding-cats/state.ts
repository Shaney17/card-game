import type { CatsConfig } from './config';

export interface CardInst {
  id: string;
  def: string;
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
  | { kind: 'defuse'; playerId: string; bomb: CardInst; deadline: number }
  | { kind: 'alter'; playerId: string; deadline: number };

export interface CatsEvent {
  seq: number;
  type: 'play' | 'nope' | 'draw' | 'explode' | 'defuse' | 'steal' | 'favor' | 'shuffle' | 'eliminate' | 'win' | 'cancel' | 'turn';
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
  privateInfo: Record<string, { seeFuture?: { defs: string[]; seq: number } }>;
  lastEvent: CatsEvent | null;
  seq: number;
  winnerId: string | null;
  eliminated: string[];
}
