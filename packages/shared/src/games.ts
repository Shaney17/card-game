/** Metadata công khai của các game. Dùng chung giữa server và client. */
export type GameId = 'sam' | 'exploding-cats';

export interface GameMeta {
  id: GameId;
  /** ID bàn cố định duy nhất của game. */
  tableId: string;
  name: string;
  tagline: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  /** Khóa ảnh bìa trong asset manifest phía client. */
  coverKey: string;
  playable: true;
}

export interface ComingSoonMeta {
  id: string;
  name: string;
  tagline: string;
  coverKey: string;
  playable: false;
}

export const GAMES: Record<GameId, GameMeta> = {
  sam: {
    id: 'sam',
    tableId: 'sam-main-table',
    name: 'Sâm',
    tagline: 'Sâm lốc 10 lá — đánh nhanh, chặt gọn, báo Sâm nếu dám.',
    description:
      'Game bài Việt Nam dùng bộ bài Tây 52 lá. Mỗi người nhận 10 lá, lần lượt đánh bài lẻ, đôi, sám cô, sảnh hoặc tứ quý để chặn người trước. Ai hết bài trước sẽ thắng ván.',
    minPlayers: 2,
    maxPlayers: 5,
    coverKey: 'cover.sam',
    playable: true,
  },
  'exploding-cats': {
    id: 'exploding-cats',
    tableId: 'exploding-cats-main-table',
    name: 'Mèo Nổ',
    tagline: 'Rút bài, né bom, chơi xấu bạn bè — mèo nào sống sót cuối cùng?',
    description:
      'Game theo lượt với bộ bài nguyên bản của dự án. Dùng lá hành động để né lượt, tấn công, soi bài hay cướp bài. Rút phải Mèo Nổ mà không có Gỡ Bom là bị loại. Người cuối cùng còn sống chiến thắng.',
    minPlayers: 2,
    maxPlayers: 8,
    coverKey: 'cover.exploding-cats',
    playable: true,
  },
};

export const COMING_SOON: ComingSoonMeta[] = [
  { id: 'tien-len', name: 'Tiến Lên', tagline: 'Tiến lên miền Nam 13 lá.', coverKey: 'cover.coming-soon', playable: false },
];

export const GAME_IDS = Object.keys(GAMES) as GameId[];

export function isGameId(x: unknown): x is GameId {
  return typeof x === 'string' && x in GAMES;
}
