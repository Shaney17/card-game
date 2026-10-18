/** Kiểu dữ liệu ván đã được lọc theo người xem (server -> client). */

// ---------------- Sâm
export type SamPhaseView = 'DECLARE' | 'PLAYING' | 'SAM_DECLARED' | 'ROUND_FINISHED';
export type SamComboType = 'single' | 'pair' | 'triple' | 'quad' | 'straight';

export interface SamRoundView {
  phase: SamPhaseView;
  turnPlayerId: string | null;
  leading: boolean;
  deadline: number | null;
  samDeclarerId: string | null;
  players: {
    id: string;
    nickname: string;
    cardCount: number;
    passed: boolean;
    auto: boolean;
    samDecided: boolean;
    cards: string[] | null;
  }[];
  myHand: string[] | null;
  mySamChoice: 'yes' | 'no' | null;
  canPass: boolean;
  trick: { playerId: string; cards: string[]; type: SamComboType; label: string; cut: 'two' | 'pairTwo' | 'quad' | null; seq: number }[];
  toBeat: { type: SamComboType; length: number; label: string } | null;
  rules: { lowStraights: boolean; quadBeatsTwo: boolean; quadBeatsPairTwo: boolean; lastCardTwo: 'allowed' | 'forbidden' };
}

export interface SamResultDetail {
  reason: 'normal' | 'samSuccess' | 'samFail' | 'instant';
  winnerId: string;
  blockerId: string | null;
  samDeclarerId: string | null;
  instantKind: string | null;
  transfers: { from: string; to: string; amount: number; reason: string }[];
  hands: { playerId: string; cards: string[]; twos: number; cong: boolean }[];
}

// ---------------- Mèo Nổ
export interface CatsCardInst {
  id: string;
  def: string;
}

export type CatsPendingView =
  | {
      kind: 'action';
      actorId: string;
      cardDefs: string[];
      effect: string;
      targetId: string | null;
      namedDef: string | null;
      nopeChain: string[];
      willResolve: boolean;
      deadline: number;
      canNope: boolean;
      canPass: boolean;
      waitingFor: string[];
    }
  | { kind: 'favor'; giverId: string; receiverId: string; deadline: number }
  | { kind: 'defuse'; playerId: string; deadline: number; deckCount: number }
  | { kind: 'alter'; playerId: string; deadline: number; cards: CatsCardInst[] | null };

export interface CatsRoundView {
  phase: 'PLAYING' | 'ROUND_FINISHED';
  order: string[];
  direction: 1 | -1;
  currentId: string;
  turnsRemaining: number;
  underAttack: boolean;
  deckCount: number;
  bombsInDeck: number;
  discardTop: string[];
  discardCount: number;
  players: { id: string; nickname: string; cardCount: number; alive: boolean }[];
  myHand: CatsCardInst[] | null;
  seeFuture: { defs: string[]; seq: number } | null;
  pending: CatsPendingView | null;
  deadline: number | null;
  lastEvent: { seq: number; type: string; actorId?: string; targetId?: string; cardDefs?: string[] } | null;
  winnerId: string | null;
  eliminated: string[];
  expansions: string[];
  enabledCardIds: string[];
}
