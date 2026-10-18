import type { CardCode } from './cards';
import type { InstantWinKind, SamConfig } from './config';
import type { Combo, CutKind } from './rules';

export type SamPhase = 'DECLARE' | 'PLAYING' | 'SAM_DECLARED' | 'ROUND_FINISHED';

export interface SamPlayerState {
  id: string;
  nickname: string;
  hand: CardCode[];
  /** Đã bỏ lượt trong vòng đánh hiện tại. */
  passed: boolean;
  playedAny: boolean;
  samChoice: 'yes' | 'no' | null;
  /** Đã rời bàn — máy tự chơi tới hết ván. */
  auto: boolean;
}

export interface PlayRecord {
  playerId: string;
  combo: Combo;
  cut?: CutKind;
  seq: number;
}

export interface CutRecord {
  cutterId: string;
  victimId: string;
  kind: CutKind;
  amount: number;
}

export type SamFinishReason = 'normal' | 'samSuccess' | 'samFail' | 'instant';

export interface SamFinish {
  reason: SamFinishReason;
  winnerId: string;
  blockerId?: string;
  instantKind?: InstantWinKind;
}

export interface SamState {
  roundId: string;
  config: SamConfig;
  phase: SamPhase;
  players: SamPlayerState[];
  turn: number;
  /** Các lượt đánh của vòng hiện tại; phần tử cuối là bộ cần chặn. */
  trick: PlayRecord[];
  samDeclarerId: string | null;
  cuts: CutRecord[];
  finish: SamFinish | null;
  deadline: number | null;
  seq: number;
  /** Người đánh trước nếu không ai báo Sâm. */
  starterIdx: number;
}
