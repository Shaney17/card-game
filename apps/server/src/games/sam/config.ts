import { z } from 'zod';
import type { ConfigParseResult } from '../../game-registry/types';

/**
 * Cấu hình luật Sâm. Mọi con số mặc định ở đây là GIÁ TRỊ MINH HOẠ,
 * chưa được chủ sở hữu xác nhận — xem docs/game-rules/sam.md mục "Điểm chưa chốt".
 * Tiền ảo luôn là số nguyên.
 */
const money = (max: number) => z.number().int().min(0).max(max);

export const INSTANT_WIN_KINDS = ['fourTwos', 'dragon', 'fivePairs', 'threeTriples', 'sameColor'] as const;
export type InstantWinKind = (typeof INSTANT_WIN_KINDS)[number];

export const INSTANT_WIN_LABEL: Record<InstantWinKind, string> = {
  fourTwos: 'Tứ quý 2',
  dragon: 'Sảnh rồng 10 lá',
  fivePairs: '5 đôi',
  threeTriples: '3 sám cô',
  sameColor: 'Đồng màu 10 lá',
};

export const samConfigSchema = z
  .object({
    maxPlayers: z.number().int().min(2).max(5),
    handSize: z.literal(10),
    startingBalance: money(10_000_000),
    /** Tiền phạt mỗi lá còn lại khi thua thường. */
    perCardPenalty: money(100_000),
    /** Phạt "cóng" — thua khi chưa đánh được lá nào. */
    congPenalty: money(1_000_000),
    /** Phạt thối 2 — mỗi quân 2 còn trên tay khi thua. */
    thoiTwoPenalty: money(1_000_000),
    /** Phạt khi bị tứ quý chặt 2 lẻ (người có 2 trả người chặt). */
    cutTwoPenalty: money(1_000_000),
    /** Phạt khi bị tứ quý chặt đôi 2. */
    cutPairTwoPenalty: money(1_000_000),
    /** Phạt khi tứ quý bị tứ quý lớn hơn chặt. */
    cutQuadPenalty: money(1_000_000),
    enableSam: z.boolean(),
    /** Thời gian chờ báo Sâm đầu ván (ms). */
    samDeclareMs: z.number().int().min(3000).max(30000),
    /** Mỗi người còn lại trả người báo Sâm thành công. */
    samReward: money(10_000_000),
    /** Phạt báo Sâm thất bại. */
    samPenalty: money(10_000_000),
    /** Cách đền khi báo Sâm thất bại. */
    samFailMode: z.enum(['payEachOpponent', 'payBlockerForAll']),
    enableInstantWin: z.boolean(),
    instantWinKinds: z.array(z.enum(INSTANT_WIN_KINDS)).max(INSTANT_WIN_KINDS.length),
    /** Mỗi người còn lại trả người ăn trắng. */
    instantWinAmount: money(10_000_000),
    lowStraights: z.boolean(),
    quadBeatsTwo: z.boolean(),
    quadBeatsPairTwo: z.boolean(),
    /** Quy tắc đánh 2 cuối cùng: cho phép hoặc cấm về bằng bộ có quân 2. */
    lastCardTwo: z.enum(['allowed', 'forbidden']),
    /** Công thức tiền khi thua thường. */
    lossFormula: z.enum(['perCardPlusPenalties', 'flat']),
    /** Mức trả cố định nếu dùng công thức "flat". */
    flatLossAmount: money(10_000_000),
    turnTimeMs: z.number().int().min(5000).max(120000),
    /** Mất kết nối quá thời gian này thì máy đánh thay tới hết ván. */
    disconnectTimeoutMs: z.number().int().min(15_000).max(600_000),
    midRoundJoin: z.enum(['waitNextRound', 'reject']),
  })
  .strict();

export type SamConfig = z.infer<typeof samConfigSchema>;

export const SAM_DEFAULT_CONFIG: SamConfig = {
  maxPlayers: 5,
  handSize: 10,
  startingBalance: 10_000,
  perCardPenalty: 10,
  congPenalty: 150,
  thoiTwoPenalty: 50,
  cutTwoPenalty: 100,
  cutPairTwoPenalty: 200,
  cutQuadPenalty: 200,
  enableSam: true,
  samDeclareMs: 10_000,
  samReward: 200,
  samPenalty: 200,
  samFailMode: 'payEachOpponent',
  enableInstantWin: true,
  instantWinKinds: [...INSTANT_WIN_KINDS],
  instantWinAmount: 200,
  lowStraights: true,
  quadBeatsTwo: true,
  quadBeatsPairTwo: false,
  lastCardTwo: 'forbidden',
  lossFormula: 'perCardPlusPenalties',
  flatLossAmount: 100,
  turnTimeMs: 30_000,
  disconnectTimeoutMs: 60_000,
  midRoundJoin: 'waitNextRound',
};

export function parseSamConfig(input: unknown): ConfigParseResult<SamConfig> {
  const merged = { ...SAM_DEFAULT_CONFIG, ...(typeof input === 'object' && input ? input : {}) };
  const r = samConfigSchema.safeParse(merged);
  if (!r.success) {
    const first = r.error.issues[0];
    return { ok: false, error: `Cấu hình Sâm không hợp lệ ở "${first.path.join('.')}": ${first.message}` };
  }
  return { ok: true, config: r.data };
}
